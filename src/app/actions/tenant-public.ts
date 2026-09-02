"use server";

import { getRequestTenantLifecycle } from "@/lib/tenant-lifecycle";
import { isPlatformRequestHost } from "@/lib/request-tenant";

export async function getPublicTenantStatus() {
  if (await isPlatformRequestHost()) return { scope: "platform" as const, status: "invalid" as const };
  const lifecycle = await getRequestTenantLifecycle();
  return {
    scope: lifecycle.tenant ? "tenant" as const : "invalid" as const,
    status: lifecycle.status,
  };
}
