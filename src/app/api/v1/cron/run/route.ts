import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const apiKeyParam = request.nextUrl.searchParams.get("key");
    const secretKey = process.env.API_SECRET_KEY || "onlygym-api-secret-key-default";

    const isAuthorized =
      authHeader === `Bearer ${secretKey}` ||
      apiKeyParam === secretKey ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const results = {
      recordatoriosClases: 0,
      vencimientosNotificados: 0,
      gimnasiosSuspendidos: 0,
      ejecutadoEn: now.toISOString(),
    };

    // ========================================================
    // 1. Recordatorios de clases próximas (2 horas antes)
    // ========================================================
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const upcomingClasses = await prisma.clase.findMany({
      where: {
        inicio: { gte: in1Hour, lte: in3Hours },
        estado: "programada",
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
        // Verificar si ya se envió notificación
        const existing = await prisma.notificacion.findFirst({
          where: {
            clienteId: res.clienteId,
            tipo: "recordatorio_clase",
            datos: { path: ["claseId"], equals: c.id },
          },
        });

        if (!existing) {
          const horaStr = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(
            new Date(c.inicio)
          );
          await prisma.notificacion.create({
            data: {
              tenantId: c.tenantId,
              clienteId: res.clienteId,
              tipo: "recordatorio_clase",
              titulo: `Recordatorio: Clase de ${c.tipoClase.nombre}`,
              mensaje: `Tu clase comienza a las ${horaStr} en ${c.sucursal.nombre}. ¡Te esperamos!`,
              datos: { claseId: c.id },
            },
          });
          results.recordatoriosClases++;
        }
      }
    }

    // ========================================================
    // 2. Avisos de vencimiento de membresías (3 días antes y hoy)
    // ========================================================
    const in3Days = new Date(now.getTime() + 3 * 86400000);
    const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hoyFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const expiringPayments = await prisma.pago.findMany({
      where: {
        estado: "pagado",
        fechaVencimiento: {
          gte: hoyInicio,
          lte: in3Days,
        },
      },
      include: { cliente: true, membresia: true },
    });

    for (const pago of expiringPayments) {
      const isToday =
        pago.fechaVencimiento >= hoyInicio && pago.fechaVencimiento <= hoyFin;
      const tipo = isToday ? "vencimiento_hoy" : "vencimiento_proximo";

      const existingNotif = await prisma.notificacion.findFirst({
        where: {
          clienteId: pago.clienteId,
          tipo,
          creadaEn: { gte: hoyInicio },
        },
      });

      if (!existingNotif) {
        const fechaStr = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(
          new Date(pago.fechaVencimiento)
        );
        await prisma.notificacion.create({
          data: {
            tenantId: pago.tenantId,
            clienteId: pago.clienteId,
            tipo,
            titulo: isToday ? "Tu membresía vence hoy" : "Tu membresía está por vencer",
            mensaje: isToday
              ? `Tu plan ${pago.membresia.nombre} vence hoy. Renueva en recepción para seguir entrenando.`
              : `Tu plan ${pago.membresia.nombre} vence el ${fechaStr}. ¡Renueva con anticipación!`,
            datos: { pagoId: pago.id },
          },
        });
        results.vencimientosNotificados++;
      }
    }

    // ========================================================
    // 3. Suspensión automática de gimnasios SaaS vencidos (+3 días gracia)
    // ========================================================
    const gracePeriodLimit = new Date(now.getTime() - 3 * 86400000);

    const expiredTenants = await prisma.tenant.findMany({
      where: {
        estado: { in: ["activo", "prueba"] },
        fechaVencimiento: { lte: gracePeriodLimit },
      },
    });

    for (const t of expiredTenants) {
      await prisma.tenant.update({
        where: { id: t.id },
        data: { estado: "suspendido" },
      });

      await prisma.suscripcionSaaS.updateMany({
        where: { tenantId: t.id, estado: { in: ["activa", "prueba"] } },
        data: { estado: "suspendida" },
      });

      results.gimnasiosSuspendidos++;
    }

    return NextResponse.json({
      status: "ok",
      results,
    });
  } catch (error) {
    console.error("Error en ejecución programada de cron:", error);
    return NextResponse.json({ status: "error", error: "Error en cron" }, { status: 500 });
  }
}
