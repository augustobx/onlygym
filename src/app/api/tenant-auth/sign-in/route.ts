import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestTenantSlug } from "@/lib/request-tenant";

export async function POST(request: NextRequest) {
  const tenantSlug = await getRequestTenantSlug();
  if (!tenantSlug) {
    return NextResponse.json({ message: "Dominio de gimnasio inválido" }, { status: 400 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Solicitud inválida" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ message: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  // Antes de autenticar, la identidad debe pertenecer al tenant indicado
  // por el hostname actual. Esto impide usar credenciales de otro gimnasio.
  const membership = await prisma.tenantUsuario.findFirst({
    where: {
      estado: "activo",
      user: {
        email,
        estado: "activo",
      },
      tenant: {
        slug: tenantSlug,
        estado: { in: ["activo", "prueba"] },
      },
    },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ message: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  return auth.api.signInEmail({
    body: {
      email,
      password,
      rememberMe: true,
    },
    headers: request.headers,
    asResponse: true,
  });
}
