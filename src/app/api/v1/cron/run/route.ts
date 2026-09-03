import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { sendMemberPush } from "@/lib/web-push";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function registerPushDelivery(input: {
  tenantId: number;
  clienteId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  url: string;
  tag: string;
}) {
  const push = await sendMemberPush({
    tenantId: input.tenantId,
    clienteId: input.clienteId,
    title: input.titulo,
    body: input.mensaje,
    url: input.url,
    tag: input.tag,
  });
  await prisma.registroNotificacion.create({
    data: {
      tenantId: input.tenantId,
      clienteId: input.clienteId,
      canal: "push",
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      estado: push.sent > 0 ? "enviado" : push.configured ? "sin_dispositivo" : "no_configurado",
      error: push.sent > 0 ? null : push.error || (push.subscriptions === 0 ? "El socio no tiene dispositivos suscriptos" : `${push.failed} envío(s) fallaron`),
    },
  });
  return push;
}

async function handleCron(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) return auth.errorResponse!;

  try {
    const now = new Date();
    const results = {
      recordatoriosClases: 0,
      vencimientosNotificados: 0,
      pushEnviados: 0,
      pushFallidos: 0,
      gimnasiosSuspendidos: 0,
      ejecutadoEn: now.toISOString(),
    };

    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const upcomingClasses = await prisma.clase.findMany({
      where: {
        inicio: { gte: in1Hour, lte: in3Hours },
        estado: "programada",
        tenant: { estado: { in: ["activo", "prueba"] } },
      },
      include: {
        tipoClase: true,
        sucursal: true,
        reservas: {
          where: { estado: "confirmada" },
          include: { cliente: true },
        },
      },
    });

    for (const c of upcomingClasses) {
      for (const res of c.reservas) {
        if (res.cliente.tenantId !== c.tenantId) continue;
        const existing = await prisma.notificacion.findFirst({
          where: {
            tenantId: c.tenantId,
            clienteId: res.clienteId,
            tipo: "recordatorio_clase",
            datos: { path: ["claseId"], equals: c.id },
          },
        });

        if (!existing) {
          const horaStr = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(c.inicio));
          const titulo = `Recordatorio: Clase de ${c.tipoClase.nombre}`;
          const mensaje = `Tu clase comienza a las ${horaStr} en ${c.sucursal.nombre}. ¡Te esperamos!`;
          const notification = await prisma.notificacion.create({
            data: {
              tenantId: c.tenantId,
              clienteId: res.clienteId,
              tipo: "recordatorio_clase",
              titulo,
              mensaje,
              datos: { claseId: c.id, url: "/portal/dashboard" },
            },
          });
          const push = await registerPushDelivery({
            tenantId: c.tenantId,
            clienteId: res.clienteId,
            tipo: "recordatorio_clase",
            titulo,
            mensaje,
            url: "/portal/dashboard",
            tag: `recordatorio_clase:${notification.id}`,
          });
          results.pushEnviados += push.sent;
          results.pushFallidos += push.failed;
          results.recordatoriosClases++;
        }
      }
    }

    const in3Days = new Date(now.getTime() + 3 * 86400000);
    const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hoyFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const expiringPayments = await prisma.pago.findMany({
      where: {
        estado: "pagado",
        fechaVencimiento: { gte: hoyInicio, lte: in3Days },
        tenant: { estado: { in: ["activo", "prueba"] } },
      },
      include: { cliente: true, membresia: true },
    });

    for (const pago of expiringPayments) {
      if (pago.cliente.tenantId !== pago.tenantId || pago.membresia.tenantId !== pago.tenantId) continue;
      const isToday = pago.fechaVencimiento >= hoyInicio && pago.fechaVencimiento <= hoyFin;
      const tipo = isToday ? "vencimiento_hoy" : "vencimiento_proximo";

      const existingNotif = await prisma.notificacion.findFirst({
        where: {
          tenantId: pago.tenantId,
          clienteId: pago.clienteId,
          tipo,
          creadaEn: { gte: hoyInicio },
        },
      });

      if (!existingNotif) {
        const fechaStr = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(pago.fechaVencimiento));
        const titulo = isToday ? "Tu membresía vence hoy" : "Tu membresía está por vencer";
        const mensaje = isToday
          ? `Tu plan ${pago.membresia.nombre} vence hoy. Renová en recepción para seguir entrenando.`
          : `Tu plan ${pago.membresia.nombre} vence el ${fechaStr}. ¡Renová con anticipación!`;
        const notification = await prisma.notificacion.create({
          data: {
            tenantId: pago.tenantId,
            clienteId: pago.clienteId,
            tipo,
            titulo,
            mensaje,
            datos: { pagoId: pago.id, url: "/portal/cuenta" },
          },
        });
        const push = await registerPushDelivery({
          tenantId: pago.tenantId,
          clienteId: pago.clienteId,
          tipo,
          titulo,
          mensaje,
          url: "/portal/cuenta",
          tag: `${tipo}:${notification.id}`,
        });
        results.pushEnviados += push.sent;
        results.pushFallidos += push.failed;
        results.vencimientosNotificados++;
      }
    }

    const gracePeriodLimit = new Date(now.getTime() - 3 * 86400000);
    const expiredTenants = await prisma.tenant.findMany({
      where: {
        estado: { in: ["activo", "prueba"] },
        fechaVencimiento: { lte: gracePeriodLimit },
      },
    });

    for (const t of expiredTenants) {
      await prisma.$transaction([
        prisma.tenant.update({ where: { id: t.id }, data: { estado: "suspendido" } }),
        prisma.suscripcionSaaS.updateMany({
          where: { tenantId: t.id, estado: { in: ["activa", "prueba"] } },
          data: { estado: "suspendida" },
        }),
      ]);
      results.gimnasiosSuspendidos++;
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    console.error("Error en ejecución programada de cron:", error);
    return NextResponse.json({ status: "error", error: "Error en cron" }, { status: 500 });
  }
}
