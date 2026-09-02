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

export function normalizeRequestHost(value: string | null) {
  if (!value) return "";
  return value.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function getPlatformHostname() {
  const baseDomain = (process.env.TENANT_BASE_DOMAIN || "nanoapps.ar").trim().toLowerCase().replace(/^\.+/, "");
  return normalizeRequestHost(process.env.PLATFORM_DOMAIN || `onlygym.${baseDomain}`);
}

export async function getRequestHostname() {
  const requestHeaders = await headers();
  return normalizeRequestHost(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"),
  );
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
