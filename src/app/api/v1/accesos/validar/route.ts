import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { checkBranchSchedule } from "@/lib/access-schedule";
import { getTenantModules } from "@/lib/tenant-context";
import { getTenantSlugFromRequest } from "@/lib/request-tenant";

/**
 * POST /api/v1/accesos/validar
 * Endpoint para torniquetes físicos, molinetes y lectores RFID/QR externos.
 * El dispositivo sólo puede operar sobre sucursales del tenant del hostname actual.
 */
export async function POST(req: Request) {
  const auth = validateApiKey(req);
  if (!auth.valid) return auth.errorResponse!;

  const tenantSlug = getTenantSlugFromRequest(req);
  if (!tenantSlug) {
    return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Tenant inválido" }, { status: 404 });
  }

  try {
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Formato JSON inválido en el cuerpo de la petición", status: 400 }, { status: 400 });
    }

    const documento = body.documento ? String(body.documento).trim() : "";
    const sucursalId = body.sucursalId ? Number(body.sucursalId) : 1;

    if (!documento) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Parámetro 'documento' requerido" }, { status: 400 });
    }
    if (!Number.isInteger(sucursalId) || sucursalId < 1) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "sucursalId inválido" }, { status: 400 });
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: {
        id: sucursalId,
        estado: "activo",
        tenant: { slug: tenantSlug, estado: { in: ["activo", "prueba"] } },
      },
    });
    if (!sucursal) {
      return NextResponse.json({ autorizado: false, abrirRele: false, motivo: "Sucursal no disponible para este tenant" }, { status: 404 });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { tenantId: sucursal.tenantId, documento, sucursales: { some: { id: sucursalId } } },
      include: { pagos: { where: { tenantId: sucursal.tenantId }, orderBy: { fechaVencimiento: "desc" }, take: 1 } },
    });

    if (!cliente) {
      return NextResponse.json({ autorizado: false, abrirRele: false, estado: "NO_ENCONTRADO", motivo: "El documento no pertenece a ningún socio registrado" });
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

    const hoy = new Date();
    let estadoAcceso = "VENCIDO";
    let motivo = "No tiene membresías activas";
    let diasVencido: number | null = null;
    let autorizado = false;

    if (cliente.pagos.length > 0) {
      const vencimiento = new Date(cliente.pagos[0].fechaVencimiento);
      vencimiento.setHours(23, 59, 59, 999);
      if (vencimiento >= hoy) {
        estadoAcceso = "ACTIVO";
        motivo = `Acceso permitido. Vence el ${vencimiento.toLocaleDateString("es-AR")}`;
        autorizado = true;
      } else {
        const diffMs = hoy.getTime() - vencimiento.getTime();
        diasVencido = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        motivo = `Membresía vencida hace ${diasVencido} día(s)`;
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alreadyAwarded = autorizado
      ? await prisma.ingreso.findFirst({
          where: { tenantId: sucursal.tenantId, clienteId: cliente.id, estado: "ACTIVO", fechaHora: { gte: startOfDay } },
          select: { id: true },
        })
      : null;
    const modules = await getTenantModules(sucursal.tenantId);

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
            clase: { tenantId: sucursal.tenantId, inicio: { gte: new Date(Date.now() - 30 * 60000), lte: new Date(Date.now() + 90 * 60000) }, sucursalId },
          },
          orderBy: { clase: { inicio: "asc" } },
        });
        if (classBooking) {
          await tx.reservaClase.updateMany({
            where: { id: classBooking.id, tenantId: sucursal.tenantId },
            data: { estado: "asistio", asistenciaEn: new Date() },
          });
        }
      }
      if (autorizado && !alreadyAwarded && modules.puntos) {
        await tx.movimientoPuntos.create({
          data: { tenantId: sucursal.tenantId, clienteId: cliente.id, puntos: 10, tipo: "asistencia", concepto: "Visita al gimnasio", referencia: `ingreso:${created.id}` },
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en API validar acceso:", error);
    return NextResponse.json({ error: "Error interno del servidor", status: 500 }, { status: 500 });
  }
}
