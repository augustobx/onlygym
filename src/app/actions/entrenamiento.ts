"use server";

import { Prisma, RolTenant } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireMemberContext } from "@/lib/member-context";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";
import { getCurrentPhase, getNextRoutineDay } from "@/lib/training-plan";

const exerciseSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(3000).optional(),
  grupoMuscular: z.string().trim().min(2).max(60),
  categoria: z.string().trim().max(60).optional(),
  equipamiento: z.string().trim().max(100).optional(),
  dificultad: z.string().trim().max(40).optional(),
  instrucciones: z.string().trim().max(5000).optional(),
  observaciones: z.string().trim().max(3000).optional(),
  videoUrl: z.url().optional().or(z.literal("")),
  imagenUrl: z.url().optional().or(z.literal("")),
});

const routineSchema = z.object({
  id: z.number().int().positive().optional(),
  nombre: z.string().trim().min(2).max(140),
  descripcion: z.string().trim().max(3000).optional(),
  objetivo: z.string().trim().max(100).optional(),
  nivel: z.string().trim().max(40).optional(),
  duracionMinutos: z.number().int().min(5).max(300).optional(),
  recomendaciones: z.string().trim().max(5000).optional(),
  ejercicios: z.array(z.object({
    ejercicioId: z.number().int().positive(),
    dia: z.number().int().min(1).max(14).default(1),
    orden: z.number().int().min(1),
    series: z.number().int().min(1).max(20),
    repeticiones: z.string().trim().min(1).max(30),
    pesoSugerido: z.number().min(0).max(2000).optional(),
    descansoSegundos: z.number().int().min(0).max(3600).optional(),
    tiempoSegundos: z.number().int().min(0).max(14400).optional(),
    observaciones: z.string().trim().max(1000).optional(),
  })).min(1),
});

async function editableRoutine(rutinaId: number, tenantId: number, role: RolTenant, userId: string) {
  return prisma.rutina.findFirst({
    where: {
      id: rutinaId,
      tenantId,
      ...(role === RolTenant.ENTRENADOR ? { entrenador: { userId, estado: "activo" } } : {}),
    },
    select: { id: true },
  });
}

const setSchema = z.object({
  ejercicioSesionId: z.number().int().positive(),
  numero: z.number().int().min(1).max(50),
  peso: z.number().min(0).max(2000).nullable(),
  repeticiones: z.number().int().min(0).max(1000).nullable(),
  esfuerzoPercibido: z.number().int().min(1).max(10).nullable().optional(),
  completada: z.boolean(),
  comentario: z.string().trim().max(255).optional(),
});

function availableRoutineDay(exercises: Array<{ dia: number }>, suggestedDay: number) {
  const days = [...new Set(exercises.map((item) => item.dia))].sort((a, b) => a - b);
  return days.includes(suggestedDay) ? suggestedDay : days.find((day) => day >= suggestedDay) ?? days[0] ?? 1;
}

export async function getEjerciciosAdmin() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = await prisma.ejercicio.findMany({ where: { tenantId: context.tenantId }, orderBy: [{ activo: "desc" }, { nombre: "asc" }] });
    return { success: true, data: serializeData(data) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function getRutinasAdmin() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = await prisma.rutina.findMany({
      where: { tenantId: context.tenantId },
      include: {
        entrenador: { include: { user: { select: { name: true } } } },
        ejercicios: { include: { ejercicio: true }, orderBy: [{ dia: "asc" }, { orden: "asc" }] },
        _count: { select: { asignaciones: true } },
      },
      orderBy: [{ estado: "asc" }, { actualizadoEn: "desc" }],
    });
    return { success: true, data: serializeData(data) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function archivarRutina(rutinaId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const routine = await editableRoutine(rutinaId, context.tenantId, context.role, context.userId);
    if (!routine) return { success: false, error: "Rutina no encontrada o no autorizada" };
    await prisma.rutina.update({ where: { id: routine.id }, data: { estado: "archivada" } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "rutina.archivar", entidad: "Rutina", entidadId: routine.id });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function activarRutina(rutinaId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const routine = await editableRoutine(rutinaId, context.tenantId, context.role, context.userId);
    if (!routine) return { success: false, error: "Rutina no encontrada o no autorizada" };
    await prisma.rutina.update({ where: { id: routine.id }, data: { estado: "activo" } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "rutina.activar", entidad: "Rutina", entidadId: routine.id });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo activar la rutina" };
  }
}

export async function duplicarRutina(rutinaId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const source = await prisma.rutina.findFirst({ where: { id: rutinaId, tenantId: context.tenantId }, include: { ejercicios: true } });
    if (!source) return { success: false, error: "Rutina no encontrada" };
    const trainer = context.role === RolTenant.ENTRENADOR
      ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, select: { id: true } })
      : null;
    const copy = await prisma.rutina.create({
      data: {
        tenantId: context.tenantId,
        nombre: `${source.nombre} (copia)`,
        descripcion: source.descripcion,
        objetivo: source.objetivo,
        nivel: source.nivel,
        duracionMinutos: source.duracionMinutos,
        diasCantidad: source.diasCantidad,
        entrenadorId: trainer?.id ?? source.entrenadorId,
        recomendaciones: source.recomendaciones,
        ejercicios: { create: source.ejercicios.map(({ ejercicioId, dia, orden, series, repeticiones, pesoSugerido, descansoSegundos, tiempoSegundos, observaciones }) => ({ ejercicioId, dia, orden, series, repeticiones, pesoSugerido, descansoSegundos, tiempoSegundos, observaciones })) },
      },
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "rutina.duplicar", entidad: "Rutina", entidadId: copy.id, metadata: { origenId: source.id } });
    return { success: true, data: serializeData(copy) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo duplicar" };
  }
}

export async function crearEjercicio(input: z.input<typeof exerciseSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = exerciseSchema.parse(input);
    const ejercicio = await prisma.ejercicio.create({
      data: {
        tenantId: context.tenantId,
        ...data,
        videoUrl: data.videoUrl || null,
        imagenUrl: data.imagenUrl || null,
      },
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "ejercicio.crear", entidad: "Ejercicio", entidadId: ejercicio.id });
    return { success: true, data: serializeData(ejercicio) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear el ejercicio" };
  }
}

export async function editarEjercicio(ejercicioId: number, input: z.input<typeof exerciseSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = exerciseSchema.parse(input);
    const current = await prisma.ejercicio.findFirst({ where: { id: ejercicioId, tenantId: context.tenantId }, select: { id: true } });
    if (!current) return { success: false, error: "Ejercicio no encontrado" };
    const ejercicio = await prisma.ejercicio.update({
      where: { id: current.id },
      data: { ...data, videoUrl: data.videoUrl || null, imagenUrl: data.imagenUrl || null, observaciones: data.observaciones || null },
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "ejercicio.editar", entidad: "Ejercicio", entidadId: ejercicio.id });
    return { success: true, data: serializeData(ejercicio) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo editar el ejercicio" };
  }
}

export async function cambiarEstadoEjercicio(ejercicioId: number, activo: boolean) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const result = await prisma.ejercicio.updateMany({ where: { id: ejercicioId, tenantId: context.tenantId }, data: { activo } });
    if (!result.count) return { success: false, error: "Ejercicio no encontrado" };
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: activo ? "ejercicio.activar" : "ejercicio.desactivar", entidad: "Ejercicio", entidadId: ejercicioId });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el ejercicio" };
  }
}

export async function crearRutina(input: z.input<typeof routineSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = routineSchema.parse(input);
    const exerciseIds = [...new Set(data.ejercicios.map((item) => item.ejercicioId))];
    const ownedExercises = await prisma.ejercicio.count({ where: { tenantId: context.tenantId, id: { in: exerciseIds }, activo: true } });
    if (ownedExercises !== exerciseIds.length) return { success: false, error: "Uno o más ejercicios no pertenecen al gimnasio" };

    const trainer = context.role === RolTenant.ENTRENADOR
      ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId }, select: { id: true } })
      : null;
    const routine = await prisma.rutina.create({
      data: {
        tenantId: context.tenantId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        objetivo: data.objetivo,
        nivel: data.nivel,
        duracionMinutos: data.duracionMinutos,
        recomendaciones: data.recomendaciones,
        entrenadorId: trainer?.id,
        diasCantidad: Math.max(...data.ejercicios.map((item) => item.dia)),
        ejercicios: { create: data.ejercicios },
      },
      include: { ejercicios: { include: { ejercicio: true } } },
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "rutina.crear", entidad: "Rutina", entidadId: routine.id });
    return { success: true, data: serializeData(routine) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear la rutina" };
  }
}

export async function editarRutina(input: z.input<typeof routineSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = routineSchema.extend({ id: z.number().int().positive() }).parse(input);
    const routine = await editableRoutine(data.id, context.tenantId, context.role, context.userId);
    if (!routine) return { success: false, error: "Rutina no encontrada o no autorizada" };
    const exerciseIds = [...new Set(data.ejercicios.map((item) => item.ejercicioId))];
    const ownedExercises = await prisma.ejercicio.count({ where: { tenantId: context.tenantId, id: { in: exerciseIds }, activo: true } });
    if (ownedExercises !== exerciseIds.length) return { success: false, error: "Uno o más ejercicios no pertenecen al gimnasio o están inactivos" };
    const updated = await prisma.$transaction(async (tx) => {
      await tx.rutinaEjercicio.deleteMany({ where: { rutinaId: routine.id } });
      return tx.rutina.update({
        where: { id: routine.id },
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          objetivo: data.objetivo || null,
          nivel: data.nivel || null,
          duracionMinutos: data.duracionMinutos,
          recomendaciones: data.recomendaciones || null,
          diasCantidad: Math.max(...data.ejercicios.map((item) => item.dia)),
          ejercicios: { create: data.ejercicios.map(({ ejercicioId, dia, orden, series, repeticiones, pesoSugerido, descansoSegundos, tiempoSegundos, observaciones }) => ({ ejercicioId, dia, orden, series, repeticiones, pesoSugerido, descansoSegundos, tiempoSegundos, observaciones })) },
        },
        include: { ejercicios: { include: { ejercicio: true }, orderBy: [{ dia: "asc" }, { orden: "asc" }] } },
      });
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "rutina.editar", entidad: "Rutina", entidadId: routine.id, metadata: { ejercicios: data.ejercicios.length } });
    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo editar la rutina" };
  }
}

export async function getEntrenamientoHoy() {
  try {
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "entrenamiento");
    const activeSession = await prisma.sesionEntrenamiento.findFirst({
      where: { tenantId: context.tenantId, clienteId: context.clienteId, estado: "en_curso" },
      include: { ejercicios: { include: { ejercicio: true, series: { orderBy: { numero: "asc" } } }, orderBy: { orden: "asc" } } },
    });
    if (activeSession) return { success: true, data: serializeData({ session: activeSession, status: "en_curso" }) };

    const assignment = await prisma.asignacionEntrenamiento.findFirst({
      where: { tenantId: context.tenantId, clienteId: context.clienteId, estado: "activa", fechaInicio: { lte: new Date() }, OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }] },
      include: { rutina: { include: { ejercicios: { include: { ejercicio: true }, orderBy: [{ dia: "asc" }, { orden: "asc" }] } } }, plan: { include: { fases: { include: { rutina: { include: { ejercicios: { include: { ejercicio: true }, orderBy: [{ dia: "asc" }, { orden: "asc" }] } } } }, orderBy: { orden: "asc" } } } } },
    });
    if (!assignment) return { success: true, data: null };
    const currentPhase = assignment.plan ? getCurrentPhase(assignment.plan.fases, assignment.fechaInicio) : null;
    const routine = assignment.rutina || currentPhase?.rutina || null;
    if (!routine) return { success: true, data: null };
    const [lastSession, completedCount] = await Promise.all([
      prisma.sesionEntrenamiento.findFirst({
        where: { tenantId: context.tenantId, clienteId: context.clienteId, asignacionId: assignment.id, rutinaId: routine.id, estado: "finalizada" },
        select: { diaRutina: true },
        orderBy: { iniciadaEn: "desc" },
      }),
      prisma.sesionEntrenamiento.count({ where: { tenantId: context.tenantId, clienteId: context.clienteId, asignacionId: assignment.id, rutinaId: routine.id, estado: "finalizada" } }),
    ]);
    const suggestedDay = getNextRoutineDay(routine.diasCantidad, lastSession?.diaRutina, completedCount);
    const routineDay = availableRoutineDay(routine.ejercicios, suggestedDay);
    const todayRoutine = { ...routine, ejercicios: routine.ejercicios.filter((item) => item.dia === routineDay) };
    return { success: true, data: serializeData({ assignment, currentPhase, routine: todayRoutine, routineDay, status: "pendiente" }) };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function iniciarEntrenamiento(asignacionId: number, rutinaId: number) {
  try {
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "entrenamiento");
    const assignment = await prisma.asignacionEntrenamiento.findFirst({
      where: { id: asignacionId, tenantId: context.tenantId, clienteId: context.clienteId, estado: "activa", fechaInicio: { lte: new Date() }, OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }] },
      include: { plan: { include: { fases: { orderBy: { orden: "asc" } } } } },
    });
    if (!assignment) return { success: false, error: "Entrenamiento no asignado" };
    const allowedRoutineId = assignment.rutinaId ?? (assignment.plan ? getCurrentPhase(assignment.plan.fases, assignment.fechaInicio)?.rutinaId : null);
    if (allowedRoutineId !== rutinaId) return { success: false, error: "Esta rutina no corresponde a la fase actual" };
    const routine = await prisma.rutina.findFirst({ where: { id: rutinaId, tenantId: context.tenantId, estado: "activo" }, include: { ejercicios: { orderBy: [{ dia: "asc" }, { orden: "asc" }] } } });
    if (!routine) return { success: false, error: "Rutina no disponible" };

    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.sesionEntrenamiento.findFirst({ where: { tenantId: context.tenantId, clienteId: context.clienteId, estado: "en_curso" } });
      if (existing) return existing;
      const [lastSession, completedCount] = await Promise.all([
        tx.sesionEntrenamiento.findFirst({ where: { tenantId: context.tenantId, clienteId: context.clienteId, asignacionId, rutinaId, estado: "finalizada" }, select: { diaRutina: true }, orderBy: { iniciadaEn: "desc" } }),
        tx.sesionEntrenamiento.count({ where: { tenantId: context.tenantId, clienteId: context.clienteId, asignacionId, rutinaId, estado: "finalizada" } }),
      ]);
      const suggestedDay = getNextRoutineDay(routine.diasCantidad, lastSession?.diaRutina, completedCount);
      const routineDay = availableRoutineDay(routine.ejercicios, suggestedDay);
      const workoutExercises = routine.ejercicios.filter((item) => item.dia === routineDay);
      if (!workoutExercises.length) throw new Error("La rutina no tiene ejercicios para el día actual");
      return tx.sesionEntrenamiento.create({
        data: {
          tenantId: context.tenantId,
          clienteId: context.clienteId,
          asignacionId,
          rutinaId,
          diaRutina: routineDay,
          ejercicios: { create: workoutExercises.map((item, index) => ({
            ejercicioId: item.ejercicioId,
            orden: index + 1,
            seriesObjetivo: item.series,
            repeticionesObjetivo: item.repeticiones,
            pesoSugerido: item.pesoSugerido,
            descansoSegundos: item.descansoSegundos,
            tiempoSegundos: item.tiempoSegundos,
            observaciones: item.observaciones,
            series: { create: Array.from({ length: item.series || 1 }, (_, setIndex) => ({ numero: setIndex + 1, peso: item.pesoSugerido, repeticiones: Number.parseInt(item.repeticiones || "", 10) || null })) },
          })) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit({ tenantId: context.tenantId, actorClienteId: context.clienteId, accion: "entrenamiento.iniciar", entidad: "SesionEntrenamiento", entidadId: session.id, metadata: { asignacionId, rutinaId } });
    return { success: true, data: serializeData(session) };
  } catch {
    return { success: false, error: "No se pudo iniciar el entrenamiento" };
  }
}

export async function registrarSerie(input: z.input<typeof setSchema>) {
  try {
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "entrenamiento");
    const data = setSchema.parse(input);
    const ownedExercise = await prisma.ejercicioSesion.findFirst({
      where: { id: data.ejercicioSesionId, sesion: { tenantId: context.tenantId, clienteId: context.clienteId, estado: "en_curso" } },
      select: { id: true },
    });
    if (!ownedExercise) return { success: false, error: "Serie no autorizada" };
    const set = await prisma.serieEntrenamiento.upsert({
      where: { ejercicioSesionId_numero: { ejercicioSesionId: data.ejercicioSesionId, numero: data.numero } },
      update: { peso: data.peso, repeticiones: data.repeticiones, esfuerzoPercibido: data.esfuerzoPercibido, completada: data.completada, comentario: data.comentario },
      create: { ejercicioSesionId: data.ejercicioSesionId, numero: data.numero, peso: data.peso, repeticiones: data.repeticiones, esfuerzoPercibido: data.esfuerzoPercibido, completada: data.completada, comentario: data.comentario },
    });
    return { success: true, data: serializeData(set) };
  } catch {
    return { success: false, error: "No se pudo guardar la serie" };
  }
}

export async function finalizarEntrenamiento(sessionId: number, comentario?: string) {
  try {
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "entrenamiento");
    const session = await prisma.sesionEntrenamiento.findFirst({
      where: { id: sessionId, tenantId: context.tenantId, clienteId: context.clienteId, estado: "en_curso" },
      include: { ejercicios: { include: { series: true } } },
    });
    if (!session) return { success: false, error: "Sesión no encontrada" };
    const sets = session.ejercicios.flatMap((exercise) => exercise.series);
    const completed = sets.filter((set) => set.completada).length;
    const completion = sets.length ? (completed / sets.length) * 100 : 0;
    const now = new Date();
    const duration = Math.max(1, Math.round((now.getTime() - session.iniciadaEn.getTime()) / 60000));
    const cleanComment = z.string().trim().max(1000).optional().parse(comentario) || null;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.sesionEntrenamiento.updateMany({ where: { id: session.id, estado: "en_curso" }, data: { estado: "finalizada", finalizadaEn: now, duracionMinutos: duration, cumplimiento: completion, comentario: cleanComment } });
      if (!updated.count) throw new Error("La sesión ya fue finalizada");
      await tx.movimientoPuntos.create({ data: { tenantId: context.tenantId, clienteId: context.clienteId, puntos: 20, tipo: "entrenamiento", concepto: "Entrenamiento completado", referencia: `sesion:${session.id}` } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await writeAudit({ tenantId: context.tenantId, actorClienteId: context.clienteId, accion: "entrenamiento.finalizar", entidad: "SesionEntrenamiento", entidadId: session.id, metadata: { duracionMinutos: duration, cumplimiento: Math.round(completion) } });
    return { success: true, data: { duracionMinutos: duration, cumplimiento: Math.round(completion), puntosGanados: 20 } };
  } catch {
    return { success: false, error: "No se pudo finalizar el entrenamiento" };
  }
}
