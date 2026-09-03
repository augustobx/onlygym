"use server";

import { RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";

export interface HorarioDiaInput {
  diaSemana: number;
  tipoApertura: "completo" | "mañana" | "tarde" | "doble" | "cerrado";
  horaApertura1?: string | null;
  horaCierre1?: string | null;
  horaApertura2?: string | null;
  horaCierre2?: string | null;
  capacidadMaxima?: number | null;
  activo?: boolean;
}

const ADMIN_ROLES = [RolTenant.OWNER, RolTenant.ADMIN];
const OPERATION_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];
const DAY_IDS = [1, 2, 3, 4, 5, 6, 0];
const OPENING_TYPES = new Set(["completo", "mañana", "tarde", "doble", "cerrado"]);
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const DIAS_DEFAULT: HorarioDiaInput[] = [
  { diaSemana: 1, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 2, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 3, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 4, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 5, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 6, tipoApertura: "mañana", horaApertura1: "08:00", horaCierre1: "13:00", capacidadMaxima: 30, activo: true },
  { diaSemana: 0, tipoApertura: "cerrado", horaApertura1: null, horaCierre1: null, capacidadMaxima: 0, activo: false },
];

function validateScheduleRows(rows: HorarioDiaInput[]) {
  if (!Array.isArray(rows) || rows.length !== 7) return "La semana debe contener exactamente 7 días";
  const days = new Set(rows.map((row) => row.diaSemana));
  if (days.size !== 7 || rows.some((row) => !DAY_IDS.includes(row.diaSemana))) return "Los días de la semana son inválidos";

  for (const row of rows) {
    if (!OPENING_TYPES.has(row.tipoApertura)) return "Tipo de apertura inválido";
    const capacity = Number(row.capacidadMaxima ?? 50);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 100000) return "La capacidad máxima es inválida";
    if (row.tipoApertura === "cerrado") continue;
    if (!row.horaApertura1 || !row.horaCierre1 || !TIME_RE.test(row.horaApertura1) || !TIME_RE.test(row.horaCierre1)) {
      return `El horario principal del día ${row.diaSemana} es inválido`;
    }
    if (row.horaApertura1 >= row.horaCierre1) return `La hora de apertura debe ser anterior al cierre en el día ${row.diaSemana}`;
    if (row.tipoApertura === "doble") {
      if (!row.horaApertura2 || !row.horaCierre2 || !TIME_RE.test(row.horaApertura2) || !TIME_RE.test(row.horaCierre2)) {
        return `El segundo turno del día ${row.diaSemana} es inválido`;
      }
      if (row.horaApertura2 >= row.horaCierre2 || row.horaCierre1 > row.horaApertura2) {
        return `Los turnos del día ${row.diaSemana} se superponen o están invertidos`;
      }
    }
  }
  return null;
}

async function requireOperationalBranch(requestedBranchId?: number) {
  const context = await requireStaffContext({ roles: OPERATION_ROLES });
  if (!context.branchId) throw new Error("Seleccioná una sucursal antes de operar con el aforo");
  if (requestedBranchId !== undefined && requestedBranchId !== context.branchId) {
    throw new Error("La sucursal solicitada no coincide con la sede activa");
  }
  return { ...context, branchId: context.branchId };
}

export async function getHorariosSemana(sucursalId: number) {
  try {
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) return { success: false, error: "Sucursal inválida" };
    const context = await requireStaffContext({ roles: ADMIN_ROLES, branchId: sucursalId });
    const branch = await prisma.sucursal.findFirst({ where: { id: sucursalId, tenantId: context.tenantId }, select: { id: true } });
    if (!branch) return { success: false, error: "Sucursal no autorizada" };

    let horarios = await prisma.configuracionHorario.findMany({
      where: { sucursalId, sucursal: { tenantId: context.tenantId } },
      orderBy: { diaSemana: "asc" },
    });

    if (horarios.length < 7) {
      await prisma.$transaction(async (tx) => {
        for (const def of DIAS_DEFAULT) {
          await tx.configuracionHorario.upsert({
            where: { sucursalId_diaSemana: { sucursalId, diaSemana: def.diaSemana } },
            update: {},
            create: {
              sucursalId,
              diaSemana: def.diaSemana,
              tipoApertura: def.tipoApertura,
              horaApertura1: def.horaApertura1,
              horaCierre1: def.horaCierre1,
              horaApertura2: def.horaApertura2 || null,
              horaCierre2: def.horaCierre2 || null,
              capacidadMaxima: def.capacidadMaxima ?? 50,
              activo: def.activo ?? true,
            },
          });
        }
      });
      horarios = await prisma.configuracionHorario.findMany({
        where: { sucursalId, sucursal: { tenantId: context.tenantId } },
        orderBy: { diaSemana: "asc" },
      });
    }

    const ordenados = DAY_IDS.map((day) => horarios.find((row) => row.diaSemana === day) || DIAS_DEFAULT.find((row) => row.diaSemana === day)!);
    return { success: true, data: serializeData(ordenados) };
  } catch (error) {
    console.error("Error al obtener horarios de atención:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error cargando horarios de atención" };
  }
}

export async function guardarHorariosSemana(sucursalId: number, horarios: HorarioDiaInput[]) {
  try {
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) return { success: false, error: "Sucursal inválida" };
    const validationError = validateScheduleRows(horarios);
    if (validationError) return { success: false, error: validationError };

    const context = await requireStaffContext({ roles: ADMIN_ROLES, branchId: sucursalId });
    const branch = await prisma.sucursal.findFirst({ where: { id: sucursalId, tenantId: context.tenantId }, select: { id: true } });
    if (!branch) return { success: false, error: "Sucursal no autorizada" };

    await prisma.$transaction(async (tx) => {
      for (const row of horarios) {
        const closed = row.tipoApertura === "cerrado";
        const capacity = Number(row.capacidadMaxima ?? 50);
        const payload = {
          tipoApertura: row.tipoApertura,
          horaApertura1: closed ? null : row.horaApertura1 || null,
          horaCierre1: closed ? null : row.horaCierre1 || null,
          horaApertura2: row.tipoApertura === "doble" ? row.horaApertura2 || null : null,
          horaCierre2: row.tipoApertura === "doble" ? row.horaCierre2 || null : null,
          capacidadMaxima: capacity,
          activo: !closed,
        };
        await tx.configuracionHorario.upsert({
          where: { sucursalId_diaSemana: { sucursalId, diaSemana: row.diaSemana } },
          update: payload,
          create: { sucursalId, diaSemana: row.diaSemana, ...payload },
        });
      }
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "sucursal.horarios_actualizar",
      entidad: "Sucursal",
      entidadId: sucursalId,
      metadata: { dias: horarios.length },
    });
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/aforo");
    revalidatePath("/molinete");
    return { success: true };
  } catch (error) {
    console.error("Error guardando horarios:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error al guardar la configuración de horarios" };
  }
}

export async function verificarHorarioAtencion(sucursalId?: number) {
  try {
    const context = await requireOperationalBranch(sucursalId);
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const horaActualStr = ahora.toTimeString().substring(0, 5);
    const config = await prisma.configuracionHorario.findFirst({
      where: { sucursalId: context.branchId, diaSemana, sucursal: { tenantId: context.tenantId } },
    });

    if (!config || !config.activo || config.tipoApertura === "cerrado") {
      return { permitido: false, motivo: "El gimnasio se encuentra cerrado hoy.", diaSemana, horaActual: horaActualStr };
    }

    const { tipoApertura, horaApertura1, horaCierre1, horaApertura2, horaCierre2 } = config;
    if (tipoApertura === "completo" || tipoApertura === "mañana" || tipoApertura === "tarde") {
      if (horaApertura1 && horaCierre1 && horaActualStr >= horaApertura1 && horaActualStr <= horaCierre1) {
        return { permitido: true, diaSemana, horaActual: horaActualStr };
      }
    } else if (tipoApertura === "doble") {
      const turno1 = horaApertura1 && horaCierre1 && horaActualStr >= horaApertura1 && horaActualStr <= horaCierre1;
      const turno2 = horaApertura2 && horaCierre2 && horaActualStr >= horaApertura2 && horaActualStr <= horaCierre2;
      if (turno1 || turno2) return { permitido: true, diaSemana, horaActual: horaActualStr };
    }

    return {
      permitido: false,
      motivo: `Fuera de horario de atención (Horario: ${horaApertura1 || ""} a ${horaCierre1 || ""}${horaApertura2 ? ` y ${horaApertura2} a ${horaCierre2}` : ""})`,
      diaSemana,
      horaActual: horaActualStr,
    };
  } catch (error) {
    return { permitido: false, motivo: error instanceof Error ? error.message : "No se pudo verificar el horario de atención" };
  }
}

export async function getAforoEnVivo(sucursalId?: number) {
  try {
    const context = await requireOperationalBranch(sucursalId);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ahora = new Date();
    const diaSemana = ahora.getDay();

    const [ingresosActivos, configHorario, ultimasSalidas, todasLasSalidas] = await Promise.all([
      prisma.ingreso.findMany({
        where: {
          tenantId: context.tenantId,
          sucursalId: context.branchId,
          fechaHora: { gte: hoy },
          estado: { in: ["permitido", "ACTIVO"] },
          horaSalida: null,
        },
        include: { cliente: true },
        orderBy: { fechaHora: "desc" },
      }),
      prisma.configuracionHorario.findFirst({
        where: { sucursalId: context.branchId, diaSemana, sucursal: { tenantId: context.tenantId } },
      }),
      prisma.ingreso.findMany({
        where: { tenantId: context.tenantId, sucursalId: context.branchId, fechaHora: { gte: hoy }, horaSalida: { not: null } },
        include: { cliente: true },
        orderBy: { horaSalida: "desc" },
        take: 8,
      }),
      prisma.ingreso.findMany({
        where: { tenantId: context.tenantId, sucursalId: context.branchId, fechaHora: { gte: hoy }, duracionMinutos: { not: null } },
        select: { duracionMinutos: true },
      }),
    ]);

    const capacidadMaxima = configHorario?.capacidadMaxima || 50;
    const personasAdentro = ingresosActivos.length;
    const porcentaje = capacidadMaxima > 0 ? Math.min(100, Math.round((personasAdentro / capacidadMaxima) * 100)) : 0;

    let nivel: "bajo" | "medio" | "alto" | "alerta" = "bajo";
    let nivelTexto = "Poca gente, ideal para entrenar";
    if (porcentaje >= 90) { nivel = "alerta"; nivelTexto = "Capacidad casi al límite / Aforo completo"; }
    else if (porcentaje >= 75) { nivel = "alto"; nivelTexto = "Mucha concurrencia"; }
    else if (porcentaje >= 40) { nivel = "medio"; nivelTexto = "Afluencia moderada"; }

    const personasPresentes = ingresosActivos.map((entry) => {
      const minutosAdentro = Math.max(1, Math.floor((ahora.getTime() - entry.fechaHora.getTime()) / 60000));
      return {
        id: entry.id,
        ingresoId: entry.id,
        clienteId: entry.clienteId,
        nombre: `${entry.cliente.nombre} ${entry.cliente.apellido}`,
        documento: entry.documento,
        foto: entry.cliente.foto,
        horaEntrada: entry.fechaHora.toISOString(),
        minutosAdentro,
        tiempoFormateado: minutosAdentro < 60 ? `Hace ${minutosAdentro} min` : `Hace ${Math.floor(minutosAdentro / 60)}h ${minutosAdentro % 60}m`,
      };
    });

    const duracionPromedio = todasLasSalidas.length > 0
      ? Math.round(todasLasSalidas.reduce((acc, row) => acc + (row.duracionMinutos || 0), 0) / todasLasSalidas.length)
      : 0;

    return {
      success: true,
      data: serializeData({
        branchId: context.branchId,
        personasAdentro,
        capacidadMaxima,
        porcentaje,
        nivel,
        nivelTexto,
        duracionPromedio,
        personasPresentes,
        ultimasSalidas: ultimasSalidas.map((entry) => ({
          id: entry.id,
          nombre: `${entry.cliente.nombre} ${entry.cliente.apellido}`,
          documento: entry.documento,
          horaEntrada: entry.fechaHora.toISOString(),
          horaSalida: entry.horaSalida ? entry.horaSalida.toISOString() : null,
          duracionMinutos: entry.duracionMinutos || 0,
        })),
      }),
    };
  } catch (error) {
    console.error("Error al obtener aforo en vivo:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error al calcular el aforo actual" };
  }
}

export async function registrarSalidaSocio(ingresoId: number) {
  try {
    if (!Number.isInteger(ingresoId) || ingresoId <= 0) return { success: false, error: "Ingreso inválido" };
    const context = await requireOperationalBranch();
    const ingreso = await prisma.ingreso.findFirst({
      where: { id: ingresoId, tenantId: context.tenantId, sucursalId: context.branchId },
    });
    if (!ingreso || ingreso.horaSalida) return { success: false, error: "El ingreso no existe en la sede activa o ya fue cerrado" };

    const ahora = new Date();
    const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ingreso.fechaHora.getTime()) / 60000));
    await prisma.ingreso.updateMany({
      where: { id: ingreso.id, tenantId: context.tenantId, sucursalId: context.branchId, horaSalida: null },
      data: { horaSalida: ahora, duracionMinutos },
    });

    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");
    return { success: true, duracionMinutos };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al registrar salida" };
  }
}

export async function registrarSalidaPorDocumento(documento: string, sucursalId?: number) {
  try {
    const cleanDocument = documento.trim();
    if (!cleanDocument) return { success: false, error: "Ingresá un documento" };
    const context = await requireOperationalBranch(sucursalId);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ingresoAbierto = await prisma.ingreso.findFirst({
      where: {
        tenantId: context.tenantId,
        documento: cleanDocument,
        sucursalId: context.branchId,
        fechaHora: { gte: hoy },
        horaSalida: null,
      },
      orderBy: { fechaHora: "desc" },
      include: { cliente: true },
    });
    if (!ingresoAbierto) return { success: false, error: "No se encontró un ingreso activo para este DNI en la sede activa" };

    const ahora = new Date();
    const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ingresoAbierto.fechaHora.getTime()) / 60000));
    await prisma.ingreso.updateMany({
      where: { id: ingresoAbierto.id, tenantId: context.tenantId, sucursalId: context.branchId, horaSalida: null },
      data: { horaSalida: ahora, duracionMinutos },
    });

    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");
    return { success: true, mensaje: `Salida registrada para ${ingresoAbierto.cliente.nombre} ${ingresoAbierto.cliente.apellido}. Permanencia: ${duracionMinutos} min.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al procesar salida" };
  }
}

export async function marcarSalidaTodos(sucursalId?: number) {
  try {
    const context = await requireOperationalBranch(sucursalId);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ahora = new Date();

    const ingresosAbiertos = await prisma.ingreso.findMany({
      where: { tenantId: context.tenantId, sucursalId: context.branchId, fechaHora: { gte: hoy }, horaSalida: null },
      select: { id: true, fechaHora: true },
    });

    await prisma.$transaction(ingresosAbiertos.map((entry) => prisma.ingreso.updateMany({
      where: { id: entry.id, tenantId: context.tenantId, sucursalId: context.branchId, horaSalida: null },
      data: {
        horaSalida: ahora,
        duracionMinutos: Math.max(1, Math.floor((ahora.getTime() - entry.fechaHora.getTime()) / 60000)),
      },
    })));

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "aforo.salida_masiva",
      entidad: "Sucursal",
      entidadId: context.branchId,
      metadata: { cantidad: ingresosAbiertos.length },
    });
    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");
    return { success: true, count: ingresosAbiertos.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cerrar asistencias activas" };
  }
}
