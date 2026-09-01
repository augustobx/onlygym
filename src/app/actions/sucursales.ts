"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { revalidatePath } from "next/cache";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";

export async function getSucursales() {
  try {
    const context = await requireStaffContext();
    const sucursales = await prisma.sucursal.findMany({
      where: { tenantId: context.tenantId, estado: "activo" },
      orderBy: { id: "asc" },
    });
    return { success: true, data: serializeData(sucursales) };
  } catch (error) {
    console.error("Error al obtener sucursales activas:", error);
    return { success: false, error: "No se pudieron obtener las sucursales" };
  }
}

export async function getAllSucursalesAdmin() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const sucursales = await prisma.sucursal.findMany({
      where: { tenantId: context.tenantId },
      include: {
        _count: {
          select: {
            clientes: true,
            ingresos: true,
            usuarios: true,
          },
        },
        horarios: {
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    });

    const data = sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion || "",
      estado: s.estado,
      totalClientes: s._count.clientes,
      totalIngresos: s._count.ingresos,
      capacidadMaxima: s.horarios?.[0]?.capacidadMaxima || 50,
    }));

    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error("Error al obtener todas las sucursales admin:", error);
    return { success: false, error: "Error al cargar sucursales" };
  }
}

export async function createSucursal(data: {
  nombre: string;
  direccion?: string;
  capacidadMaxima?: number;
}) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    if (!data.nombre || data.nombre.trim() === "") {
      return { success: false, error: "El nombre de la sucursal es obligatorio" };
    }

    const nueva = await prisma.sucursal.create({
      data: {
        tenantId: context.tenantId,
        nombre: data.nombre.trim(),
        direccion: data.direccion?.trim() || null,
        estado: "activo",
      },
    });

    // Crear horarios base por defecto para los 7 días de la semana
    const dias = [1, 2, 3, 4, 5, 6, 0];
    for (const dia of dias) {
      await prisma.configuracionHorario.create({
        data: {
          sucursalId: nueva.id,
          diaSemana: dia,
          tipoApertura: dia === 0 ? "cerrado" : "completo",
          horaApertura1: "06:00",
          horaCierre1: "22:00",
          capacidadMaxima: data.capacidadMaxima || 50,
          activo: true,
        },
      });
    }

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/seleccionar-sucursal");

    return { success: true, data: serializeData(nueva) };
  } catch (error) {
    console.error("Error al crear sucursal:", error);
    return { success: false, error: "Error al crear la sucursal" };
  }
}

export async function updateSucursal(
  id: number,
  data: {
    nombre?: string;
    direccion?: string;
    capacidadMaxima?: number;
  }
) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.sucursal.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true } });
    if (!owned) return { success: false, error: "Sucursal no encontrada" };
    const updated = await prisma.sucursal.update({
      where: { id: owned.id },
      data: {
        nombre: data.nombre?.trim(),
        direccion: data.direccion?.trim() || null,
      },
    });

    if (data.capacidadMaxima) {
      await prisma.configuracionHorario.updateMany({
        where: { sucursalId: id },
        data: { capacidadMaxima: data.capacidadMaxima },
      });
    }

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/seleccionar-sucursal");

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    console.error("Error al actualizar sucursal:", error);
    return { success: false, error: "Error al actualizar la sucursal" };
  }
}

export async function toggleSucursalEstado(id: number, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.sucursal.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true } });
    if (!owned) return { success: false, error: "Sucursal no encontrada" };
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    const updated = await prisma.sucursal.update({
      where: { id: owned.id },
      data: { estado: nuevoEstado },
    });

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/seleccionar-sucursal");

    return { success: true, nuevoEstado, data: serializeData(updated) };
  } catch (error) {
    console.error("Error al alternar estado de sucursal:", error);
    return { success: false, error: "Error al cambiar estado de la sucursal" };
  }
}
