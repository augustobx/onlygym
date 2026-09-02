import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantSlugFromRequest } from "@/lib/request-tenant";

const GENERIC_RESPONSE = { success: true, message: "Si el correo está registrado para este gimnasio, vas a recibir un enlace." };

export async function POST(request: NextRequest) {
  const tenantSlug = getTenantSlugFromRequest(request);
  if (!tenantSlug) return NextResponse.json(GENERIC_RESPONSE);

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json(GENERIC_RESPONSE);

  const membership = await prisma.tenantUsuario.findFirst({
    where: {
      estado: "activo",
      user: { email, estado: "activo" },
      tenant: { slug: tenantSlug, estado: { in: ["activo", "prueba"] } },
    },
    select: { id: true },
  });

  if (!membership) return NextResponse.json(GENERIC_RESPONSE);

  try {
    const redirectTo = new URL("/restablecer-password", request.url).toString();
    await auth.api.requestPasswordReset({
      body: { email, redirectTo },
      headers: request.headers,
    });
  } catch (error) {
    console.error("Error solicitando reset tenant-scoped:", error);
  }

  // Respuesta intencionalmente indistinguible para evitar enumeración de cuentas.
  return NextResponse.json(GENERIC_RESPONSE);
}
