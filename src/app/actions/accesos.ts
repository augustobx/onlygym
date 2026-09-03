"use server";

import { RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkBranchSchedule } from "@/lib/access-schedule";
import { membershipSnapshot } from "@/lib/membership-state";
import { getMemberAccessSigningSecret, isMemberAccessToken, verifyMemberAccessToken } from "@/lib/member-access-token";
import { getTenantModules, requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

const ACCESS_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];

export async function registrarIngresoMolinete(credencial: string, sucursalId: number) {
  try {
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
      return { success: false, estado: "ERROR", error: "Sede inválida" };
    }

    const context = await requireStaffContext({ roles: ACCESS_ROLES, branchId: sucursalId });
    await requireTenantModule(context.tenantId, "accesos");

    const rawCredential = credencial.trim();
    if (!rawCredential) return { success: false, estado: "ERROR", error: "Ingresá un DNI o escaneá el carnet QR" };

    let clienteId: number | null = null;
    if (isMemberAccessToken(rawCredential)) {
      const payload = verifyMemberAccessToken(rawCredential, getMemberAccessSigningSecret());
      if (!payload) return { success: false, estado: "DENEGADO", error: "El carnet QR venció o es inválido" };
      if (payload.tenantId !== context.tenantId) {
        return { success: false, estado: "DENEGADO", error: "El carnet pertenece a otro gimnasio" };
      }
      clienteId = payload.clienteId;
    }

    const cliente = await prisma.cliente.findFirst({
      where: {
        tenantId: context.tenantId,
        ...(clienteId ? { id: clienteId } : { documento: rawCredential }),
        sucursales: { some: { id: sucursalId } },
      },
      include: { pagos: { orderBy: { fechaVencimiento: "desc" }, take: 1 } },
    });

    if (!cliente) {
      return { success: false, estado: "NO_ENCONTRADO", error: "La credencial no corresponde a un socio habilitado en esta sede" };
    }
    if (cliente.estado !== "activo") {
      return { success: false, estado: "INACTIVO", error: "El socio está inactivo o bloqueado" };
    }

    const horario = await checkBranchSchedule(context.tenantId, sucursalId);
    if (!horario.permitido) {
      await prisma.ingreso.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          sucursalId,
          documento: cliente.documento,
          estado: "DENEGADO",
          motivo: horario.motivo || "Fuera de horario de atención",
        },
      });
      return {
        success: false,
        estado: "DENEGADO",
        error: horario.motivo || "Gimnasio fuera de horario de atención",
        cliente: { nombre: cliente.nombre, apellido: cliente.apellido, documento: cliente.documento, foto: cliente.foto },
      };
    }

    const now = new Date();
    const payment = cliente.pagos[0] || null;
    const membership = membershipSnapshot(payment?.fechaVencimiento || null, now);
    let estadoAcceso = membership.active ? "ACTIVO" : "VENCIDO";
    let mensaje = membership.active && membership.expiration
      ? `Acceso permitido. Vence el ${membership.expiration.toLocaleDateString("es-AR")}`
      : "No tiene membresías activas";
    let diasVencido: number | null = null;

    if (!membership.active && membership.expiration) {
      const diffMs = now.getTime() - membership.expiration.getTime();
      diasVencido = Math.max(1, Math.ceil(diffMs / 86_400_000));
      mensaje = `Membresía vencida hace ${diasVencido} día(s) (${membership.expiration.toLocaleDateString("es-AR")})`;
    }

    const inicioDia = new Date(now);
    inicioDia.setHours(0, 0, 0, 0);
    const visitaPuntuada = estadoAcceso === "ACTIVO"
      ? await prisma.ingreso.findFirst({
          where: { tenantId: context.tenantId, clienteId: cliente.id, estado: "ACTIVO", fechaHora: { gte: inicioDia } },
          select: { id: true },
        })
      : null;
    const modules = await getTenantModules(context.tenantId);

    const ingreso = await prisma.$transaction(async (tx) => {
      const created = await tx.ingreso.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          sucursalId,
          documento: cliente.documento,
          estado: estadoAcceso,
          motivo: estadoAcceso === "ACTIVO" ? "Ingreso regular" : mensaje,
          diasVencido,
        },
      });

      if (estadoAcceso === "ACTIVO") {
        const classBooking = await tx.reservaClase.findFirst({
          where: {
            tenantId: context.tenantId,
            clienteId: cliente.id,
            estado: "confirmada",
            clase: {
              inicio: { gte: new Date(now.getTime() - 30 * 60_000), lte: new Date(now.getTime() + 90 * 60_000) },
              sucursalId,
            },
          },
          orderBy: { clase: { inicio: "asc" } },
        });
        if (classBooking) {
          await tx.reservaClase.updateMany({
            where: { id: classBooking.id, tenantId: context.tenantId, clienteId: cliente.id },
            data: { estado: "asistio", asistenciaEn: now },
          });
        }
      }

      if (estadoAcceso === "ACTIVO" && !visitaPuntuada && modules.puntos) {
        await tx.movimientoPuntos.create({
          data: {
            tenantId: context.tenantId,
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

    revalidatePath("/dashboard");
    revalidatePath("/molinete");

    return {
      success: estadoAcceso === "ACTIVO",
      estado: estadoAcceso,
      mensaje,
      diasVencido,
      ingresoId: ingreso.id,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        documento: cliente.documento,
        foto: cliente.foto,
      },
    };
  } catch (error) {
    console.error("Error registrando ingreso en molinete:", error);
    return { success: false, estado: "ERROR", error: error instanceof Error ? error.message : "Error al procesar el ingreso" };
  }
}

export async function getUltimosIngresos(sucursalId: number) {
  try {
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) return { success: false, error: "Sede inválida" };
    const context = await requireStaffContext({ roles: ACCESS_ROLES, branchId: sucursalId });
    await requireTenantModule(context.tenantId, "accesos");
    const ingresos = await prisma.ingreso.findMany({
      where: { tenantId: context.tenantId, sucursalId },
      orderBy: { fechaHora: "desc" },
      take: 8,
      include: { cliente: { select: { nombre: true, apellido: true } } },
    });
    return { success: true, data: ingresos };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cargar historial" };
  }
}
