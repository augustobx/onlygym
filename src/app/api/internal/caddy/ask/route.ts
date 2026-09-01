import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantSlugForHost } from "@/lib/tenant-host";

export async function GET(request: NextRequest) {
  try {
    const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
    if (!domain) {
      return new NextResponse("Falta parámetro domain", { status: 400 });
    }

    const baseDomain = (process.env.TENANT_BASE_DOMAIN || "nanoapps.ar").toLowerCase();
    const platformDomain = (process.env.PLATFORM_DOMAIN || `onlygym.${baseDomain}`).toLowerCase();

    // Dominio de plataforma reservado
    if (domain === platformDomain || domain === `admin.${baseDomain}` || domain === `app.${baseDomain}`) {
      return new NextResponse(null, { status: 204 });
    }

    // Resolver slug del tenant a partir del hostname
    const slug = resolveTenantSlugForHost({
      hostname: domain,
      baseDomain,
      hostMap: process.env.TENANT_HOST_MAP,
      localDefaultSlug: process.env.DEFAULT_TENANT_SLUG || "onlygym-demo",
      production: process.env.NODE_ENV === "production",
    });

    if (!slug) {
      return new NextResponse("Tenant no encontrado para el dominio", { status: 404 });
    }

    // Slugs reservados de plataforma
    const reserved = ["admin", "superadmin", "api", "app", "dashboard", "portal", "status", "health", "mail", "cdn", "onlygym"];
    if (reserved.includes(slug)) {
      return new NextResponse(null, { status: 204 });
    }

    // Buscar tenant en base de datos
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, estado: true, fechaVencimiento: true },
    });

    if (!tenant) {
      return new NextResponse("Tenant inexistente", { status: 404 });
    }

    // El tenant existe. Si está activo o en prueba, responde 204 para permitir tráfico (incluso si está suspendido,
    // el router debe enviar la request a la app para que Next.js renderice /suspendido).
    if (tenant.estado === "cancelado") {
      return new NextResponse("Tenant cancelado", { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error en endpoint ask de Caddy/Router:", error);
    return new NextResponse("Error interno", { status: 500 });
  }
}
