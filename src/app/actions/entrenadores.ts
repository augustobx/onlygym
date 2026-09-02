"use server";

import { randomBytes } from "node:crypto";
import { Prisma, RolTenant } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { writeAudit } from "@/lib/audit";

const scheduleItem = z.object({ dia: z.number().int().min(0).max(6), activo: z.boolean(), desde: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), hasta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine((value) => !value.activo || value.desde < value.hasta, { message: "El horario de salida debe ser posterior al de entrada" });
const trainerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(3000).optional(),
  foto: z.union([z.literal(""), z.string().url().max(2000)]).optional(),
  especialidades: z.array(z.string().trim().min(2).max(60)).max(20),
  sucursalIds: z.array(z.number().int().positive()).min(1).max(20),
  horarios: z.array(scheduleItem).length(7),
});
const createTrainerSchema = trainerProfileSchema.extend({ email: z.string().trim().toLowerCase().email().max(190), username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/) });

function temporaryPassword() { return `${randomBytes(9).toString("base64url")}9!`; }

async function allowedBranches(tenantId: number, ids: number[]) {
  const unique = [...new Set(ids)];
  const branches = await prisma.sucursal.findMany({ where: { tenantId, estado: "activo", id: { in: unique } }, select: { id: true, nombre: true } });
  if (branches.length !== unique.length) throw new Error("Una sucursal no pertenece al gimnasio");
  return branches;
}

export async function getEntrenadoresAdmin() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const [trainers, branches, members] = await Promise.all([
      prisma.perfilEntrenador.findMany({
        where: { tenantId: context.tenantId },
        include: {
          user: { select: { id: true, name: true, email: true, username: true, tenantMemberships: { where: { tenantId: context.tenantId }, select: { estado: true, rol: true } } } },
          sucursales: { select: { id: true, nombre: true } },
          socios: { where: { tenantId: context.tenantId, estado: "activo" }, select: { id: true, nombre: true, apellido: true, documento: true }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] },
          _count: { select: { rutinas: true, clases: true, mediciones: true } },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.sucursal.findMany({ where: { tenantId: context.tenantId, estado: "activo" }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      prisma.cliente.findMany({ where: { tenantId: context.tenantId, estado: "activo" }, select: { id: true, nombre: true, apellido: true, documento: true, entrenadorId: true }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
    ]);
    return { success: true, data: serializeData({ trainers, branches, members }) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudieron cargar los entrenadores" }; }
}

export async function crearEntrenador(input: z.input<typeof createTrainerSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const data = createTrainerSchema.parse(input); const branches = await allowedBranches(context.tenantId, data.sucursalIds);
    const passwordText = temporaryPassword(); const password = await hashPassword(passwordText);
    const trainer = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: data.name, email: data.email, username: data.username, displayUsername: data.username, emailVerified: true, nivel: "entrenador", estado: "activo", sucursales: { connect: branches.map(({ id }) => ({ id })) } } });
      await tx.account.create({ data: { accountId: user.id, providerId: "credential", userId: user.id, password, issuer: "local:credential" } });
      await tx.tenantUsuario.create({ data: { tenantId: context.tenantId, userId: user.id, rol: RolTenant.ENTRENADOR, estado: "activo" } });
      return tx.perfilEntrenador.create({ data: { tenantId: context.tenantId, userId: user.id, bio: data.bio || null, foto: data.foto || null, especialidades: [...new Set(data.especialidades)], horarios: data.horarios as Prisma.InputJsonValue, estado: "activo", sucursales: { connect: branches.map(({ id }) => ({ id })) } }, include: { user: { select: { name: true, email: true, username: true } }, sucursales: true } });
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "entrenador.crear", entidad: "PerfilEntrenador", entidadId: trainer.id, metadata: { sucursalIds: branches.map(({ id }) => id), especialidades: data.especialidades } });
    return {
      success: true,
      data: serializeData(trainer),
      temporaryPassword: passwordText,
      credentials: { name: trainer.user.name, email: trainer.user.email, username: trainer.user.username, password: passwordText },
    };
  } catch (error) { return { success: false, error: (error as { code?: string }).code === "P2002" ? "El email o usuario ya está registrado" : error instanceof Error ? error.message : "No se pudo crear el entrenador" }; }
}

export async function regenerarAccesoEntrenador(trainerId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const id = z.number().int().positive().parse(trainerId);
    const profile = await prisma.perfilEntrenador.findFirst({
      where: { id, tenantId: context.tenantId },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            name: true,
            email: true,
            username: true,
            _count: { select: { tenantMemberships: true } },
          },
        },
      },
    });
    if (!profile) return { success: false, error: "Entrenador no encontrado" };
    if (profile.user._count.tenantMemberships > 1) {
      return { success: false, error: "Este usuario pertenece a más de un gimnasio. Su clave global no puede regenerarse desde un tenant." };
    }

    const passwordText = temporaryPassword();
    const password = await hashPassword(passwordText);
    const updated = await prisma.account.updateMany({
      where: { userId: profile.userId, providerId: "credential" },
      data: { password },
    });
    if (!updated.count) return { success: false, error: "No se encontró una credencial local para este entrenador" };

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "entrenador.regenerar_acceso",
      entidad: "PerfilEntrenador",
      entidadId: id,
    });

    return {
      success: true,
      credentials: {
        name: profile.user.name,
        email: profile.user.email,
        username: profile.user.username,
        password: passwordText,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo regenerar el acceso" };
  }
}

export async function actualizarEntrenador(trainerId: number, input: z.input<typeof trainerProfileSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const id = z.number().int().positive().parse(trainerId); const data = trainerProfileSchema.parse(input); const branches = await allowedBranches(context.tenantId, data.sucursalIds);
    const profile = await prisma.perfilEntrenador.findFirst({
      where: { id, tenantId: context.tenantId },
      select: { id: true, userId: true, user: { select: { name: true, _count: { select: { tenantMemberships: true } } } } },
    });
    if (!profile) return { success: false, error: "Entrenador no encontrado" };
    if (profile.user._count.tenantMemberships > 1 && data.name !== profile.user.name) {
      return { success: false, error: "Esta identidad pertenece a más de un tenant; el nombre global no puede modificarse desde un gimnasio" };
    }
    const currentTenantBranches = await prisma.sucursal.findMany({ where: { tenantId: context.tenantId, usuarios: { some: { id: profile.userId } } }, select: { id: true } });
    const desiredIds = new Set(branches.map(({ id: branchId }) => branchId));
    const currentIds = new Set(currentTenantBranches.map(({ id: branchId }) => branchId));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: profile.userId }, data: { name: data.name, sucursales: { disconnect: currentTenantBranches.filter(({ id: branchId }) => !desiredIds.has(branchId)).map(({ id: branchId }) => ({ id: branchId })), connect: branches.filter(({ id: branchId }) => !currentIds.has(branchId)).map(({ id: branchId }) => ({ id: branchId })) } } });
      return tx.perfilEntrenador.update({ where: { id }, data: { bio: data.bio || null, foto: data.foto || null, especialidades: [...new Set(data.especialidades)], horarios: data.horarios as Prisma.InputJsonValue, sucursales: { set: branches.map(({ id: branchId }) => ({ id: branchId })) } }, include: { user: { select: { name: true, email: true, username: true } }, sucursales: true } });
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "entrenador.actualizar", entidad: "PerfilEntrenador", entidadId: id, metadata: { sucursalIds: branches.map(({ id: branchId }) => branchId), especialidades: data.especialidades } });
    return { success: true, data: serializeData(updated) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el entrenador" }; }
}

export async function cambiarEstadoEntrenador(trainerId: number, activar: boolean) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] }); const id = z.number().int().positive().parse(trainerId);
    const profile = await prisma.perfilEntrenador.findFirst({ where: { id, tenantId: context.tenantId }, select: { id: true, userId: true } });
    if (!profile) return { success: false, error: "Entrenador no encontrado" };
    const estado = activar ? "activo" : "inactivo";
    await prisma.$transaction([
      prisma.perfilEntrenador.update({ where: { id }, data: { estado } }),
      prisma.tenantUsuario.update({ where: { tenantId_userId: { tenantId: context.tenantId, userId: profile.userId } }, data: { estado } }),
    ]);
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: activar ? "entrenador.activar" : "entrenador.pausar", entidad: "PerfilEntrenador", entidadId: id });
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo cambiar el estado" }; }
}

export async function asignarSociosEntrenador(trainerId: number, memberIds: number[]) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] }); const id = z.number().int().positive().parse(trainerId); const ids = z.array(z.number().int().positive()).max(500).parse(memberIds); const unique = [...new Set(ids)];
    const [trainer, ownedMembers] = await Promise.all([
      prisma.perfilEntrenador.findFirst({ where: { id, tenantId: context.tenantId, estado: "activo" }, select: { id: true, sucursales: { select: { id: true } } } }),
      prisma.cliente.findMany({ where: { tenantId: context.tenantId, id: { in: unique }, estado: "activo" }, select: { id: true, sucursales: { select: { id: true } } } }),
    ]);
    if (!trainer) return { success: false, error: "Entrenador no disponible" };
    if (ownedMembers.length !== unique.length) return { success: false, error: "Uno o más socios no pertenecen al gimnasio" };

    const trainerBranchIds = new Set(trainer.sucursales.map(({ id: branchId }) => branchId));
    const outsideTrainerBranches = ownedMembers.filter((member) => !member.sucursales.some(({ id: branchId }) => trainerBranchIds.has(branchId)));
    if (outsideTrainerBranches.length) {
      return { success: false, error: "Uno o más socios no comparten ninguna sede con el entrenador" };
    }

    const previous = await prisma.cliente.findMany({ where: { tenantId: context.tenantId, entrenadorId: id }, select: { id: true } }); const previousIds = previous.map(({ id: memberId }) => memberId);
    await prisma.$transaction([
      prisma.cliente.updateMany({ where: { tenantId: context.tenantId, entrenadorId: id, id: { notIn: unique } }, data: { entrenadorId: null } }),
      prisma.cliente.updateMany({ where: { tenantId: context.tenantId, id: { in: unique } }, data: { entrenadorId: id } }),
    ]);
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "entrenador.asignar_socios", entidad: "PerfilEntrenador", entidadId: id, metadata: { anteriores: previousIds, nuevos: unique } });
    return { success: true, data: { asignados: unique.length } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudieron asignar los socios" }; }
}

export async function getSocioEntrenadorDetalle(clienteId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.ENTRENADOR, RolTenant.OWNER, RolTenant.ADMIN] }); const id = z.number().int().positive().parse(clienteId); const memberScope = await getStaffMemberScope(context);
    const member = await prisma.cliente.findFirst({ where: { id, ...memberScope, estado: "activo" }, select: { id: true, nombre: true, apellido: true, documento: true, telefono: true, email: true, foto: true, fechaNacimiento: true, contactoEmergencia: true, fechaRegistro: true, sucursalHabitual: { select: { nombre: true } }, objetivos: { where: { activo: true }, orderBy: [{ principal: "desc" }, { fechaInicio: "desc" }] }, mediciones: { orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 20 }, ingresos: { orderBy: { fechaHora: "desc" }, take: 30 }, asignacionesEntrenamiento: { where: { estado: "activa" }, include: { plan: { select: { nombre: true, objetivo: true } }, rutina: { select: { nombre: true, objetivo: true } } }, take: 1 }, sesionesEntrenamiento: { where: { estado: "finalizada" }, include: { rutina: { select: { nombre: true } }, ejercicios: { include: { ejercicio: { select: { nombre: true } }, series: { where: { completada: true }, orderBy: { numero: "asc" } } } } }, orderBy: { iniciadaEn: "desc" }, take: 20 }, fotosProgreso: { select: { id: true, fecha: true, tipo: true }, orderBy: { fecha: "desc" }, take: 12 } } });
    if (!member) return { success: false, error: "Socio no encontrado o no autorizado" };
    return { success: true, data: serializeData(member) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo cargar el socio" }; }
}
