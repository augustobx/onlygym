import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    trustedOrigins: ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000"],
    advanced: { crossSubDomainCookies: { enabled: true } },
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
