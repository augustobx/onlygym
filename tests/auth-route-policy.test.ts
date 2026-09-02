import { describe, expect, it } from "vitest";
import { isUnscopedTenantAuthPost } from "../src/lib/auth-route-policy";

describe("política de endpoints Better Auth", () => {
  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/sign-in/username",
    "/api/auth/request-password-reset",
  ])("bloquea el acceso público no tenant-scoped a %s", (path) => {
    expect(isUnscopedTenantAuthPost(path)).toBe(true);
  });

  it.each([
    "/api/auth/get-session",
    "/api/auth/sign-out",
    "/api/auth/reset-password",
  ])("mantiene disponibles operaciones de sesión/token en %s", (path) => {
    expect(isUnscopedTenantAuthPost(path)).toBe(false);
  });
});
