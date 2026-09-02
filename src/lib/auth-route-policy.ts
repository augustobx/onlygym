export const TENANT_SCOPED_AUTH_POST_PATHS = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-in/username",
  "/api/auth/request-password-reset",
]);

export function isUnscopedTenantAuthPost(pathname: string) {
  return TENANT_SCOPED_AUTH_POST_PATHS.has(pathname);
}
