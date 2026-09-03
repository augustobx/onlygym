import "server-only";

import { prisma } from "@/lib/prisma";
import { createVapidAuthorization, encryptWebPushPayload, type WebPushKeys } from "@/lib/web-push-crypto";

export type MemberPushInput = {
  tenantId: number;
  clienteId: number;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type MemberPushResult = {
  configured: boolean;
  subscriptions: number;
  sent: number;
  failed: number;
  removed: number;
  error?: string;
};

function getWebPushKeys(): WebPushKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

function safePortalUrl(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/portal/dashboard";
  return value.startsWith("/portal/") ? value : "/portal/dashboard";
}

async function sendOne(
  subscription: { id: number; endpoint: string; p256dh: string; auth: string },
  keys: WebPushKeys,
  payload: string,
) {
  const encrypted = encryptWebPushPayload({ p256dh: subscription.p256dh, auth: subscription.auth }, payload);
  const authorization = createVapidAuthorization(subscription.endpoint, keys);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "300",
      Urgency: "normal",
    },
    body: new Uint8Array(encrypted),
    signal: AbortSignal.timeout(10_000),
  });
  return response.status;
}

export async function sendMemberPush(input: MemberPushInput): Promise<MemberPushResult> {
  const keys = getWebPushKeys();
  if (!keys) {
    return { configured: false, subscriptions: 0, sent: 0, failed: 0, removed: 0, error: "VAPID no configurado" };
  }

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { tenantId: input.tenantId, clienteId: input.clienteId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (!subscriptions.length) return { configured: true, subscriptions: 0, sent: 0, failed: 0, removed: 0 };

  const payload = JSON.stringify({
    title: input.title.slice(0, 140),
    body: input.body.slice(0, 700),
    url: safePortalUrl(input.url),
    ...(input.tag ? { tag: input.tag.slice(0, 120) } : {}),
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      const status = await sendOne(subscription, keys, payload);
      if (status >= 200 && status < 300) {
        sent++;
        continue;
      }
      failed++;
      if (status === 404 || status === 410) {
        await prisma.webPushSubscription.deleteMany({
          where: { id: subscription.id, tenantId: input.tenantId, clienteId: input.clienteId },
        });
        removed++;
      }
    } catch (error) {
      failed++;
      console.error("Error enviando Web Push:", error instanceof Error ? error.message : error);
    }
  }

  return { configured: true, subscriptions: subscriptions.length, sent, failed, removed };
}
