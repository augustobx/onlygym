export function parseTenantHostMap(raw: string | undefined) {
  const entries = (raw || "").split(",").map((item) => item.trim()).filter(Boolean);
  return new Map(entries.flatMap((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return [];
    const host = entry.slice(0, separator).trim().toLowerCase();
    const slug = entry.slice(separator + 1).trim().toLowerCase();
    return host && slug ? [[host, slug] as const] : [];
  }));
}

export function resolveTenantSlugForHost(input: {
  hostname: string;
  baseDomain?: string;
  hostMap?: string;
  localDefaultSlug?: string;
  production: boolean;
}) {
  const hostname = input.hostname.toLowerCase().replace(/\.$/, "");
  const explicit = parseTenantHostMap(input.hostMap).get(hostname);
  if (explicit) return explicit;

  const baseDomain = input.baseDomain?.toLowerCase().replace(/^\./, "");
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (subdomain && !subdomain.includes(".")) return subdomain;
  }

  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!input.production && isLocal) return input.localDefaultSlug || "onlygym-demo";
  return null;
}
