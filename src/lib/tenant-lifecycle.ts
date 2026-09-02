import "server-only";

import { prisma } from "@/lib/prisma";
import { getRequestTenantSlug } from "@/lib/request-tenant";

export type TenantLifecycleStatus = "operational" | "suspended" | "cancelled" | "invalid";

export function classifyTenantState(state: string | null | undefined): TenantLifecycleStatus {
  if (state === "activo" || state === "prueba") return "operational";
  if (state === "suspendido") return "suspended";
  if (state === "cancelado") return "cancelled";
  return "invalid";
}

export async function getRequestTenantLifecycle() {
  const slug = await getRequestTenantSlug();
  if (!slug) return { status: "invalid" as const, tenant: null };

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, nombre: true, estado: true, fechaVencimiento: true },
  });

  if (!tenant) return { status: "invalid" as const, tenant: null };
  return { status: classifyTenantState(tenant.estado), tenant };
}
