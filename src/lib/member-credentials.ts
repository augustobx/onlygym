import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function generateTemporaryMemberPassword() {
  // Evita claves globales/predictibles como 123456 y no incluye espacios.
  return `${randomBytes(9).toString("base64url")}9!`;
}

export async function hashMemberPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyMemberPassword(stored: string, candidate: string) {
  if (stored.startsWith("$2")) {
    return bcrypt.compare(candidate, stored);
  }

  // Compatibilidad temporal con credenciales legacy en texto plano.
  const storedBuffer = Buffer.from(stored);
  const candidateBuffer = Buffer.from(candidate);
  return storedBuffer.length === candidateBuffer.length && timingSafeEqual(storedBuffer, candidateBuffer);
}
