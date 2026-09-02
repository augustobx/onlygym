import { describe, expect, it } from "vitest";
import {
  generateTemporaryMemberPassword,
  hashMemberPassword,
  verifyMemberPassword,
} from "../src/lib/member-credentials";

describe("credenciales del portal de socios", () => {
  it("genera una contraseña temporal no predecible y sin espacios", () => {
    const first = generateTemporaryMemberPassword();
    const second = generateTemporaryMemberPassword();

    expect(first.length).toBeGreaterThanOrEqual(12);
    expect(first).not.toContain(" ");
    expect(first).not.toBe("123456");
    expect(first).not.toBe(second);
  });

  it("la contraseña temporal verifica contra su hash bcrypt", async () => {
    const password = generateTemporaryMemberPassword();
    const stored = await hashMemberPassword(password);

    await expect(verifyMemberPassword(stored, password)).resolves.toBe(true);
    await expect(verifyMemberPassword(stored, `${password}x`)).resolves.toBe(false);
  });

  it("mantiene compatibilidad con credenciales legacy en texto plano", async () => {
    await expect(verifyMemberPassword("legacy-pass", "legacy-pass")).resolves.toBe(true);
    await expect(verifyMemberPassword("legacy-pass", "otra-clave")).resolves.toBe(false);
  });
});
