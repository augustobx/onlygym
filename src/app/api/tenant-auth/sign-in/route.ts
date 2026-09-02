import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestTenantSlug } from "@/lib/request-tenant";

export async function POST(request: NextRequest) {
  const tenantSlug = await getRequestTenantSlug();
  if (!tenantSlug) return NextResponse.json({ message: "Dominio de gimnasio inválido" }, { status: 400 });

  let body: { identifier?: string; email?: string; username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Solicitud inválida" }, { status: 400 });
  }

  const identifier = String(body.identifier || body.email || body.username || "").trim().toLowerCase();
  const password = body.password;
  if (!identifier || !password) return NextResponse.json({ message: "Usuario o contraseña incorrectos" }, { status: 401 });

  const isEmail = identifier.includes("@");
  const membership = await prisma.tenantUsuario.findFirst({
    where: {
      estado: "activo",
      user: {
        ...(isEmail ? { email: identifier } : { username: identifier }),
        estado: "activo",
      },
      tenant: {
        slug: tenantSlug,
        estado: { in: ["activo", "prueba"] },
      },
    },
    select: { userId: true },
  });

  if (!membership) return NextResponse.json({ message: "Usuario o contraseña incorrectos" }, { status: 401 });

  if (isEmail) {
    return auth.api.signInEmail({ body: { email: identifier, password, rememberMe: true }, headers: request.headers, asResponse: true });
  }

  return auth.api.signInUsername({ body: { username: identifier, password, rememberMe: true }, headers: request.headers, asResponse: true });
}
