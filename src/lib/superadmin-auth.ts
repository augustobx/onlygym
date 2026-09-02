import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requirePlatformRequestHost, isPlatformRequestHost } from "@/lib/request-tenant";
import bcrypt from "bcryptjs";

export const SUPERADMIN_COOKIE = "onlygym_superadmin_session";

function getSigningSecret() {
  const secret = process.env.SUPERADMIN_JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPERADMIN_JWT_SECRET o BETTER_AUTH_SECRET debe estar configurado en producción");
  }
  return "onlygym-superadmin-local-development-secret-change-me";
}

export function signToken(payload: string): string {
  const hmac = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64Payload, hmac] = parts;
  try {
    const payload = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const expected = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
    const hmacBuf = Buffer.from(hmac);
    const expBuf = Buffer.from(expected);
    if (hmacBuf.length !== expBuf.length || !timingSafeEqual(hmacBuf, expBuf)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSuperAdminSession(superadminId: number) {
  await requirePlatformRequestHost();
  const data = JSON.stringify({ id: superadminId, t: Date.now(), nonce: randomBytes(8).toString("hex") });
  const token = signToken(data);
  const cookieStore = await cookies();
  cookieStore.set(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

export async function clearSuperAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPERADMIN_COOKIE);
}

export async function getSuperAdminSession() {
  if (!(await isPlatformRequestHost())) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPERADMIN_COOKIE)?.value;
  if (!token) return null;
  const payloadStr = verifyToken(token);
  if (!payloadStr) return null;
  try {
    const parsed = JSON.parse(payloadStr) as { id: number; t: number };
    if (!Number.isInteger(parsed.id) || !Number.isFinite(parsed.t)) return null;
    if (Date.now() - parsed.t > 7 * 86400000 || parsed.t > Date.now() + 60_000) return null;
    return prisma.superAdmin.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true, nombre: true, rol: true, creadoEn: true },
    });
  } catch {
    return null;
  }
}

export async function requireSuperAdmin() {
  await requirePlatformRequestHost();
  const session = await getSuperAdminSession();
  if (!session) throw new Error("Acceso no autorizado: se requiere sesión de SuperAdmin");
  return session;
}

export async function hashSuperAdminPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifySuperAdminPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
