import "server-only";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apikey",
]);

function sanitize(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value == null || depth > 4) return undefined;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitize(item, depth + 1) ?? null);
  }
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase().replaceAll("_", ""))) continue;
      const sanitized = sanitize(child, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return String(value).slice(0, 500);
}

export type AuditInput = {
  tenantId?: number | null;
  actorUserId?: string | null;
  actorClienteId?: number | null;
  accion: string;
  entidad?: string | null;
  entidadId?: string | number | null;
  resultado?: "exito" | "rechazado" | "error";
  metadata?: unknown;
  requestHeaders?: Headers;
};

export async function writeAudit(input: AuditInput) {
  try {
    const requestHeaders = input.requestHeaders ?? await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const metadata = sanitize(input.metadata);
    await prisma.auditoria.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorClienteId: input.actorClienteId ?? null,
        accion: input.accion.slice(0, 100),
        entidad: input.entidad?.slice(0, 100) ?? null,
        entidadId: input.entidadId == null ? null : String(input.entidadId).slice(0, 191),
        resultado: input.resultado ?? "exito",
        metadata,
        ip: (forwardedFor || requestHeaders.get("x-real-ip") || null)?.slice(0, 80) ?? null,
        userAgent: requestHeaders.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    // Auditing must not leak request payloads or interrupt the primary operation.
    console.error("No se pudo registrar auditoría", error instanceof Error ? error.message : "error desconocido");
  }
}
