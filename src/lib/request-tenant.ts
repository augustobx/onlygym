import "server-only";

import { headers } from "next/headers";
import { resolveTenantSlugForHost } from "@/lib/tenant-host";
import { getAuthoritativeRequestHost, normalizeRequestHost } from "@/lib/request-host";

export { normalizeRequestHost } from "@/lib/request-host";

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

export function getPlatformHostname() {
  const baseDomain = (process.env.TENANT_BASE_DOMAIN || "nanoapps.ar").trim().toLowerCase().replace(/^\.+/, "");
  return normalizeRequestHost(process.env.PLATFORM_DOMAIN || `onlygym.${baseDomain}`);
}

export function resolveRequestTenantSlug(hostValue: string | null) {
  const hostname = normalizeRequestHost(hostValue);
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

export function getTenantSlugFromRequest(request: Request) {
  return resolveRequestTenantSlug(getAuthoritativeRequestHost(request.headers));
}

export async function getRequestHostname() {
  return getAuthoritativeRequestHost(await headers());
}

export async function isPlatformRequestHost() {
  const hostname = await getRequestHostname();
  if (!hostname) return false;
  if (process.env.NODE_ENV !== "production" && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")) {
    return true;
  }
  return hostname === getPlatformHostname();
}

export async function requirePlatformRequestHost() {
  if (!(await isPlatformRequestHost())) {
    throw new Error("Operación disponible únicamente desde el dominio de plataforma");
  }
}

export async function getRequestTenantSlug() {
  const hostname = await getRequestHostname();
  return resolveRequestTenantSlug(hostname);
}
