import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUnscopedTenantAuthPost } from "@/lib/auth-route-policy";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: NextRequest) {
  if (isUnscopedTenantAuthPost(request.nextUrl.pathname)) {
    return NextResponse.json(
      { message: "Usá el endpoint de autenticación del gimnasio" },
      { status: 404 },
    );
  }

  return handler.POST(request);
}
