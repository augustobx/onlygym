import "server-only";

import { headers } from "next/headers";
import { resolveTenantSlugForHost } from "@/lib/tenant-host";

const RESERVED_SLUGS = new Set([
  "admin",
  "superadmin",
  "api",
  "app",
  "dashboard",
  "portal",
  "status",
  "health",
  "mail",
  "cdn",
  "onlygym",
]);

function normalizeHost(value: string | null) {
  if (!value) return "";
  return value.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export async function getRequestTenantSlug() {
  const requestHeaders = await headers();
  const hostname = normalizeHost(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"),
  );

  if (!hostname) return null;

  const slug = resolveTenantSlugForHost({
    hostname,
    baseDomain: process.env.TENANT_BASE_DOMAIN || "nanoapps.ar",
    hostMap: process.env.TENANT_HOST_MAP,
    localDefaultSlug: process.env.DEFAULT_TENANT_SLUG || "onlygym-demo",
    production: process.env.NODE_ENV === "production",
  });

  if (!slug || RESERVED_SLUGS.has(slug)) return null;
  return slug;
}
