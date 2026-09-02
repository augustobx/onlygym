export function normalizeRequestHost(value: string | null | undefined) {
  if (!value) return "";
  let raw = value.trim().toLowerCase();
  if (!raw || raw.includes(",")) return "";

  raw = raw.replace(/\.$/, "");

  if (raw.startsWith("[")) {
    const closing = raw.indexOf("]");
    if (closing < 0) return "";
    return raw.slice(1, closing);
  }

  return raw.replace(/:\d+$/, "");
}

export function getAuthoritativeRequestHost(requestHeaders: Pick<Headers, "get">) {
  // Host/:authority describe el destino solicitado por el cliente. No confiamos en
  // X-Forwarded-Host porque puede llegar controlado por el cliente a través del proxy.
  return normalizeRequestHost(requestHeaders.get("host"));
}
