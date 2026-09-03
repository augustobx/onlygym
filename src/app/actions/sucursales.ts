"use server";

import { Prisma, RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";

const ADMIN_ROLES = [RolTenant.OWNER, RolTenant.ADMIN];
const DAYS = [1, 2, 3, 4, 5, 6, 0];

function revalidateBranchPaths() {
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/empleados");
  revalidatePath("/seleccionar-sucursal");
  revalidatePath("/dashboard/aforo");
  revalidatePath("/dashboard");
}

function validateBranchInput(data: { nombre?: string; direccion?: string; capacidadMaxima?: number }, requireName = false) {
  if ((requireName || data.nombre !== undefined) && (!data.nombre || data.nombre.trim().length < 2 || data.nombre.trim().length > 100)) {
    return "El nombre de la sede debe tener entre 2 y 100 caracteres";
  }
  if (data.direccion !== undefined && data.direccion.trim().length > 255) return "La dirección es demasiado larga";
  if (data.capacidadMaxima !== undefined && (!Number.isInteger(data.capacidadMaxima) || data.capacidadMaxima < 1 || data.capacidadMaxima > 100000)) {
    return "La capacidad máxima debe ser un entero entre 1 y 100000";
  }
  return null;
}

export async function getSucursales() {
  try {
    const context = await requireStaffContext();
    const sucursales = await prisma.sucursal.findMany({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        ...((context.role === RolTenant.RECEPCION || context.role === RolTenant.ENTRENADOR)
          ? { usuarios: { some: { id: context.userId } } }
          : {}),
      },
      orderBy: { nombre: "asc" },
    });
    return { success: true, data: serializeData(sucursales) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron obtener las sucursales" };
  }
}

export async function getAllSucursalesAdmin() {
  try {
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const sucursales = await prisma.sucursal.findMany({
      where: { tenantId: context.tenantId },
      include: {
        _count: { select: { clientes: true, ingresos: true, usuarios: true } },
        horarios: { orderBy: { diaSemana: "asc" }, take: 1 },
      },
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
    });

    return {
      success: true,
      data: serializeData(sucursales.map((branch) => ({
        id: branch.id,
        nombre: branch.nombre,
        direccion: branch.direccion || "",
        estado: branch.estado,
        totalClientes: branch._count.clientes,
        totalIngresos: branch._count.ingresos,
        totalUsuarios: branch._count.usuarios,
        capacidadMaxima: branch.horarios?.[0]?.capacidadMaxima || 50,
      }))),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cargar sucursales" };
  }
}

export async function createSucursal(data: { nombre: string; direccion?: string; capacidadMaxima?: number }) {
  try {
    const validationError = validateBranchInput(data, true);
    if (validationError) return { success: false, error: validationError };
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const capacity = data.capacidadMaxima ?? 50;

    const nueva = await prisma.$transaction(async (tx) => {
      const branch = await tx.sucursal.create({
        data: {
          tenantId: context.tenantId,
          nombre: data.nombre.trim(),
          direccion: data.direccion?.trim() || null,
          estado: "activo",
        },
      });
      await tx.configuracionHorario.createMany({
        data: DAYS.map((day) => ({
          sucursalId: branch.id,
          diaSemana: day,
          tipoApertura: day === 0 ? "cerrado" : "completo",
          horaApertura1: day === 0 ? null : "06:00",
          horaCierre1: day === 0 ? null : "22:00",
          capacidadMaxima: day === 0 ? 0 : capacity,
          activo: day !== 0,
        })),
      });
      return branch;
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "sucursal.crear",
      entidad: "Sucursal",
      entidadId: nueva.id,
      metadata: { capacidadMaxima: capacity },
    });
    revalidateBranchPaths();
    return { success: true, data: serializeData(nueva) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe una sede con ese nombre" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Error al crear la sucursal" };
  }
}

export async function updateSucursal(id: number, data: { nombre?: string; direccion?: string; capacidadMaxima?: number }) {
  try {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Sucursal inválida" };
    const validationError = validateBranchInput(data);
    if (validationError) return { success: false, error: validationError };
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const owned = await prisma.sucursal.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true } });
    if (!owned) return { success: false, error: "Sucursal no encontrada" };

    const updated = await prisma.$transaction(async (tx) => {
      const branch = await tx.sucursal.update({
        where: { id: owned.id },
        data: {
          ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
          ...(data.direccion !== undefined ? { direccion: data.direccion.trim() || null } : {}),
        },
      });
      if (data.capacidadMaxima !== undefined) {
        await tx.configuracionHorario.updateMany({
          where: { sucursalId: owned.id, tipoApertura: { not: "cerrado" } },
          data: { capacidadMaxima: data.capacidadMaxima },
        });
      }
      return branch;
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "sucursal.actualizar",
      entidad: "Sucursal",
      entidadId: owned.id,
      metadata: { campos: Object.keys(data) },
    });
    revalidateBranchPaths();
    return { success: true, data: serializeData(updated) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe una sede con ese nombre" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar la sucursal" };
  }
}

export async function toggleSucursalEstado(id: number, _estadoActual?: string) {
  try {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Sucursal inválida" };
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const owned = await prisma.sucursal.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { id: true, estado: true },
    });
    if (!owned) return { success: false, error: "Sucursal no encontrada" };

    const nuevoEstado = owned.estado === "activo" ? "inactivo" : "activo";
    if (nuevoEstado === "inactivo") {
      const activeCount = await prisma.sucursal.count({ where: { tenantId: context.tenantId, estado: "activo" } });
      if (activeCount <= 1) return { success: false, error: "El gimnasio debe conservar al menos una sede activa" };
    }

    const updated = await prisma.sucursal.update({ where: { id: owned.id }, data: { estado: nuevoEstado } });
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "sucursal.cambiar_estado",
      entidad: "Sucursal",
      entidadId: owned.id,
      metadata: { estadoAnterior: owned.estado, estadoNuevo: nuevoEstado },
    });
    revalidateBranchPaths();
    return { success: true, nuevoEstado, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cambiar estado de la sucursal" };
  }
}
