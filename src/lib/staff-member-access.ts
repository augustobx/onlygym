import "server-only";

import { Prisma, RolTenant } from "@prisma/client";
import { trainerMemberScope } from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/tenant-context";

export async function getStaffMemberScope(context: StaffContext): Promise<Prisma.ClienteWhereInput> {
  if (context.role !== RolTenant.ENTRENADOR) return { tenantId: context.tenantId };
  const profile = await prisma.perfilEntrenador.findFirst({
    where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" },
    select: { id: true },
  });
  return { tenantId: context.tenantId, ...trainerMemberScope(context.role, profile?.id ?? null) };
}

export async function canAccessMember(context: StaffContext, memberId: number) {
  const scope = await getStaffMemberScope(context);
  return prisma.cliente.findFirst({ where: { ...scope, id: memberId }, select: { id: true } });
}
