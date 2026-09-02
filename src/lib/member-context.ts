import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getRequestTenantSlug } from "@/lib/request-tenant";

export const MEMBER_SESSION_COOKIE = "onlygym_member_session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveTenantForMemberLogin() {
  const slug = await getRequestTenantSlug();
  if (!slug) return null;
  return prisma.tenant.findFirst({
    where: { slug, estado: { in: ["activo", "prueba"] } },
    select: { id: true, slug: true, nombre: true },
  });
}

export async function requireMemberContext() {
  const requestTenantSlug = await getRequestTenantSlug();
  if (!requestTenantSlug) throw new Error("Tenant inválido");

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

  const tenantOperational = memberSession?.tenant.estado === "activo" || memberSession?.tenant.estado === "prueba";
  if (
    !memberSession ||
    memberSession.expiraEn <= new Date() ||
    !tenantOperational ||
    memberSession.tenant.slug !== requestTenantSlug ||
    memberSession.cliente.estado !== "activo" ||
    memberSession.cliente.tenantId !== memberSession.tenantId
  ) {
    cookieStore.delete(MEMBER_SESSION_COOKIE);
    throw new Error("Sesión vencida o inválida para este gimnasio");
  }

  return {
    sessionId: memberSession.id,
    tenantId: memberSession.tenantId,
    tenant: memberSession.tenant,
    clienteId: memberSession.clienteId,
  };
}
