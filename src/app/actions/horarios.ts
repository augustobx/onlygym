"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";

export interface HorarioDiaInput {
  diaSemana: number; // 0=Dom, 1=Lun, ..., 6=Sab
  tipoApertura: "completo" | "mañana" | "tarde" | "doble" | "cerrado";
  horaApertura1?: string | null;
  horaCierre1?: string | null;
  horaApertura2?: string | null;
  horaCierre2?: string | null;
  capacidadMaxima?: number | null;
  activo?: boolean;
}

const DIAS_DEFAULT: HorarioDiaInput[] = [
  { diaSemana: 1, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 2, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 3, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 4, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 5, tipoApertura: "completo", horaApertura1: "06:00", horaCierre1: "22:00", capacidadMaxima: 50, activo: true },
  { diaSemana: 6, tipoApertura: "mañana", horaApertura1: "08:00", horaCierre1: "13:00", capacidadMaxima: 30, activo: true },
  { diaSemana: 0, tipoApertura: "cerrado", horaApertura1: null, horaCierre1: null, capacidadMaxima: 0, activo: false },
];

/**
 * Obtiene la configuración semanal de horarios para una sucursal
 * (Si no existe configuración previa, inicializa los días por defecto)
 */
export async function getHorariosSemana(sucursalId: number = 1) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    let horarios = await prisma.configuracionHorario.findMany({
      where: { sucursalId },
      orderBy: { diaSemana: "asc" },
    });

    // Si aún no hay configuración creada para esta sede, inicializarla
    if (horarios.length < 7) {
      for (const def of DIAS_DEFAULT) {
        await prisma.configuracionHorario.upsert({
          where: {
            sucursalId_diaSemana: {
              sucursalId,
              diaSemana: def.diaSemana,
            },
          },
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

      horarios = await prisma.configuracionHorario.findMany({
        where: { sucursalId },
        orderBy: { diaSemana: "asc" },
      });
    }

    // Reordenar de Lunes (1) a Domingo (0) para la visualización habitual
    const ordenLunesADomingo = [1, 2, 3, 4, 5, 6, 0];
    const ordenados = ordenLunesADomingo.map(
      d => horarios.find(h => h.diaSemana === d) || DIAS_DEFAULT.find(def => def.diaSemana === d)!
    );

    return { success: true, data: serializeData(ordenados) };
  } catch (error) {
    console.error("Error al obtener horarios de atención:", error);
    return { success: false, error: "Error cargando horarios de atención" };
  }
}

/**
 * Guarda la configuración semanal de horarios de una sucursal
 */
export async function guardarHorariosSemana(sucursalId: number, horarios: HorarioDiaInput[]) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    for (const h of horarios) {
      await prisma.configuracionHorario.upsert({
        where: {
          sucursalId_diaSemana: {
            sucursalId,
            diaSemana: h.diaSemana,
          },
        },
        update: {
          tipoApertura: h.tipoApertura,
          horaApertura1: h.horaApertura1 || null,
          horaCierre1: h.horaCierre1 || null,
          horaApertura2: h.horaApertura2 || null,
          horaCierre2: h.horaCierre2 || null,
          capacidadMaxima: h.capacidadMaxima !== undefined ? Number(h.capacidadMaxima) : 50,
          activo: h.tipoApertura !== "cerrado",
        },
        create: {
          sucursalId,
          diaSemana: h.diaSemana,
          tipoApertura: h.tipoApertura,
          horaApertura1: h.horaApertura1 || null,
          horaCierre1: h.horaCierre1 || null,
          horaApertura2: h.horaApertura2 || null,
          horaCierre2: h.horaCierre2 || null,
          capacidadMaxima: h.capacidadMaxima !== undefined ? Number(h.capacidadMaxima) : 50,
          activo: h.tipoApertura !== "cerrado",
        },
      });
    }

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/aforo");
    revalidatePath("/molinete");

    return { success: true };
  } catch (error) {
    console.error("Error guardando horarios:", error);
    return { success: false, error: "Error al guardar la configuración de horarios" };
  }
}

/**
 * Valida si el gimnasio está abierto en este momento
 */
export async function verificarHorarioAtencion(sucursalId: number = 1) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0 a 6
    const horaActualStr = ahora.toTimeString().substring(0, 5); // "HH:MM"

    const config = await prisma.configuracionHorario.findUnique({
      where: {
        sucursalId_diaSemana: {
          sucursalId,
          diaSemana,
        },
      },
    });

    if (!config || !config.activo || config.tipoApertura === "cerrado") {
      return {
        permitido: false,
        motivo: "El gimnasio se encuentra cerrado hoy.",
        diaSemana,
        horaActual: horaActualStr,
      };
    }

    const { tipoApertura, horaApertura1, horaCierre1, horaApertura2, horaCierre2 } = config;

    // Validación por tipo de apertura
    if (tipoApertura === "completo" || tipoApertura === "mañana" || tipoApertura === "tarde") {
      if (horaApertura1 && horaCierre1) {
        if (horaActualStr >= horaApertura1 && horaActualStr <= horaCierre1) {
          return { permitido: true, diaSemana, horaActual: horaActualStr };
        }
      }
    } else if (tipoApertura === "doble") {
      const turno1 = horaApertura1 && horaCierre1 && (horaActualStr >= horaApertura1 && horaActualStr <= horaCierre1);
      const turno2 = horaApertura2 && horaCierre2 && (horaActualStr >= horaApertura2 && horaActualStr <= horaCierre2);
      if (turno1 || turno2) {
        return { permitido: true, diaSemana, horaActual: horaActualStr };
      }
    }

    return {
      permitido: false,
      motivo: `Fuera de horario de atención (Horario: ${horaApertura1 || ""} a ${horaCierre1 || ""}${horaApertura2 ? ` y ${horaApertura2} a ${horaCierre2}` : ""})`,
      diaSemana,
      horaActual: horaActualStr,
    };
  } catch (error) {
    console.error("Error verificando horario de atención:", error);
    return { permitido: true }; // Fallback permisivo
  }
}

/**
 * Obtiene el estado de aforo y ocupación en tiempo real para el monitor
 */
export async function getAforoEnVivo(sucursalId: number = 1) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ahora = new Date();
    const diaSemana = ahora.getDay();

    // 1. Obtener ingresos permitidos de hoy que no han marcado salida
    const ingresosActivos = await prisma.ingreso.findMany({
      where: {
        sucursalId,
        fechaHora: { gte: hoy },
        estado: { in: ["permitido", "ACTIVO"] },
        horaSalida: null,
      },
      include: {
        cliente: true,
      },
      orderBy: { fechaHora: "desc" },
    });

    // 2. Obtener capacidad configurada para hoy
    const configHorario = await prisma.configuracionHorario.findUnique({
      where: {
        sucursalId_diaSemana: {
          sucursalId,
          diaSemana,
        },
      },
    });

    const capacidadMaxima = configHorario?.capacidadMaxima || 50;
    const personasAdentro = ingresosActivos.length;
    const porcentaje = capacidadMaxima > 0 
      ? Math.min(100, Math.round((personasAdentro / capacidadMaxima) * 100)) 
      : 0;

    // Calcular nivel de afluencia
    let nivel: "bajo" | "medio" | "alto" | "alerta" = "bajo";
    let nivelTexto = "Poca gente, ideal para entrenar";
    if (porcentaje >= 90) {
      nivel = "alerta";
      nivelTexto = "Capacidad casi al límite / Aforo completo";
    } else if (porcentaje >= 75) {
      nivel = "alto";
      nivelTexto = "Mucha concurrencia";
    } else if (porcentaje >= 40) {
      nivel = "medio";
      nivelTexto = "Afluencia moderada";
    }

    // Formatear personas adentro con tiempo transcurrido
    const personasPresentes = ingresosActivos.map(i => {
      const minutosAdentro = Math.max(1, Math.floor((ahora.getTime() - i.fechaHora.getTime()) / 60000));
      return {
        ingresoId: i.id,
        clienteId: i.clienteId,
        nombre: `${i.cliente.nombre} ${i.cliente.apellido}`,
        documento: i.documento,
        foto: i.cliente.foto,
        horaEntrada: i.fechaHora.toISOString(),
        minutosAdentro,
        tiempoFormateado: minutosAdentro < 60 
          ? `Hace ${minutosAdentro} min` 
          : `Hace ${Math.floor(minutosAdentro / 60)}h ${minutosAdentro % 60}m`,
      };
    });

    // 3. Obtener últimas 8 salidas de hoy para auditoría
    const ultimasSalidas = await prisma.ingreso.findMany({
      where: {
        sucursalId,
        fechaHora: { gte: hoy },
        horaSalida: { not: null },
      },
      include: {
        cliente: true,
      },
      orderBy: { horaSalida: "desc" },
      take: 8,
    });

    // Calcular duración promedio de estadía hoy
    const todasLasSalidas = await prisma.ingreso.findMany({
      where: {
        sucursalId,
        fechaHora: { gte: hoy },
        duracionMinutos: { not: null },
      },
      select: { duracionMinutos: true },
    });

    const duracionPromedio = todasLasSalidas.length > 0
      ? Math.round(todasLasSalidas.reduce((acc, s) => acc + (s.duracionMinutos || 0), 0) / todasLasSalidas.length)
      : 0;

    return {
      success: true,
      data: serializeData({
        personasAdentro,
        capacidadMaxima,
        porcentaje,
        nivel,
        nivelTexto,
        duracionPromedio,
        personasPresentes,
        ultimasSalidas: ultimasSalidas.map(s => ({
          id: s.id,
          nombre: `${s.cliente.nombre} ${s.cliente.apellido}`,
          documento: s.documento,
          horaEntrada: s.fechaHora.toISOString(),
          horaSalida: s.horaSalida ? s.horaSalida.toISOString() : null,
          duracionMinutos: s.duracionMinutos || 0,
        })),
      }),
    };
  } catch (error) {
    console.error("Error al obtener aforo en vivo:", error);
    return { success: false, error: "Error al calcular el aforo actual" };
  }
}

/**
 * Registra la salida individual de un socio por su ID de ingreso
 */
export async function registrarSalidaSocio(ingresoId: number) {
  const context = await requireStaffContext();
  const owned = await prisma.ingreso.findFirst({ where: { id: ingresoId, tenantId: context.tenantId }, select: { id: true } });
  if (!owned) return { success: false, error: "Ingreso no encontrado" };
  try {
    const ingreso = await prisma.ingreso.findUnique({
      where: { id: ingresoId },
    });

    if (!ingreso || ingreso.horaSalida) {
      return { success: false, error: "El ingreso no existe o ya fue marcado como salido" };
    }

    const ahora = new Date();
    const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ingreso.fechaHora.getTime()) / 60000));

    await prisma.ingreso.update({
      where: { id: ingresoId },
      data: {
        horaSalida: ahora,
        duracionMinutos,
      },
    });

    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");

    return { success: true, duracionMinutos };
  } catch (error) {
    console.error("Error registrando salida:", error);
    return { success: false, error: "Error al registrar salida" };
  }
}

/**
 * Registra la salida de un socio buscando por su documento
 */
export async function registrarSalidaPorDocumento(documento: string, sucursalId: number = 1) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ingresoAbierto = await prisma.ingreso.findFirst({
      where: {
        documento: documento.trim(),
        sucursalId,
        fechaHora: { gte: hoy },
        horaSalida: null,
      },
      orderBy: { fechaHora: "desc" },
      include: { cliente: true },
    });

    if (!ingresoAbierto) {
      return { success: false, error: "No se encontró un ingreso activo para este DNI en el día de hoy" };
    }

    const ahora = new Date();
    const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ingresoAbierto.fechaHora.getTime()) / 60000));

    await prisma.ingreso.update({
      where: { id: ingresoAbierto.id },
      data: {
        horaSalida: ahora,
        duracionMinutos,
      },
    });

    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");

    return {
      success: true,
      mensaje: `Salida registrada para ${ingresoAbierto.cliente.nombre} ${ingresoAbierto.cliente.apellido}. Permanencia: ${duracionMinutos} min.`,
    };
  } catch (error) {
    console.error("Error registrando salida por documento:", error);
    return { success: false, error: "Error al procesar salida" };
  }
}

/**
 * Salida masiva de todas las personas activas (ej: cierre del gimnasio)
 */
export async function marcarSalidaTodos(sucursalId: number = 1) {
  await requireStaffContext({ branchId: sucursalId });
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ahora = new Date();

    const ingresosAbiertos = await prisma.ingreso.findMany({
      where: {
        sucursalId,
        fechaHora: { gte: hoy },
        horaSalida: null,
      },
    });

    for (const ing of ingresosAbiertos) {
      const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ing.fechaHora.getTime()) / 60000));
      await prisma.ingreso.update({
        where: { id: ing.id },
        data: {
          horaSalida: ahora,
          duracionMinutos,
        },
      });
    }

    revalidatePath("/dashboard/aforo");
    revalidatePath("/dashboard");
    revalidatePath("/molinete");

    return { success: true, count: ingresosAbiertos.length };
  } catch (error) {
    console.error("Error marcando salida a todos:", error);
    return { success: false, error: "Error al cerrar asistencias activas" };
  }
}
