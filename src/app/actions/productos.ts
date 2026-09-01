"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";

export async function getProductos(filtroEstado?: string, buscar?: string) {
  try {
    const context = await requireStaffContext();
    const where: any = { tenantId: context.tenantId };
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
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    const producto = await prisma.producto.create({ data: { ...data, tenantId: context.tenantId } });
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
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const updated = await prisma.producto.updateMany({ where: { id, tenantId: context.tenantId }, data });
    if (!updated.count) return { success: false, error: "Producto no encontrado" };
    revalidatePath("/dashboard/productos");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error actualizando producto" };
  }
}

export async function toggleProductoEstado(id: number, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const updated = await prisma.producto.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    if (!updated.count) return { success: false, error: "Producto no encontrado" };
    revalidatePath("/dashboard/productos");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error cambiando estado" };
  }
}
