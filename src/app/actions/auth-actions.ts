"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getMisSucursales() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { sucursales: true },
    });

    if (!user) return { success: false, error: "Usuario no encontrado" };

    return { success: true, data: user.sucursales, userName: user.name };
  } catch (error) {
    return { success: false, error: "Error al cargar sucursales" };
  }
}
