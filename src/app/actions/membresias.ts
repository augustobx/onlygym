"use server";

import { prisma } from "@/lib/prisma";
import { membresiaSchema, MembresiaData } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";

export async function getMembresias() {
  try {
    const context = await requireStaffContext();
    const membresias = await prisma.membresia.findMany({
      where: { tenantId: context.tenantId, estado: "activo" },
    });
    return {
      success: true,
      data: serializeData(
        membresias.map(m => ({
          ...m,
          precio: Number(m.precio),
        }))
      ),
    };
  } catch (error) {
    console.error("Error al obtener membresías:", error);
    return { success: false, error: "No se pudieron obtener las membresías" };
  }
}

export async function createMembresia(data: MembresiaData) {
  const result = membresiaSchema.safeParse(data);
  
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message || "Datos inválidos" };
  }

  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const newMembresia = await prisma.membresia.create({
      data: { ...result.data, tenantId: context.tenantId },
    });
    
    revalidatePath("/dashboard/membresias");
    return {
      success: true,
      data: serializeData({
        ...newMembresia,
        precio: Number(newMembresia.precio),
      }),
    };
  } catch (error) {
    console.error("Error al crear membresía:", error);
    return { success: false, error: "Error interno al crear la membresía" };
  }
}
