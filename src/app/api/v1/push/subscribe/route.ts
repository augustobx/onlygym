import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";

function validEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length < 16 || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validKey(value: unknown) {
  return typeof value === "string" && value.length >= 8 && value.length <= 512;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireMemberContext();
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) {
      return NextResponse.json({ error: "Datos de suscripción inválidos" }, { status: 400 });
    }

    const existing = await prisma.webPushSubscription.findUnique({ where: { endpoint } });
    if (existing && (existing.tenantId !== context.tenantId || existing.clienteId !== context.clienteId)) {
      return NextResponse.json({ error: "La suscripción pertenece a otra sesión" }, { status: 409 });
    }

    const subscription = existing
      ? await prisma.webPushSubscription.update({ where: { id: existing.id }, data: { p256dh, auth } })
      : await prisma.webPushSubscription.create({
          data: { tenantId: context.tenantId, clienteId: context.clienteId, endpoint, p256dh, auth },
        });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch {
    return NextResponse.json({ error: "No autorizado o error guardando suscripción" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireMemberContext();
    const body = await request.json();
    const endpoint = body?.endpoint;
    if (!validEndpoint(endpoint)) return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });

    const result = await prisma.webPushSubscription.deleteMany({
      where: { endpoint, tenantId: context.tenantId, clienteId: context.clienteId },
    });
    return NextResponse.json({ success: true, removed: result.count });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
