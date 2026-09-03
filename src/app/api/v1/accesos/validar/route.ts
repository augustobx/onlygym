import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { checkBranchSchedule } from "@/lib/access-schedule";
import { membershipSnapshot } from "@/lib/membership-state";
import { getMemberAccessSigningSecret, isMemberAccessToken, verifyMemberAccessToken } from "@/lib/member-access-token";
import { getTenantModules } from "@/lib/tenant-context";
import { getTenantSlugFromRequest } from "@/lib/request-tenant";

/**
 * POST /api/v1/accesos/validar
 * Endpoint para torniquetes físicos, molinetes y lectores RFID/QR externos.
 * Acepta DNI tradicional o el carnet QR firmado del portal del socio.
 */
export async function POST(req: Request) {
  const auth = validateApiKey(req);
  if (!auth.valid) return auth.errorResponse!;

  const tenantSlug = getTenantSlugFromRequest(req);
  if (!tenantSlug) {
    return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Tenant inválido" }, { status: 404 });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Formato JSON inválido" }, { status: 400 });
    }

    const credencial = typeof body.documento === "string" ? body.documento.trim() : "";
    const sucursalId = Number(body.sucursalId);
    if (!credencial) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Parámetro 'documento' o credencial QR requerido" }, { status: 400 });
    }
    if (!Number.isInteger(sucursalId) || sucursalId < 1) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "sucursalId requerido e inválido" }, { status: 400 });
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: {
        id: sucursalId,
        estado: "activo",
        tenant: { slug: tenantSlug, estado: { in: ["activo", "prueba"] } },
      },
      select: { id: true, tenantId: true },
    });
    if (!sucursal) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Sucursal no disponible para este tenant" }, { status: 404 });
    }

    const modules = await getTenantModules(sucursal.tenantId);
    if (!modules.accesos) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Módulo de accesos deshabilitado" }, { status: 403 });
    }

    let clienteId: number | null = null;
    if (isMemberAccessToken(credencial)) {
      const payload = verifyMemberAccessToken(credencial, getMemberAccessSigningSecret());
      if (!payload) {
        return NextResponse.json({ autorizado: false, abrirRele: false, estado: "DENEGADO", motivo: "Carnet QR vencido o inválido" });
      }
      if (payload.tenantId !== sucursal.tenantId) {
        return NextResponse.json({ autorizado: false, abrirRele: false, estado: "DENEGADO", motivo: "Carnet de otro gimnasio" });
      }
      clienteId = payload.clienteId;
    }

    const cliente = await prisma.cliente.findFirst({
      where: {
        tenantId: sucursal.tenantId,
        ...(clienteId ? { id: clienteId } : { documento: credencial }),
        sucursales: { some: { id: sucursalId } },
      },
      include: { pagos: { where: { tenantId: sucursal.tenantId }, orderBy: { fechaVencimiento: "desc" }, take: 1 } },
    });

    if (!cliente) {
      return NextResponse.json({ autorizado: false, abrirRele: false, estado: "NO_ENCONTRADO", motivo: "La credencial no corresponde a un socio habilitado en esta sede" });
    }
    if (cliente.estado !== "activo") {
      return NextResponse.json({
        autorizado: false,
        abrirRele: false,
        estado: "INACTIVO",
        motivo: "El socio se encuentra inactivo o bloqueado",
        cliente: { nombre: cliente.nombre, apellido: cliente.apellido, documento: cliente.documento },
      });
    }

    const horario = await checkBranchSchedule(sucursal.tenantId, sucursalId);
    if (!horario.permitido) {
      await prisma.ingreso.create({
        data: {
          tenantId: sucursal.tenantId,
          clienteId: cliente.id,
          sucursalId,
          documento: cliente.documento,
          estado: "DENEGADO",
          motivo: horario.motivo || "Fuera de horario de atención",
        },
      });
      return NextResponse.json({
        autorizado: false,
        abrirRele: false,
        estado: "DENEGADO",
        motivo: horario.motivo || "Gimnasio fuera de horario de atención",
        cliente: { nombre: cliente.nombre, apellido: cliente.apellido, documento: cliente.documento, foto: cliente.foto },
      });
    }

    const now = new Date();
    const membership = membershipSnapshot(cliente.pagos[0]?.fechaVencimiento || null, now);
    const autorizado = membership.active;
    const estadoAcceso = autorizado ? "ACTIVO" : "VENCIDO";
    let motivo = autorizado && membership.expiration
      ? `Acceso permitido. Vence el ${membership.expiration.toLocaleDateString("es-AR")}`
      : "No tiene membresías activas";
    let diasVencido: number | null = null;

    if (!autorizado && membership.expiration) {
      diasVencido = Math.max(1, Math.ceil((now.getTime() - membership.expiration.getTime()) / 86_400_000));
      motivo = `Membresía vencida hace ${diasVencido} día(s)`;
    }

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const alreadyAwarded = autorizado
      ? await prisma.ingreso.findFirst({
          where: { tenantId: sucursal.tenantId, clienteId: cliente.id, estado: "ACTIVO", fechaHora: { gte: startOfDay } },
          select: { id: true },
        })
      : null;

    const ingreso = await prisma.$transaction(async (tx) => {
      const created = await tx.ingreso.create({
        data: {
          tenantId: sucursal.tenantId,
          clienteId: cliente.id,
          sucursalId,
          documento: cliente.documento,
          estado: estadoAcceso,
          motivo: estadoAcceso === "ACTIVO" ? "Ingreso regular" : motivo,
          diasVencido,
        },
      });

      if (autorizado) {
        const classBooking = await tx.reservaClase.findFirst({
          where: {
            tenantId: sucursal.tenantId,
            clienteId: cliente.id,
            estado: "confirmada",
            clase: {
              tenantId: sucursal.tenantId,
              inicio: { gte: new Date(now.getTime() - 30 * 60_000), lte: new Date(now.getTime() + 90 * 60_000) },
              sucursalId,
            },
          },
          orderBy: { clase: { inicio: "asc" } },
        });
        if (classBooking) {
          await tx.reservaClase.updateMany({
            where: { id: classBooking.id, tenantId: sucursal.tenantId, clienteId: cliente.id },
            data: { estado: "asistio", asistenciaEn: now },
          });
        }
      }

      if (autorizado && !alreadyAwarded && modules.puntos) {
        await tx.movimientoPuntos.create({
          data: {
            tenantId: sucursal.tenantId,
            clienteId: cliente.id,
            puntos: 10,
            tipo: "asistencia",
            concepto: "Visita al gimnasio",
            referencia: `ingreso:${created.id}`,
          },
        });
      }
      return created;
    });

    return NextResponse.json({
      autorizado,
      abrirRele: autorizado,
      estado: estadoAcceso,
      motivo,
      cliente: { id: cliente.id, nombre: cliente.nombre, apellido: cliente.apellido, documento: cliente.documento, foto: cliente.foto },
      ingresoId: ingreso.id,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Error en API validar acceso:", error);
    return NextResponse.json({ error: "Error interno del servidor", status: 500 }, { status: 500 });
  }
}
