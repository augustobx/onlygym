"use server";

import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

const progressRoles = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR];

export async function getSociosParaProgreso(query = "") {
  try {
    const context = await requireStaffContext({ roles: progressRoles });
    await requireTenantModule(context.tenantId, "mediciones");
    const memberScope = await getStaffMemberScope(context);
    const clean = query.trim();

    const members = await prisma.cliente.findMany({
      where: {
        ...memberScope,
        estado: "activo",
        ...(clean
          ? {
              OR: [
                { nombre: { contains: clean, mode: "insensitive" } },
                { apellido: { contains: clean, mode: "insensitive" } },
                { documento: { contains: clean } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        mediciones: {
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          take: 1,
          select: { fecha: true, peso: true },
        },
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      take: 60,
    });

    return { success: true, data: serializeData(members) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}
