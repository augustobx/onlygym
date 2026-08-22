import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const isProtected = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/molinete") || request.nextUrl.pathname.startsWith("/seleccionar-sucursal");
    const isLogin = request.nextUrl.pathname === "/login";

    // Verificar presencia de cookies de sesión de Better Auth (estándar y HTTPS Secure)
    const sessionCookie = 
        request.cookies.get("better-auth.session_token") || 
        request.cookies.get("__Secure-better-auth.session_token");

    const hasSession = Boolean(sessionCookie?.value);

    // Si intenta entrar a una ruta protegida sin cookie de sesión -> redirigir a /login
    if (!hasSession && isProtected) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Si ya tiene sesión e intenta entrar a /login -> redirigir al dashboard
    if (hasSession && isLogin) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/login", "/molinete/:path*", "/seleccionar-sucursal/:path*"],
};
