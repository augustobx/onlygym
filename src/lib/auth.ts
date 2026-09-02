import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { username } from "better-auth/plugins";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";

function getAuthSecret() {
    if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
    if (process.env.NODE_ENV === "production") {
        throw new Error("BETTER_AUTH_SECRET debe estar configurado en producción");
    }
    return "onlygym-local-development-secret-change-me";
}

const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    secret: getAuthSecret(),
    trustedOrigins: [
        ...configuredOrigins,
        "https://onlygym.nanolabs.online",
        "https://gymlink.nanolabs.online",
        "http://gymlink.nanolabs.online",
        "http://66.97.39.165:3005",
        "http://localhost:3005",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    advanced: {
        // Cada subdominio de tenant debe mantener su propia sesión.
        // No compartir cookies entre *.nanoapps.ar: evita que una sesión
        // iniciada en un gimnasio sea reutilizada automáticamente en otro.
        crossSubDomainCookies: { enabled: false },
        useSecureCookies: process.env.NODE_ENV === "production"
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        revokeSessionsOnPasswordReset: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        password: {
            hash: async (password) => hashPassword(password),
            verify: async ({ hash, password }) => {
                if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
                    return bcrypt.compare(password, hash);
                }
                return verifyPassword({ hash, password });
            },
        },
        sendResetPassword: async ({ user, url }, request) => {
            await sendPasswordResetEmail({ email: user.email, name: user.name, url });
            const memberships = await prisma.tenantUsuario.findMany({ where: { userId: user.id, estado: "activo" }, select: { tenantId: true } });
            await writeAudit({ actorUserId: user.id, accion: "auth.password_reset_solicitado", entidad: "User", entidadId: user.id, metadata: { tenantIds: memberships.map((item) => item.tenantId) }, requestHeaders: request?.headers ?? new Headers() });
        },
        onPasswordReset: async ({ user }, request) => {
            const memberships = await prisma.tenantUsuario.findMany({ where: { userId: user.id, estado: "activo" }, select: { tenantId: true } });
            await Promise.all(memberships.map(({ tenantId }) => writeAudit({ tenantId, actorUserId: user.id, accion: "auth.password_reset_completado", entidad: "User", entidadId: user.id, requestHeaders: request?.headers ?? new Headers() })));
        },
    },
    plugins: [
        username()
    ]
});
