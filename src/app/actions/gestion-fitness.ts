"use server";

import { RolTenant } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { writeAudit } from "@/lib/audit";

const staffRoles = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION, RolTenant.ENTRENADOR];

export async function getDashboardEntrenador() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.ENTRENADOR, RolTenant.OWNER, RolTenant.ADMIN] });
    const profile = await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, include: { user: { select: { name: true, image: true } }, sucursales: { select: { id: true, nombre: true } } } });
    if (context.role === RolTenant.ENTRENADOR && !profile) return { success: false, error: "Tu perfil de entrenador no está activo" };
    const trainerFilter = context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {};
    const now = new Date(); const inSevenDays = new Date(now.getTime() + 7 * 86400000); const inactiveSince = new Date(now.getTime() - 7 * 86400000); const measurementSince = new Date(now.getTime() - 30 * 86400000);
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0); const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
    const memberWhere = { tenantId: context.tenantId, estado: "activo", ...trainerFilter };
    const [members, classes, inactiveMembers, measurementsPending, workoutsToday] = await Promise.all([
      prisma.cliente.findMany({ where: memberWhere, include: { mediciones: { orderBy: { fecha: "desc" }, take: 1 }, ingresos: { orderBy: { fechaHora: "desc" }, take: 1 }, asignacionesEntrenamiento: { where: { estado: "activa" }, include: { plan: { select: { nombre: true } }, rutina: { select: { nombre: true } } }, take: 1 }, sesionesEntrenamiento: { where: { estado: "finalizada" }, orderBy: { iniciadaEn: "desc" }, take: 1, select: { iniciadaEn: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }], take: 100 }),
      prisma.clase.findMany({ where: { tenantId: context.tenantId, estado: "programada", inicio: { gte: now, lte: inSevenDays }, ...(profile && context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile.id } : {}) }, include: { tipoClase: true, sucursal: true, _count: { select: { reservas: { where: { estado: { in: ["confirmada", "asistio"] } } } } } }, orderBy: { inicio: "asc" } }),
      prisma.cliente.findMany({ where: { tenantId: context.tenantId, estado: "activo", ...trainerFilter, OR: [{ ingresos: { none: {} } }, { ingresos: { none: { fechaHora: { gte: inactiveSince } } } }] }, select: { id: true, nombre: true, apellido: true, ingresos: { orderBy: { fechaHora: "desc" }, take: 1 } }, take: 20 }),
      prisma.cliente.findMany({ where: { ...memberWhere, OR: [{ mediciones: { none: {} } }, { mediciones: { none: { fecha: { gte: measurementSince } } } }] }, select: { id: true, nombre: true, apellido: true, mediciones: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }], take: 20 }),
      prisma.sesionEntrenamiento.count({ where: { tenantId: context.tenantId, cliente: memberWhere, iniciadaEn: { gte: startToday, lt: endToday } } }),
    ]);
    return { success: true, data: serializeData({ trainer: profile, members, classes, inactiveMembers, measurementsPending, workoutsToday }) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No autorizado" }; }
}

export async function getClasesAdmin() {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "clases");
    const hasScopedBranches = context.role === RolTenant.RECEPCION || context.role === RolTenant.ENTRENADOR;
    const profile = context.role === RolTenant.ENTRENADOR ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, select: { id: true } }) : null;
    const [classes, classTypes, branches, trainers] = await Promise.all([
      prisma.clase.findMany({ where: { tenantId: context.tenantId, inicio: { gte: new Date(Date.now() - 30 * 86400000), lte: new Date(Date.now() + 120 * 86400000) }, ...(context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {}) }, include: { tipoClase: true, sucursal: true, entrenador: { include: { user: { select: { name: true } } } }, reservas: { where: { estado: { in: ["confirmada", "espera", "asistio"] } }, include: { cliente: { select: { id: true, nombre: true, apellido: true, documento: true } } }, orderBy: [{ posicionEspera: "asc" }, { creadaEn: "asc" }] } }, orderBy: { inicio: "asc" }, take: 250 }),
      prisma.tipoClase.findMany({ where: { tenantId: context.tenantId, activo: true }, orderBy: { nombre: "asc" } }),
      prisma.sucursal.findMany({ where: { tenantId: context.tenantId, estado: "activo", ...(hasScopedBranches ? { usuarios: { some: { id: context.userId } } } : {}) }, orderBy: { nombre: "asc" } }),
      prisma.perfilEntrenador.findMany({ where: { tenantId: context.tenantId, estado: "activo" }, include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    ]);
    return { success: true, data: serializeData({ classes, classTypes, branches, trainers }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

const classSchema = z.object({ tipoClaseId: z.number().int().positive(), entrenadorId: z.number().int().positive().nullable(), sucursalId: z.number().int().positive(), sala: z.string().trim().max(80).optional(), inicio: z.coerce.date(), duracionMinutos: z.number().int().min(15).max(300), cupoMaximo: z.number().int().min(1).max(500) });

export async function crearClase(input: z.input<typeof classSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "clases");
    const data = classSchema.parse(input);
    const hasScopedBranches = context.role === RolTenant.RECEPCION || context.role === RolTenant.ENTRENADOR;
    const ownTrainer = context.role === RolTenant.ENTRENADOR ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, select: { id: true } }) : null;
    if (context.role === RolTenant.ENTRENADOR && data.entrenadorId !== ownTrainer?.id) return { success: false, error: "Sólo podés programar tus propias clases" };
    const [type, branch, trainer] = await Promise.all([
      prisma.tipoClase.findFirst({ where: { id: data.tipoClaseId, tenantId: context.tenantId, activo: true }, select: { id: true } }),
      prisma.sucursal.findFirst({ where: { id: data.sucursalId, tenantId: context.tenantId, estado: "activo", ...(hasScopedBranches ? { usuarios: { some: { id: context.userId } } } : {}) }, select: { id: true } }),
      data.entrenadorId ? prisma.perfilEntrenador.findFirst({ where: { id: data.entrenadorId, tenantId: context.tenantId, estado: "activo" }, select: { id: true } }) : null,
    ]);
    if (!type || !branch || (data.entrenadorId && !trainer)) return { success: false, error: "La clase contiene relaciones no autorizadas" };
    const gymClass = await prisma.clase.create({ data: { tenantId: context.tenantId, ...data, sala: data.sala || null } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "clase.crear", entidad: "Clase", entidadId: gymClass.id, metadata: { sucursalId: data.sucursalId, tipoClaseId: data.tipoClaseId, inicio: data.inicio, cupoMaximo: data.cupoMaximo } });
    return { success: true, data: serializeData(gymClass) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear la clase" };
  }
}

export async function actualizarClase(claseId: number, input: z.input<typeof classSchema>) {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "clases");
    const id = z.number().int().positive().parse(claseId); const data = classSchema.parse(input);
    const hasScopedBranches = context.role === RolTenant.RECEPCION || context.role === RolTenant.ENTRENADOR;
    const profile = context.role === RolTenant.ENTRENADOR ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, select: { id: true } }) : null;
    const existing = await prisma.clase.findFirst({ where: { id, tenantId: context.tenantId, ...(context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {}) }, select: { id: true, estado: true, inicio: true, tipoClaseId: true, sucursalId: true, entrenadorId: true, sala: true, reservas: { where: { estado: { in: ["confirmada", "espera"] } }, select: { clienteId: true } } } });
    if (!existing) return { success: false, error: "Clase no encontrada" };
    if (existing.estado === "cancelada") return { success: false, error: "Una clase cancelada no puede editarse" };
    if (context.role === RolTenant.ENTRENADOR && data.entrenadorId !== profile?.id) return { success: false, error: "Sólo podés administrar tus propias clases" };
    const [type, branch, trainer, confirmed] = await Promise.all([
      prisma.tipoClase.findFirst({ where: { id: data.tipoClaseId, tenantId: context.tenantId, activo: true }, select: { id: true } }),
      prisma.sucursal.findFirst({ where: { id: data.sucursalId, tenantId: context.tenantId, estado: "activo", ...(hasScopedBranches ? { usuarios: { some: { id: context.userId } } } : {}) }, select: { id: true } }),
      data.entrenadorId ? prisma.perfilEntrenador.findFirst({ where: { id: data.entrenadorId, tenantId: context.tenantId, estado: "activo" }, select: { id: true } }) : null,
      prisma.reservaClase.count({ where: { tenantId: context.tenantId, claseId: id, estado: { in: ["confirmada", "asistio"] } } }),
    ]);
    if (!type || !branch || (data.entrenadorId && !trainer)) return { success: false, error: "La clase contiene relaciones no autorizadas" };
    if (data.cupoMaximo < confirmed) return { success: false, error: `El cupo no puede ser menor a las ${confirmed} reservas confirmadas` };
    const scheduleChanged = existing.inicio.getTime() !== data.inicio.getTime() || existing.tipoClaseId !== data.tipoClaseId || existing.sucursalId !== data.sucursalId || existing.entrenadorId !== data.entrenadorId || (existing.sala || "") !== (data.sala || "");
    const gymClass = await prisma.$transaction(async (tx) => {
      const updated = await tx.clase.update({ where: { id }, data: { ...data, sala: data.sala || null } });
      if (scheduleChanged && existing.reservas.length) await tx.notificacion.createMany({ data: existing.reservas.map((booking) => ({ tenantId: context.tenantId, clienteId: booking.clienteId, tipo: "clase_actualizada", titulo: "Clase actualizada", mensaje: "Cambió la información de una clase que reservaste. Revisá la agenda." })) });
      return updated;
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "clase.actualizar", entidad: "Clase", entidadId: id, metadata: { sucursalId: data.sucursalId, inicio: data.inicio, cupoMaximo: data.cupoMaximo } });
    return { success: true, data: serializeData(gymClass) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar la clase" }; }
}

export async function cancelarClaseAdmin(claseId: number) {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "clases");
    const id = z.number().int().positive().parse(claseId);
    const profile = context.role === RolTenant.ENTRENADOR ? await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" }, select: { id: true } }) : null;
    const affected = await prisma.$transaction(async (tx) => {
      const gymClass = await tx.clase.findFirst({ where: { id, tenantId: context.tenantId, estado: "programada", ...(context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {}) }, include: { tipoClase: { select: { nombre: true } }, reservas: { where: { estado: { in: ["confirmada", "espera"] } }, select: { id: true, clienteId: true } } } });
      if (!gymClass) throw new Error("Clase no encontrada o ya cancelada");
      await tx.clase.update({ where: { id }, data: { estado: "cancelada" } });
      await tx.reservaClase.updateMany({ where: { claseId: id, tenantId: context.tenantId, estado: { in: ["confirmada", "espera"] } }, data: { estado: "cancelada", canceladaEn: new Date(), posicionEspera: null } });
      if (gymClass.reservas.length) await tx.notificacion.createMany({ data: gymClass.reservas.map((booking) => ({ tenantId: context.tenantId, clienteId: booking.clienteId, tipo: "clase_cancelada", titulo: "Clase cancelada", mensaje: `La clase ${gymClass.tipoClase.nombre} fue cancelada.` })) });
      return gymClass.reservas.length;
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "clase.cancelar", entidad: "Clase", entidadId: id, metadata: { reservasCanceladas: affected } });
    return { success: true, data: { reservasCanceladas: affected } };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo cancelar la clase" }; }
}

export async function registrarAsistenciaClase(reservaId: number, asistio: boolean) {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "clases");
    const id = z.number().int().positive().parse(reservaId);

    const reserva = await prisma.reservaClase.findFirst({
      where: { id, tenantId: context.tenantId },
      include: { cliente: true, clase: { include: { tipoClase: true } } },
    });
    if (!reserva) return { success: false, error: "Reserva no encontrada" };

    const nuevoEstado = asistio ? "asistio" : "confirmada";
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.reservaClase.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          asistenciaEn: asistio ? new Date() : null,
        },
      });

      if (asistio) {
        // Otorgar puntos por asistencia a clase si hay regla configurada
        const regla = await tx.reglaPuntos.findUnique({
          where: { tenantId_evento: { tenantId: context.tenantId, evento: "asistencia_clase" } },
        });
        const puntos = regla?.activo ? regla.puntos : 15;
        if (puntos > 0) {
          await tx.movimientoPuntos.create({
            data: {
              tenantId: context.tenantId,
              clienteId: reserva.clienteId,
              puntos,
              tipo: "clase",
              concepto: `Asistencia a clase: ${reserva.clase.tipoClase.nombre}`,
              referencia: `clase:${reserva.claseId}`,
            },
          });
        }
      }

      return u;
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "clase.asistencia",
      entidad: "ReservaClase",
      entidadId: id,
      metadata: { clienteId: reserva.clienteId, asistio },
    });

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo registrar asistencia" };
  }
}

export async function administrarReservaManual(claseId: number, clienteId: number, accion: "inscribir" | "cancelar") {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "clases");

    const gymClass = await prisma.clase.findFirst({
      where: { id: claseId, tenantId: context.tenantId, estado: "programada" },
      include: { tipoClase: true },
    });
    if (!gymClass) return { success: false, error: "Clase no disponible" };

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: context.tenantId, estado: "activo" },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado o inactivo" };

    if (accion === "inscribir") {
      const confirmed = await prisma.reservaClase.count({
        where: { claseId, estado: { in: ["confirmada", "asistio"] } },
      });
      const hasRoom = confirmed < gymClass.cupoMaximo;
      const estado = hasRoom ? "confirmada" : "espera";
      const waitingCount = await prisma.reservaClase.count({ where: { claseId, estado: "espera" } });
      const posicionEspera = hasRoom ? null : waitingCount + 1;

      const reserva = await prisma.reservaClase.upsert({
        where: { claseId_clienteId: { claseId, clienteId } },
        update: { estado, posicionEspera, canceladaEn: null },
        create: {
          tenantId: context.tenantId,
          claseId,
          clienteId,
          estado,
          posicionEspera,
        },
      });

      await prisma.notificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId,
          tipo: "reserva_manual",
          titulo: estado === "confirmada" ? "¡Inscripción confirmada!" : "En lista de espera",
          mensaje: `Recepción te inscribió en la clase de ${gymClass.tipoClase.nombre}.`,
        },
      });

      await writeAudit({
        tenantId: context.tenantId,
        actorUserId: context.userId,
        accion: "reserva.admin_inscribir",
        entidad: "ReservaClase",
        entidadId: reserva.id,
        metadata: { claseId, clienteId, estado },
      });

      return { success: true, data: serializeData(reserva), mensaje: estado === "confirmada" ? "Inscripción confirmada" : "Inscrito en lista de espera" };
    } else {
      const existing = await prisma.reservaClase.findFirst({
        where: { claseId, clienteId, tenantId: context.tenantId, estado: { in: ["confirmada", "espera"] } },
      });
      if (!existing) return { success: false, error: "El socio no tiene reserva activa en esta clase" };

      const wasConfirmed = existing.estado === "confirmada";
      await prisma.reservaClase.update({
        where: { id: existing.id },
        data: { estado: "cancelada", canceladaEn: new Date(), posicionEspera: null },
      });

      if (wasConfirmed) {
        const next = await prisma.reservaClase.findFirst({
          where: { claseId, tenantId: context.tenantId, estado: "espera" },
          orderBy: [{ posicionEspera: "asc" }, { creadaEn: "asc" }],
        });
        if (next) {
          await prisma.reservaClase.update({
            where: { id: next.id },
            data: { estado: "confirmada", posicionEspera: null },
          });
          await prisma.notificacion.create({
            data: {
              tenantId: context.tenantId,
              clienteId: next.clienteId,
              tipo: "reserva_confirmada",
              titulo: "¡Se liberó tu lugar!",
              mensaje: `Tu reserva para ${gymClass.tipoClase.nombre} pasó a confirmada.`,
            },
          });
        }
      }

      await writeAudit({
        tenantId: context.tenantId,
        actorUserId: context.userId,
        accion: "reserva.admin_cancelar",
        entidad: "ReservaClase",
        entidadId: existing.id,
        metadata: { claseId, clienteId },
      });

      return { success: true, mensaje: "Reserva cancelada correctamente" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al gestionar reserva" };
  }
}

const classTypeSchema = z.object({ nombre: z.string().trim().min(2).max(100), descripcion: z.string().trim().max(1000).optional(), color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional() });
export async function crearTipoClase(input: z.input<typeof classTypeSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "clases"); const data = classTypeSchema.parse(input);
    const type = await prisma.tipoClase.create({ data: { tenantId: context.tenantId, ...data, descripcion: data.descripcion || null, color: data.color || null } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "tipo_clase.crear", entidad: "TipoClase", entidadId: type.id });
    return { success: true, data: serializeData(type) };
  } catch (error) { return { success: false, error: (error as { code?: string }).code === "P2002" ? "Ya existe una actividad con ese nombre" : error instanceof Error ? error.message : "No se pudo crear la actividad" }; }
}

export async function getSociosParaSeguimiento(query = "") {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "mediciones");
    const memberScope = await getStaffMemberScope(context);
    const members = await prisma.cliente.findMany({
      where: { ...memberScope, estado: "activo", ...(query.trim() ? { OR: [{ nombre: { contains: query.trim(), mode: "insensitive" } }, { apellido: { contains: query.trim(), mode: "insensitive" } }, { documento: { contains: query.trim() } }] } : {}) },
      select: { id: true, nombre: true, apellido: true, documento: true, entrenadorId: true, mediciones: { orderBy: { fecha: "desc" }, take: 1 } },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }], take: 60,
    });
    return { success: true, data: serializeData(members) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No autorizado" }; }
}

const measurementSchema = z.object({
  clienteId: z.number().int().positive(),
  fecha: z.coerce.date().optional(),
  peso: z.number().positive().max(500).optional(),
  altura: z.number().positive().max(300).optional(),
  grasa: z.number().min(0).max(100).optional(),
  masaMuscular: z.number().min(0).max(100).optional(),
  cintura: z.number().positive().max(400).optional(),
  pecho: z.number().positive().max(400).optional(),
  brazoIzquierdo: z.number().positive().max(400).optional(),
  brazoDerecho: z.number().positive().max(400).optional(),
  piernaIzquierda: z.number().positive().max(400).optional(),
  piernaDerecha: z.number().positive().max(400).optional(),
  cadera: z.number().positive().max(400).optional(),
  observaciones: z.string().trim().max(3000).optional(),
}).refine((value) => ["peso", "altura", "grasa", "masaMuscular", "cintura", "pecho", "brazoIzquierdo", "brazoDerecho", "piernaIzquierda", "piernaDerecha", "cadera"].some((field) => value[field as keyof typeof value] != null), { message: "Ingresá al menos una medida" });

export async function getProgresoSocio(clienteId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "mediciones");
    const memberScope = await getStaffMemberScope(context);
    const member = await prisma.cliente.findFirst({
      where: { id: z.number().int().positive().parse(clienteId), ...memberScope, estado: "activo" },
      select: {
        id: true, nombre: true, apellido: true, documento: true,
        entrenador: { select: { user: { select: { name: true } } } },
        mediciones: { orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 60 },
        fotosProgreso: { select: { id: true, fecha: true, tipo: true, mimeType: true }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 60 },
      },
    });
    if (!member) return { success: false, error: "Socio no encontrado" };
    return { success: true, data: serializeData(member) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No autorizado" }; }
}

export async function registrarMedicion(input: z.input<typeof measurementSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
    await requireTenantModule(context.tenantId, "mediciones");
    const data = measurementSchema.parse(input);
    const memberScope = await getStaffMemberScope(context);
    const member = await prisma.cliente.findFirst({ where: { id: data.clienteId, ...memberScope }, select: { id: true, entrenadorId: true } });
    if (!member) return { success: false, error: "Socio no encontrado" };
    const trainer = await prisma.perfilEntrenador.findFirst({ where: { tenantId: context.tenantId, userId: context.userId }, select: { id: true } });
    const latest = await prisma.medicionCorporal.findFirst({ where: { tenantId: context.tenantId, clienteId: data.clienteId }, orderBy: [{ fecha: "desc" }, { id: "desc" }], select: { peso: true, altura: true } });
    const weightForImc = data.peso ?? (latest?.peso == null ? undefined : Number(latest.peso));
    const heightForImc = data.altura ?? (latest?.altura == null ? undefined : Number(latest.altura));
    const imc = weightForImc && heightForImc ? weightForImc / Math.pow(heightForImc / 100, 2) : undefined;
    const measurement = await prisma.medicionCorporal.create({ data: { tenantId: context.tenantId, entrenadorId: trainer?.id, ...data, imc, observaciones: data.observaciones || null } });
    await prisma.notificacion.create({ data: { tenantId: context.tenantId, clienteId: data.clienteId, tipo: "medicion", titulo: "Nueva medición", mensaje: "Tu progreso corporal fue actualizado." } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "medicion.crear", entidad: "MedicionCorporal", entidadId: measurement.id, metadata: { clienteId: data.clienteId, campos: Object.keys(data).filter((key) => key !== "observaciones") } });
    return { success: true, data: serializeData(measurement) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo registrar" }; }
}

export async function getRecompensasAdmin() {
  try {
    const context = await requireStaffContext({ roles: staffRoles });
    await requireTenantModule(context.tenantId, "puntos");
    const [rewards, benefits, movements] = await Promise.all([
      prisma.premio.findMany({ where: { tenantId: context.tenantId }, include: { _count: { select: { canjes: true } } }, orderBy: [{ activo: "desc" }, { puntos: "asc" }] }),
      prisma.beneficio.findMany({ where: { tenantId: context.tenantId }, orderBy: [{ activo: "desc" }, { titulo: "asc" }] }),
      prisma.movimientoPuntos.aggregate({ where: { tenantId: context.tenantId }, _sum: { puntos: true }, _count: true }),
    ]);
    return { success: true, data: serializeData({ rewards, benefits, movements }) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No autorizado" }; }
}

const rewardSchema = z.object({ nombre: z.string().trim().min(2).max(120), descripcion: z.string().trim().max(2000).optional(), puntos: z.number().int().positive(), stock: z.number().int().min(0).nullable() });
export async function crearPremio(input: z.input<typeof rewardSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "puntos");
    const data = rewardSchema.parse(input);
    const reward = await prisma.premio.create({ data: { tenantId: context.tenantId, ...data } });
    return { success: true, data: serializeData(reward) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo crear" }; }
}
