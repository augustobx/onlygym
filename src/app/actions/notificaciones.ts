"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireMemberContext } from "@/lib/member-context";
import { requireStaffContext } from "@/lib/tenant-context";
import { sendMemberPush } from "@/lib/web-push";
import type { Prisma } from "@prisma/client";

export async function marcarNotificacionLeida(id: number) {
  try {
    const context = await requireMemberContext();
    await prisma.notificacion.updateMany({
      where: { id, clienteId: context.clienteId, tenantId: context.tenantId },
      data: { leidaEn: new Date() },
    });
    return { success: true };
  } catch {
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
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function enviarNotificacionSocio(input: {
  tenantId?: number;
  clienteId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  canal?: "in_app" | "push" | "whatsapp" | "email";
  datos?: Prisma.InputJsonValue;
}) {
  try {
    const context = await requireStaffContext();
    if (input.tenantId !== undefined && input.tenantId !== context.tenantId) {
      return { success: false, error: "Tenant no autorizado" };
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: input.clienteId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado" };

    const canal = input.canal || "in_app";
    const notif = await prisma.$transaction(async (tx) => {
      const notification = await tx.notificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          tipo: input.tipo,
          titulo: input.titulo,
          mensaje: input.mensaje,
          ...(input.datos !== undefined ? { datos: input.datos } : {}),
        },
      });

      if (canal !== "push") {
        await tx.registroNotificacion.create({
          data: {
            tenantId: context.tenantId,
            clienteId: cliente.id,
            canal,
            tipo: input.tipo,
            titulo: input.titulo,
            mensaje: input.mensaje,
            estado: canal === "in_app" ? "enviado" : "pendiente",
            ...(canal === "in_app" ? {} : { error: `${canal} todavía no tiene transport configurado` }),
          },
        });
      }
      return notification;
    });

    if (canal === "push") {
      const datos = input.datos && typeof input.datos === "object" && !Array.isArray(input.datos)
        ? input.datos as Record<string, unknown>
        : {};
      const push = await sendMemberPush({
        tenantId: context.tenantId,
        clienteId: cliente.id,
        title: input.titulo,
        body: input.mensaje,
        url: typeof datos.url === "string" ? datos.url : "/portal/dashboard",
        tag: `${input.tipo}:${notif.id}`,
      });
      await prisma.registroNotificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          canal: "push",
          tipo: input.tipo,
          titulo: input.titulo,
          mensaje: input.mensaje,
          estado: push.sent > 0 ? "enviado" : push.configured ? "sin_dispositivo" : "no_configurado",
          error: push.sent > 0 ? null : push.error || (push.subscriptions === 0 ? "El socio no tiene dispositivos suscriptos" : `${push.failed} envío(s) fallaron`),
        },
      });
      return { success: true, data: serializeData(notif), push };
    }

    return { success: true, data: serializeData(notif) };
  } catch (error) {
    console.error("Error enviando notificación:", error);
    return { success: false, error: "Error al enviar notificación" };
  }
}
