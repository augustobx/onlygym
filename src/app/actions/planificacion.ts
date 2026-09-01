"use server";

import { Prisma, RolTenant } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { writeAudit } from "@/lib/audit";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { getCurrentPhase, getPlanWeek, validateTrainingPhases } from "@/lib/training-plan";

const staffRoles = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR];

const objectiveSchema = z.object({
  id: z.number().int().positive().optional(),
  clienteId: z.number().int().positive(),
  tipo: z.string().trim().min(2).max(80),
  principal: z.boolean().default(false),
  observaciones: z.string().trim().max(5000).optional(),
});

const phaseSchema = z.object({
  rutinaId: z.number().int().positive(),
  orden: z.number().int().positive(),
  semanaInicio: z.number().int().positive(),
  semanaFin: z.number().int().positive(),
});

const planSchema = z.object({
  id: z.number().int().positive().optional(),
  nombre: z.string().trim().min(2).max(140),
  descripcion: z.string().trim().max(3000).optional(),
  objetivo: z.string().trim().max(100).optional(),
  duracionSemanas: z.number().int().min(1).max(260),
  fases: z.array(phaseSchema).min(1).max(30),
});

const assignmentSchema = z.object({
  clienteId: z.number().int().positive(),
  tipo: z.enum(["plan", "rutina"]),
  recursoId: z.number().int().positive(),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().nullable().optional(),
  notas: z.string().trim().max(3000).optional(),
});

async function getPlanningContext() {
  const context = await requireStaffContext({ roles: staffRoles });
  await requireTenantModule(context.tenantId, "entrenamiento");
  return context;
}

async function trainerProfileId(tenantId: number, userId: string) {
  return (await prisma.perfilEntrenador.findFirst({
    where: { tenantId, userId, estado: "activo" },
    select: { id: true },
  }))?.id ?? null;
}

export async function getPlanificacionAdmin() {
  try {
    const context = await getPlanningContext();
    const memberScope = await getStaffMemberScope(context);
    const [planes, asignaciones, socios, objetivos] = await Promise.all([
      prisma.planEntrenamiento.findMany({
        where: { tenantId: context.tenantId },
        include: {
          fases: { include: { rutina: { select: { id: true, nombre: true, estado: true } } }, orderBy: { orden: "asc" } },
          _count: { select: { asignaciones: true } },
        },
        orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
      }),
      prisma.asignacionEntrenamiento.findMany({
        where: { tenantId: context.tenantId, cliente: memberScope },
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true } },
          plan: { include: { fases: { include: { rutina: { select: { id: true, nombre: true } } }, orderBy: { orden: "asc" } } } },
          rutina: { select: { id: true, nombre: true } },
        },
        orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }],
      }),
      prisma.cliente.findMany({
        where: { ...memberScope, estado: "activo" },
        select: { id: true, nombre: true, apellido: true, documento: true },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      }),
      prisma.objetivoSocio.findMany({
        where: { tenantId: context.tenantId, cliente: memberScope },
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true } },
          entrenador: { include: { user: { select: { name: true } } } },
        },
        orderBy: [{ estado: "asc" }, { principal: "desc" }, { fechaInicio: "desc" }],
      }),
    ]);

    const assignmentsWithPhase = asignaciones.map((assignment) => {
      const currentPhase = assignment.plan && assignment.estado === "activa"
        ? getCurrentPhase(assignment.plan.fases, assignment.fechaInicio)
        : null;
      return { ...assignment, semanaActual: assignment.plan ? getPlanWeek(assignment.fechaInicio) : null, faseActual: currentPhase };
    });
    return { success: true, data: serializeData({ planes, asignaciones: assignmentsWithPhase, socios, objetivos }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function guardarObjetivo(input: z.input<typeof objectiveSchema>) {
  try {
    const context = await getPlanningContext();
    const data = objectiveSchema.parse(input);
    const memberScope = await getStaffMemberScope(context);
    const member = await prisma.cliente.findFirst({ where: { ...memberScope, id: data.clienteId }, select: { id: true } });
    if (!member) return { success: false, error: "Socio no autorizado" };
    const trainerId = context.role === RolTenant.ENTRENADOR ? await trainerProfileId(context.tenantId, context.userId) : null;

    const objective = await prisma.$transaction(async (tx) => {
      if (data.id) {
        const current = await tx.objetivoSocio.findFirst({ where: { id: data.id, tenantId: context.tenantId, clienteId: data.clienteId } });
        if (!current) throw new Error("Objetivo no encontrado");
      }
      if (data.principal) {
        await tx.objetivoSocio.updateMany({
          where: { tenantId: context.tenantId, clienteId: data.clienteId, estado: "activo", ...(data.id ? { id: { not: data.id } } : {}) },
          data: { principal: false },
        });
      }
      return data.id
        ? tx.objetivoSocio.update({ where: { id: data.id }, data: { tipo: data.tipo, principal: data.principal, observaciones: data.observaciones || null } })
        : tx.objetivoSocio.create({ data: { tenantId: context.tenantId, clienteId: data.clienteId, entrenadorId: trainerId, tipo: data.tipo, principal: data.principal, observaciones: data.observaciones || null } });
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: data.id ? "objetivo.editar" : "objetivo.crear", entidad: "ObjetivoSocio", entidadId: objective.id, metadata: { clienteId: data.clienteId, principal: data.principal } });
    return { success: true, data: serializeData(objective) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el objetivo" };
  }
}

export async function cambiarEstadoObjetivo(objetivoId: number, estado: "activo" | "finalizado" | "archivado") {
  try {
    const context = await getPlanningContext();
    const memberScope = await getStaffMemberScope(context);
    const objective = await prisma.objetivoSocio.findFirst({ where: { id: objetivoId, tenantId: context.tenantId, cliente: memberScope }, select: { id: true } });
    if (!objective) return { success: false, error: "Objetivo no autorizado" };
    await prisma.objetivoSocio.update({
      where: { id: objective.id },
      data: { estado, activo: estado === "activo", principal: estado === "activo" ? undefined : false, fechaFin: estado === "finalizado" ? new Date() : null },
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: `objetivo.${estado}`, entidad: "ObjetivoSocio", entidadId: objective.id });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el objetivo" };
  }
}

export async function guardarPlan(input: z.input<typeof planSchema>) {
  try {
    const context = await getPlanningContext();
    const data = planSchema.parse(input);
    const phaseError = validateTrainingPhases(data.fases, data.duracionSemanas);
    if (phaseError) return { success: false, error: phaseError };
    const routineIds = [...new Set(data.fases.map((phase) => phase.rutinaId))];
    const routineCount = await prisma.rutina.count({ where: { tenantId: context.tenantId, id: { in: routineIds }, estado: "activo" } });
    if (routineCount !== routineIds.length) return { success: false, error: "Una o más rutinas no pertenecen al gimnasio o están archivadas" };

    const plan = await prisma.$transaction(async (tx) => {
      if (data.id) {
        const current = await tx.planEntrenamiento.findFirst({ where: { id: data.id, tenantId: context.tenantId }, select: { id: true } });
        if (!current) throw new Error("Plan no encontrado");
        await tx.fasePlan.deleteMany({ where: { planId: current.id } });
        return tx.planEntrenamiento.update({
          where: { id: current.id },
          data: { nombre: data.nombre, descripcion: data.descripcion || null, objetivo: data.objetivo || null, duracionSemanas: data.duracionSemanas, fases: { create: data.fases } },
          include: { fases: { include: { rutina: true }, orderBy: { orden: "asc" } } },
        });
      }
      return tx.planEntrenamiento.create({
        data: { tenantId: context.tenantId, nombre: data.nombre, descripcion: data.descripcion || null, objetivo: data.objetivo || null, duracionSemanas: data.duracionSemanas, fases: { create: data.fases } },
        include: { fases: { include: { rutina: true }, orderBy: { orden: "asc" } } },
      });
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: data.id ? "plan.editar" : "plan.crear", entidad: "PlanEntrenamiento", entidadId: plan.id, metadata: { fases: data.fases.length, duracionSemanas: data.duracionSemanas } });
    return { success: true, data: serializeData(plan) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el plan" };
  }
}

export async function cambiarEstadoPlan(planId: number, estado: "activo" | "archivado") {
  try {
    const context = await getPlanningContext();
    const result = await prisma.planEntrenamiento.updateMany({ where: { id: planId, tenantId: context.tenantId }, data: { estado } });
    if (!result.count) return { success: false, error: "Plan no encontrado" };
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: `plan.${estado}`, entidad: "PlanEntrenamiento", entidadId: planId });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el plan" };
  }
}

export async function crearAsignacion(input: z.input<typeof assignmentSchema>) {
  try {
    const context = await getPlanningContext();
    const data = assignmentSchema.parse(input);
    if (data.fechaFin && data.fechaFin < data.fechaInicio) return { success: false, error: "La fecha de fin no puede ser anterior al inicio" };
    const memberScope = await getStaffMemberScope(context);
    const member = await prisma.cliente.findFirst({ where: { ...memberScope, id: data.clienteId }, select: { id: true } });
    if (!member) return { success: false, error: "Socio no autorizado" };
    const resource = data.tipo === "plan"
      ? await prisma.planEntrenamiento.findFirst({ where: { id: data.recursoId, tenantId: context.tenantId, estado: "activo" }, select: { id: true } })
      : await prisma.rutina.findFirst({ where: { id: data.recursoId, tenantId: context.tenantId, estado: "activo" }, select: { id: true } });
    if (!resource) return { success: false, error: `${data.tipo === "plan" ? "Plan" : "Rutina"} no disponible` };

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.asignacionEntrenamiento.updateMany({
        where: { tenantId: context.tenantId, clienteId: data.clienteId, estado: "activa" },
        data: { estado: "reemplazada", fechaFin: new Date() },
      });
      return tx.asignacionEntrenamiento.create({
        data: {
          tenantId: context.tenantId,
          clienteId: data.clienteId,
          planId: data.tipo === "plan" ? data.recursoId : null,
          rutinaId: data.tipo === "rutina" ? data.recursoId : null,
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin ?? null,
          notas: data.notas || null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "asignacion.crear", entidad: "AsignacionEntrenamiento", entidadId: assignment.id, metadata: { clienteId: data.clienteId, tipo: data.tipo, recursoId: data.recursoId } });
    return { success: true, data: serializeData(assignment) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo asignar el entrenamiento" };
  }
}

export async function cambiarEstadoAsignacion(asignacionId: number, estado: "activa" | "pausada" | "finalizada") {
  try {
    const context = await getPlanningContext();
    const memberScope = await getStaffMemberScope(context);
    const assignment = await prisma.asignacionEntrenamiento.findFirst({ where: { id: asignacionId, tenantId: context.tenantId, cliente: memberScope }, select: { id: true, clienteId: true } });
    if (!assignment) return { success: false, error: "Asignación no autorizada" };
    await prisma.$transaction(async (tx) => {
      if (estado === "activa") {
        await tx.asignacionEntrenamiento.updateMany({ where: { tenantId: context.tenantId, clienteId: assignment.clienteId, estado: "activa", id: { not: assignment.id } }, data: { estado: "reemplazada", fechaFin: new Date() } });
      }
      await tx.asignacionEntrenamiento.update({ where: { id: assignment.id }, data: { estado, fechaFin: estado === "finalizada" ? new Date() : estado === "activa" ? null : undefined } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: `asignacion.${estado}`, entidad: "AsignacionEntrenamiento", entidadId: assignment.id });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar la asignación" };
  }
}
