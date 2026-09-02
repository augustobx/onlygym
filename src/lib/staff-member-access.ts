import "server-only";

import { Prisma, RolTenant } from "@prisma/client";
import { trainerMemberScope } from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/tenant-context";

export async function getStaffMemberScope(context: StaffContext): Promise<Prisma.ClienteWhereInput> {
  if (context.role === RolTenant.ENTRENADOR) {
    const profile = await prisma.perfilEntrenador.findFirst({
      where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" },
      select: { id: true },
    });
    return { tenantId: context.tenantId, ...trainerMemberScope(context.role, profile?.id ?? null) };
  }

  if (context.role === RolTenant.RECEPCION) {
    // Recepción opera siempre dentro de la sede activa. Si por algún motivo no hay
    // una sede validada, cerramos el acceso en vez de caer a todo el tenant.
    if (!context.branchId) return { tenantId: context.tenantId, id: -1 };
    return {
      tenantId: context.tenantId,
      sucursales: { some: { id: context.branchId } },
    };
  }

  return { tenantId: context.tenantId };
}

export async function canAccessMember(context: StaffContext, memberId: number) {
  const scope = await getStaffMemberScope(context);
  return prisma.cliente.findFirst({ where: { ...scope, id: memberId }, select: { id: true } });
}
