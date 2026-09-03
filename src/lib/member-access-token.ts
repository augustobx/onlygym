import { createHmac, timingSafeEqual } from "node:crypto";

export type MemberAccessPayload = {
  tenantId: number;
  clienteId: number;
  exp: number;
};

const PREFIX = "og1";
const DEFAULT_TTL_SECONDS = 90;

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function getMemberAccessSigningSecret() {
  const secret = process.env.MEMBER_ACCESS_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MEMBER_ACCESS_SIGNING_SECRET o BETTER_AUTH_SECRET debe estar configurado");
  }
  return "onlygym-local-member-access-secret";
}

export function createMemberAccessToken(
  input: { tenantId: number; clienteId: number },
  secret = getMemberAccessSigningSecret(),
  nowMs = Date.now(),
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  if (!Number.isInteger(input.tenantId) || input.tenantId <= 0) throw new Error("tenantId inválido");
  if (!Number.isInteger(input.clienteId) || input.clienteId <= 0) throw new Error("clienteId inválido");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 300) throw new Error("TTL inválido");

  const payload: MemberAccessPayload = {
    tenantId: input.tenantId,
    clienteId: input.clienteId,
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${PREFIX}.${encodedPayload}.${signature(encodedPayload, secret)}`;
}

export function verifyMemberAccessToken(
  token: string,
  secret = getMemberAccessSigningSecret(),
  nowMs = Date.now(),
): MemberAccessPayload | null {
  if (typeof token !== "string" || token.length < 20 || token.length > 1024) return null;
  const [prefix, encodedPayload, receivedSignature, extra] = token.split(".");
  if (prefix !== PREFIX || !encodedPayload || !receivedSignature || extra !== undefined) return null;

  const expectedSignature = signature(encodedPayload, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<MemberAccessPayload>;
    if (!Number.isInteger(parsed.tenantId) || Number(parsed.tenantId) <= 0) return null;
    if (!Number.isInteger(parsed.clienteId) || Number(parsed.clienteId) <= 0) return null;
    if (!Number.isInteger(parsed.exp) || Number(parsed.exp) <= Math.floor(nowMs / 1000)) return null;
    return { tenantId: Number(parsed.tenantId), clienteId: Number(parsed.clienteId), exp: Number(parsed.exp) };
  } catch {
    return null;
  }
}

export function isMemberAccessToken(value: string) {
  return typeof value === "string" && value.startsWith(`${PREFIX}.`);
}
