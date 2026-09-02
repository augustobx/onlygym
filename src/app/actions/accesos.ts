"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkBranchSchedule } from "@/lib/access-schedule";
import { getTenantModules, requireStaffContext } from "@/lib/tenant-context";

export async function registrarIngresoMolinete(documento: string, sucursalId: number) {
  try {
    const context = await requireStaffContext({ branchId: sucursalId });
    // Buscar cliente por documento
    const cliente = await prisma.cliente.findFirst({
      where: { tenantId: context.tenantId, documento: documento.trim(), sucursales: { some: { id: sucursalId } } },
      include: {
        pagos: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1
        }
      }
    });

    if (!cliente) {
      return { success: false, estado: "NO_ENCONTRADO", error: "El DNI ingresado no existe en el sistema." };
    }

    if (cliente.estado !== "activo") {
      return { success: false, estado: "INACTIVO", error: "El cliente está inactivo o bloqueado." };
    }

    // Verificar horario de atención de la sucursal dentro del tenant autenticado.
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
        }
      });
      return {
        success: false,
        estado: "DENEGADO",
        error: horario.motivo || "Gimnasio fuera de horario de atención",
        cliente: {
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          documento: cliente.documento,
          foto: cliente.foto
        }
      };
    }

    // Verificar estado de pagos
    const hoy = new Date();
    let estadoAcceso = "VENCIDO";
    let mensaje = "No tiene membresías activas.";
    let diasVencido: number | null = null;
    
    if (cliente.pagos.length > 0) {
      const vencimiento = new Date(cliente.pagos[0].fechaVencimiento);
      vencimiento.setHours(23, 59, 59, 999);
      
      if (vencimiento >= hoy) {
        estadoAcceso = "ACTIVO";
        mensaje = `Acceso permitido. Vence el ${vencimiento.toLocaleDateString("es-AR")}`;
      } else {
        const diffMs = hoy.getTime() - vencimiento.getTime();
        diasVencido = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        mensaje = `Membresía vencida hace ${diasVencido} día(s) (${vencimiento.toLocaleDateString("es-AR")})`;
      }
    }

    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const visitaPuntuada = estadoAcceso === "ACTIVO" ? await prisma.ingreso.findFirst({ where: { tenantId: context.tenantId, clienteId: cliente.id, estado: "ACTIVO", fechaHora: { gte: inicioDia } }, select: { id: true } }) : null;
    const modules = await getTenantModules(context.tenantId);
    const ingreso = await prisma.$transaction(async (tx) => {
      const created = await tx.ingreso.create({ data: { tenantId: context.tenantId, clienteId: cliente.id, sucursalId, documento: cliente.documento, estado: estadoAcceso, motivo: estadoAcceso === "ACTIVO" ? "Ingreso regular" : mensaje, diasVencido } });
      if (estadoAcceso === "ACTIVO") {
        const classBooking = await tx.reservaClase.findFirst({ where: { tenantId: context.tenantId, clienteId: cliente.id, estado: "confirmada", clase: { inicio: { gte: new Date(Date.now() - 30 * 60000), lte: new Date(Date.now() + 90 * 60000) }, sucursalId } }, orderBy: { clase: { inicio: "asc" } } });
        if (classBooking) await tx.reservaClase.update({ where: { id: classBooking.id }, data: { estado: "asistio", asistenciaEn: new Date() } });
      }
      if (estadoAcceso === "ACTIVO" && !visitaPuntuada && modules.puntos) {
        await tx.movimientoPuntos.create({ data: { tenantId: context.tenantId, clienteId: cliente.id, puntos: 10, tipo: "asistencia", concepto: "Visita al gimnasio", referencia: `ingreso:${created.id}` } });
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
    return { success: false, estado: "ERROR", error: "Error al procesar el ingreso." };
  }
}
