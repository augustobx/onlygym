"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

export async function getProductos(filtroEstado?: string, buscar?: string) {
  try {
    const where: any = {};
    if (filtroEstado && filtroEstado !== "todos") where.estado = filtroEstado;
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: "insensitive" } },
        { codigo: { contains: buscar, mode: "insensitive" } },
        { categoria: { contains: buscar, mode: "insensitive" } },
      ];
    }
    const productos = await prisma.producto.findMany({ where, orderBy: { nombre: "asc" } });
    return {
      success: true,
      data: serializeData(
        productos.map(p => ({ ...p, precio: Number(p.precio) }))
      ),
    };
  } catch (error) {
    return { success: false, error: "Error obteniendo productos" };
  }
}

export async function createProducto(data: {
  codigo?: string; nombre: string; descripcion?: string; precio: number;
  stock: number; stockMinimo: number; categoria?: string;
}) {
  try {
    const producto = await prisma.producto.create({ data });
    revalidatePath("/dashboard/productos");
    return {
      success: true,
      data: serializeData({
        ...producto,
        precio: Number(producto.precio),
      }),
    };
  } catch (error: any) {
    if (error.code === "P2002") return { success: false, error: "Ya existe un producto con ese código" };
    return { success: false, error: "Error creando producto" };
  }
}

export async function updateProducto(id: number, data: any) {
  try {
    await prisma.producto.update({ where: { id }, data });
    revalidatePath("/dashboard/productos");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error actualizando producto" };
  }
}

export async function toggleProductoEstado(id: number, estadoActual: string) {
  try {
    await prisma.producto.update({
      where: { id },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    revalidatePath("/dashboard/productos");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error cambiando estado" };
  }
}
