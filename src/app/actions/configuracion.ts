"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

export async function getAllMembresias() {
  try {
    const membresias = await prisma.membresia.findMany({ orderBy: { diasDuracion: "asc" } });
    return { success: true, data: serializeData(membresias.map(m => ({ ...m, precio: Number(m.precio) }))) };
  } catch (error) {
    return { success: false, error: "Error obteniendo membresías" };
  }
}

export async function updateMembresia(id: number, data: { nombre?: string; diasDuracion?: number; precio?: number; descripcion?: string }) {
  try {
    await prisma.membresia.update({ where: { id }, data });
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error actualizando membresía" };
  }
}

export async function createMembresiaFull(data: { nombre: string; diasDuracion: number; precio: number; descripcion?: string }) {
  try {
    await prisma.membresia.create({ data });
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error creando membresía" };
  }
}

export async function toggleMembresiaEstado(id: number, estadoActual: string) {
  try {
    await prisma.membresia.update({
      where: { id },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    revalidatePath("/dashboard/configuracion");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error cambiando estado" };
  }
}
