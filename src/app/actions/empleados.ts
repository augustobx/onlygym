"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

export async function getEmpleados() {
  try {
    const users = await prisma.user.findMany({
      include: { sucursales: true },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: serializeData(users) };
  } catch (error) {
    return { success: false, error: "Error obteniendo empleados" };
  }
}

export async function updateEmpleado(id: string, data: { name?: string; nivel?: string; estado?: string }) {
  try {
    await prisma.user.update({ where: { id }, data });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error actualizando empleado" };
  }
}

export async function toggleEmpleadoEstado(id: string, estadoActual: string) {
  try {
    await prisma.user.update({
      where: { id },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error cambiando estado" };
  }
}
