"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTenantModules, requireStaffContext, setActiveBranchCookie, setActiveTenantCookie } from "@/lib/tenant-context";

export async function getMisGimnasios() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "No autenticado" };
  const memberships = await prisma.tenantUsuario.findMany({
    where: { userId: session.user.id, estado: "activo", tenant: { estado: { in: ["activo", "prueba"] } } },
    include: { tenant: { select: { id: true, nombre: true, slug: true, plan: true } } },
    orderBy: { tenant: { nombre: "asc" } },
  });
  return {
    success: true,
    data: memberships.map(({ tenant, rol }) => ({ ...tenant, rol })),
    userName: session.user.name,
  };
}

export async function seleccionarGimnasioActivo(tenantId: number) {
  try {
    const membership = await setActiveTenantCookie(tenantId);
    return { success: true, data: { id: membership.tenant.id, nombre: membership.tenant.nombre, slug: membership.tenant.slug } };
  } catch {
    return { success: false, error: "Gimnasio no autorizado" };
  }
}

export async function getMisSucursales() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  try {
    const context = await requireStaffContext();
    const [user, branches] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
      prisma.sucursal.findMany({
        where: {
          tenantId: context.tenantId,
          estado: "activo",
          ...((context.role === "RECEPCION" || context.role === "ENTRENADOR") ? { usuarios: { some: { id: session.user.id } } } : {}),
        },
        orderBy: { nombre: "asc" },
      }),
    ]);
    if (!user) return { success: false, error: "Usuario no encontrado" };
    return { success: true, data: branches, userName: user.name, tenantName: context.tenantName };
  } catch {
    return { success: false, error: "Error al cargar sucursales" };
  }
}

export async function seleccionarSucursalActiva(sucursalId: number) {
  try {
    await setActiveBranchCookie(sucursalId);
    return { success: true };
  } catch {
    return { success: false, error: "Sucursal no autorizada" };
  }
}

export async function getStaffNavigationContext() {
  try {
    const context = await requireStaffContext();
    const [modules, user] = await Promise.all([getTenantModules(context.tenantId), prisma.user.findUnique({ where: { id: context.userId }, select: { name: true } })]);
    return { success: true, data: { name: user?.name || "Usuario", role: context.role, modules, tenantId: context.tenantId, tenantSlug: context.tenantSlug, tenantName: context.tenantName } };
  } catch { return { success: false as const }; }
}
