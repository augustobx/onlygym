import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";
import { resolveTenantSlugForHost } from "@/lib/tenant-host";

export const MEMBER_SESSION_COOKIE = "onlygym_member_session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveTenantForMemberLogin() {
  const requestHeaders = await headers();
  const hostname = (requestHeaders.get("host") || "localhost").split(":")[0].toLowerCase();
  const slug = resolveTenantSlugForHost({
    hostname,
    baseDomain: process.env.TENANT_BASE_DOMAIN,
    hostMap: process.env.TENANT_HOST_MAP,
    localDefaultSlug: process.env.DEFAULT_TENANT_SLUG,
    production: process.env.NODE_ENV === "production",
  });
  if (!slug) return null;

  return prisma.tenant.findFirst({
    where: { slug, estado: "activo" },
    select: { id: true, slug: true, nombre: true },
  });
}

export async function requireMemberContext() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!rawToken) throw new Error("No autorizado");

  const memberSession = await prisma.sesionSocio.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    include: {
      tenant: { select: { id: true, slug: true, nombre: true, estado: true, modulos: true } },
      cliente: { select: { id: true, estado: true, tenantId: true } },
    },
  });

  if (!memberSession || memberSession.expiraEn <= new Date() || memberSession.tenant.estado !== "activo" || memberSession.cliente.estado !== "activo" || memberSession.cliente.tenantId !== memberSession.tenantId) {
    cookieStore.delete(MEMBER_SESSION_COOKIE);
    throw new Error("Sesión vencida");
  }

  return {
    sessionId: memberSession.id,
    tenantId: memberSession.tenantId,
    tenant: memberSession.tenant,
    clienteId: memberSession.clienteId,
  };
}
