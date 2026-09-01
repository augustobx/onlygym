import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";

export async function POST(request: NextRequest) {
  try {
    const context = await requireMemberContext();
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Datos de suscripción inválidos" }, { status: 400 });
    }

    const subscription = await prisma.webPushSubscription.upsert({
      where: { endpoint },
      update: {
        tenantId: context.tenantId,
        clienteId: context.clienteId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        tenantId: context.tenantId,
        clienteId: context.clienteId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    return NextResponse.json({ error: "No autorizado o error guardando suscripción" }, { status: 401 });
  }
}
