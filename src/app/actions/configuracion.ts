"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";

export async function getAllMembresias() {
  try {
    const context = await requireStaffContext();
    const membresias = await prisma.membresia.findMany({ where: { tenantId: context.tenantId }, orderBy: { diasDuracion: "asc" } });
    return { success: true, data: serializeData(membresias.map(m => ({ ...m, precio: Number(m.precio) }))) };
  } catch (error) {
    return { success: false, error: "Error obteniendo membresías" };
  }
}

export async function updateMembresia(id: number, data: { nombre?: string; diasDuracion?: number; precio?: number; descripcion?: string }) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const result = await prisma.membresia.updateMany({ where: { id, tenantId: context.tenantId }, data });
    if (!result.count) return { success: false, error: "Membresía no encontrada" };
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error actualizando membresía" };
  }
}

export async function createMembresiaFull(data: { nombre: string; diasDuracion: number; precio: number; descripcion?: string }) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await prisma.membresia.create({ data: { ...data, tenantId: context.tenantId } });
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error creando membresía" };
  }
}

export async function toggleMembresiaEstado(id: number, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const result = await prisma.membresia.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    if (!result.count) return { success: false, error: "Membresía no encontrada" };
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error cambiando estado" };
  }
}
