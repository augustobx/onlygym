import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const SUPERADMIN_COOKIE = "onlygym_superadmin_session";
const SECRET = process.env.BETTER_AUTH_SECRET || process.env.API_SECRET_KEY || "superadmin-secret-key-fallback-min-32-chars";

export function signToken(payload: string): string {
  const hmac = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64Payload, hmac] = parts;
  try {
    const payload = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    const hmacBuf = Buffer.from(hmac);
    const expBuf = Buffer.from(expected);
    if (hmacBuf.length !== expBuf.length || !timingSafeEqual(hmacBuf, expBuf)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSuperAdminSession(superadminId: number) {
  const data = JSON.stringify({ id: superadminId, t: Date.now(), nonce: randomBytes(8).toString("hex") });
  const token = signToken(data);
  const cookieStore = await cookies();
  cookieStore.set(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return token;
}

export async function clearSuperAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPERADMIN_COOKIE);
}

export async function getSuperAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPERADMIN_COOKIE)?.value;
  if (!token) return null;
  const payloadStr = verifyToken(token);
  if (!payloadStr) return null;
  try {
    const parsed = JSON.parse(payloadStr) as { id: number; t: number };
    // Max age 7 days
    if (Date.now() - parsed.t > 7 * 86400000) return null;
    const admin = await prisma.superAdmin.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true, nombre: true, rol: true, creadoEn: true },
    });
    return admin;
  } catch {
    return null;
  }
}

export async function requireSuperAdmin() {
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
