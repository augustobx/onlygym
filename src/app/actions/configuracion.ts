"use server";

import { RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";

const ADMIN_ROLES = [RolTenant.OWNER, RolTenant.ADMIN];

type MembershipInput = {
  nombre?: string;
  diasDuracion?: number;
  precio?: number;
  descripcion?: string | null;
};

function validateMembershipInput(data: MembershipInput, requireAll = false) {
  if ((requireAll || data.nombre !== undefined) && (!data.nombre || data.nombre.trim().length < 2)) {
    return "El nombre del plan debe tener al menos 2 caracteres";
  }
  if ((requireAll || data.diasDuracion !== undefined) && (!Number.isInteger(data.diasDuracion) || Number(data.diasDuracion) <= 0 || Number(data.diasDuracion) > 3650)) {
    return "La duración del plan debe ser un número entero entre 1 y 3650 días";
  }
  if ((requireAll || data.precio !== undefined) && (!Number.isFinite(data.precio) || Number(data.precio) < 0 || Number(data.precio) > 999999999)) {
    return "El precio del plan es inválido";
  }
  if (data.descripcion !== undefined && data.descripcion !== null && data.descripcion.trim().length > 2000) {
    return "La descripción no puede superar los 2000 caracteres";
  }
  return null;
}

function cleanMembershipData(data: MembershipInput) {
  return {
    ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
    ...(data.diasDuracion !== undefined ? { diasDuracion: data.diasDuracion } : {}),
    ...(data.precio !== undefined ? { precio: data.precio } : {}),
    ...(data.descripcion !== undefined ? { descripcion: data.descripcion?.trim() || null } : {}),
  };
}

export async function getAllMembresias() {
  try {
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const membresias = await prisma.membresia.findMany({
      where: { tenantId: context.tenantId },
      orderBy: [{ estado: "asc" }, { diasDuracion: "asc" }, { nombre: "asc" }],
    });
    return { success: true, data: serializeData(membresias.map((membership) => ({ ...membership, precio: Number(membership.precio) }))) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error obteniendo membresías" };
  }
}

export async function updateMembresia(id: number, data: MembershipInput) {
  try {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Membresía inválida" };
    const validationError = validateMembershipInput(data);
    if (validationError) return { success: false, error: validationError };

    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const membership = await prisma.membresia.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true } });
    if (!membership) return { success: false, error: "Membresía no encontrada" };

    await prisma.membresia.update({ where: { id: membership.id }, data: cleanMembershipData(data) });
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "membresia.actualizar",
      entidad: "Membresia",
      entidadId: membership.id,
      metadata: { campos: Object.keys(data) },
    });
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/pagos");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error actualizando membresía" };
  }
}

export async function createMembresiaFull(data: { nombre: string; diasDuracion: number; precio: number; descripcion?: string | null }) {
  try {
    const validationError = validateMembershipInput(data, true);
    if (validationError) return { success: false, error: validationError };

    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const membership = await prisma.membresia.create({
      data: {
        tenantId: context.tenantId,
        nombre: data.nombre.trim(),
        diasDuracion: data.diasDuracion,
        precio: data.precio,
        descripcion: data.descripcion?.trim() || null,
      },
    });
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "membresia.crear",
      entidad: "Membresia",
      entidadId: membership.id,
      metadata: { diasDuracion: data.diasDuracion, precio: data.precio },
    });
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/pagos");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error creando membresía" };
  }
}

export async function toggleMembresiaEstado(id: number, _estadoActual?: string) {
  try {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Membresía inválida" };
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const membership = await prisma.membresia.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { id: true, estado: true },
    });
    if (!membership) return { success: false, error: "Membresía no encontrada" };

    const nextState = membership.estado === "activo" ? "inactivo" : "activo";
    await prisma.membresia.update({ where: { id: membership.id }, data: { estado: nextState } });
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "membresia.cambiar_estado",
      entidad: "Membresia",
      entidadId: membership.id,
      metadata: { estadoAnterior: membership.estado, estadoNuevo: nextState },
    });
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/pagos");
    return { success: true, nuevoEstado: nextState };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error cambiando estado" };
  }
}
