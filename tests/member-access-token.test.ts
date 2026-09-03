import { describe, expect, it } from "vitest";
import { createMemberAccessToken, isMemberAccessToken, verifyMemberAccessToken } from "../src/lib/member-access-token";

const secret = "test-member-access-secret-with-enough-entropy";
const now = Date.UTC(2026, 8, 3, 16, 30, 0);

describe("member access token", () => {
  it("round-trips tenant and member ids", () => {
    const token = createMemberAccessToken({ tenantId: 7, clienteId: 42 }, secret, now, 90);
    expect(isMemberAccessToken(token)).toBe(true);
    expect(verifyMemberAccessToken(token, secret, now + 30_000)).toMatchObject({ tenantId: 7, clienteId: 42 });
  });

  it("expires credentials at their configured TTL", () => {
    const token = createMemberAccessToken({ tenantId: 1, clienteId: 2 }, secret, now, 60);
    expect(verifyMemberAccessToken(token, secret, now + 60_000)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createMemberAccessToken({ tenantId: 1, clienteId: 2 }, secret, now, 90);
    expect(verifyMemberAccessToken(token, "another-secret", now)).toBeNull();
  });

  it("rejects payload tampering", () => {
    const token = createMemberAccessToken({ tenantId: 1, clienteId: 2 }, secret, now, 90);
    const [prefix, payload, signature] = token.split(".");
    const tampered = `${prefix}.${payload.slice(0, -1)}A.${signature}`;
    expect(verifyMemberAccessToken(tampered, secret, now)).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(verifyMemberAccessToken("not-a-token", secret, now)).toBeNull();
    expect(isMemberAccessToken("12345678")).toBe(false);
  });

  it("rejects invalid ids and unsafe TTLs at creation", () => {
    expect(() => createMemberAccessToken({ tenantId: 0, clienteId: 2 }, secret, now)).toThrow();
    expect(() => createMemberAccessToken({ tenantId: 1, clienteId: 2 }, secret, now, 10)).toThrow();
  });
});
