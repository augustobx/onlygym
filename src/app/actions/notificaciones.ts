"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireMemberContext } from "@/lib/member-context";
import { requireStaffContext } from "@/lib/tenant-context";

export async function marcarNotificacionLeida(id: number) {
  try {
    const context = await requireMemberContext();
    await prisma.notificacion.updateMany({
      where: { id, clienteId: context.clienteId, tenantId: context.tenantId },
      data: { leidaEn: new Date() },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "No autorizado" };
  }
}

export async function marcarTodasNotificacionesLeidas() {
  try {
    const context = await requireMemberContext();
    await prisma.notificacion.updateMany({
      where: { clienteId: context.clienteId, tenantId: context.tenantId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "No autorizado" };
  }
}

export async function enviarNotificacionSocio(input: {
  tenantId: number;
  clienteId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  canal?: "in_app" | "push" | "whatsapp" | "email";
  datos?: any;
}) {
  try {
    const notif = await prisma.notificacion.create({
      data: {
        tenantId: input.tenantId,
        clienteId: input.clienteId,
        tipo: input.tipo,
        titulo: input.titulo,
        mensaje: input.mensaje,
        datos: input.datos || null,
      },
    });

    // Registrar en auditoría de envíos de notificación
    await prisma.registroNotificacion.create({
      data: {
        tenantId: input.tenantId,
        clienteId: input.clienteId,
        canal: input.canal || "in_app",
        tipo: input.tipo,
        titulo: input.titulo,
        mensaje: input.mensaje,
        estado: "enviado",
      },
    });

    return { success: true, data: serializeData(notif) };
  } catch (error) {
    console.error("Error enviando notificación:", error);
    return { success: false, error: "Error al enviar notificación" };
  }
}
