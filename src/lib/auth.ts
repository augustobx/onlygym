import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET || "gymlink_super_secret_production_key_2026",
    trustedOrigins: [
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
        crossSubDomainCookies: { enabled: true },
        useSecureCookies: process.env.NODE_ENV === "production"
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        username()
    ]
});
