import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/molinete") || path.startsWith("/seleccionar-sucursal") || path.startsWith("/seleccionar-gimnasio");
  const sessionCookie = request.cookies.get("better-auth.session_token") || request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie?.value && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/molinete/:path*", "/seleccionar-sucursal/:path*", "/seleccionar-gimnasio/:path*"],
};
