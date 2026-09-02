import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

const BLOCKED_PUBLIC_POST_PATHS = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-in/username",
  "/api/auth/request-password-reset",
]);

export const GET = handler.GET;

export async function POST(request: NextRequest) {
  if (BLOCKED_PUBLIC_POST_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.json(
      { message: "Usá el endpoint de autenticación del gimnasio" },
      { status: 404 },
    );
  }

  return handler.POST(request);
}
