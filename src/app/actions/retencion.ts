"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

/**
 * Calcula la racha real de asistencias consecutivas (días o semanas) para un cliente
 */
function calcularRachaRealSync(fechasIngresos: Date[]): {
  rachaActualDias: number;
  rachaActualSemanas: number;
  promedioSemanalMes: number;
} {
  if (!fechasIngresos.length) {
    return { rachaActualDias: 0, rachaActualSemanas: 0, promedioSemanalMes: 0 };
  }

  const uniqueDays = Array.from(
    new Set(
      fechasIngresos.map((f) => {
        const d = new Date(f);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
    )
  ).sort((a, b) => b - a);

  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayMs = todayMs - 86400000;

  let rachaDias = 0;
  let currentCheck = uniqueDays[0] === todayMs ? todayMs : uniqueDays[0] === yesterdayMs ? yesterdayMs : null;

  if (currentCheck !== null) {
    for (const dayMs of uniqueDays) {
      if (dayMs === currentCheck) {
        rachaDias++;
        currentCheck -= 86400000;
      } else if (dayMs < currentCheck) {
        break;
      }
    }
  }

  const weeksSet = new Set<string>();
  const oneMonthAgo = new Date(today.getTime() - 30 * 86400000);
  let visitasUltimoMes = 0;

  for (const f of fechasIngresos) {
    const d = new Date(f);
    if (d >= oneMonthAgo) visitasUltimoMes++;
    const year = d.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    weeksSet.add(`${year}-W${weekNum}`);
  }

  const promedioSemanalMes = Number((visitasUltimoMes / 4.2).toFixed(1));

  return {
    rachaActualDias: rachaDias,
    rachaActualSemanas: Math.min(weeksSet.size, 12),
    promedioSemanalMes,
  };
}

export async function calcularRachaReal(fechasIngresos: Date[]) {
  return calcularRachaRealSync(fechasIngresos);
}

function evaluarRiesgoAbandonoSync(input: {
  diasInactivo: number;
  diasVencimientoMembresia: number;
  visitasUltimos30d: number;
  visitasPrevios30d: number;
}): {
  nivel: "Bajo" | "Medio" | "Alto" | "Crítico";
  motivo: string;
} {
  const { diasInactivo, diasVencimientoMembresia, visitasUltimos30d, visitasPrevios30d } = input;
  const caidaFrecuencia = visitasPrevios30d >= 4 && visitasUltimos30d <= visitasPrevios30d * 0.4;

  if (diasInactivo >= 14 || (diasInactivo >= 10 && diasVencimientoMembresia <= 3)) {
    return { nivel: "Crítico", motivo: `Sin asistir hace ${diasInactivo} días con membresía por vencer` };
  }
  if (diasInactivo >= 7 || caidaFrecuencia) {
    return { nivel: "Alto", motivo: diasInactivo >= 7 ? `Inactivo hace ${diasInactivo} días` : "Caída severa de frecuencia de asistencia" };
  }
  if (diasInactivo >= 4 || diasVencimientoMembresia <= 5) {
    return { nivel: "Medio", motivo: diasVencimientoMembresia <= 5 ? "Membresía por vencer en menos de 5 días" : "Sin asistencia en los últimos 4 días" };
  }

  return { nivel: "Bajo", motivo: "Asistencia y membresía regulares" };
}

export async function evaluarRiesgoAbandono(input: {
  diasInactivo: number;
  diasVencimientoMembresia: number;
  visitasUltimos30d: number;
  visitasPrevios30d: number;
}) {
  return evaluarRiesgoAbandonoSync(input);
}

export async function getSociosEnRiesgo() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "reportes");

    const now = new Date();
    const hace30d = new Date(now.getTime() - 30 * 86400000);
    const hace60d = new Date(now.getTime() - 60 * 86400000);

    const clientes = await prisma.cliente.findMany({
      where: { tenantId: context.tenantId, estado: "activo" },
      include: {
        ingresos: {
          where: { tenantId: context.tenantId, estado: { in: ["permitido", "ACTIVO"] } },
          orderBy: { fechaHora: "desc" },
          take: 50,
        },
        pagos: {
          where: { tenantId: context.tenantId },
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
          include: { membresia: true },
        },
        seguimientos: {
          where: { tenantId: context.tenantId },
          orderBy: { creadoEn: "desc" },
          take: 1,
        },
      },
    });

    const enRiesgo = clientes.map((cliente) => {
      const ultimoIngreso = cliente.ingresos[0]?.fechaHora ? new Date(cliente.ingresos[0].fechaHora) : null;
      const diasInactivo = ultimoIngreso ? Math.floor((now.getTime() - ultimoIngreso.getTime()) / 86400000) : 99;
      const ultimoPago = cliente.pagos[0];
      const fechaVenc = ultimoPago ? new Date(ultimoPago.fechaVencimiento) : null;
      const diasVencimientoMembresia = fechaVenc ? Math.floor((fechaVenc.getTime() - now.getTime()) / 86400000) : -99;
      const visitasUltimos30d = cliente.ingresos.filter((i) => new Date(i.fechaHora) >= hace30d).length;
      const visitasPrevios30d = cliente.ingresos.filter((i) => new Date(i.fechaHora) >= hace60d && new Date(i.fechaHora) < hace30d).length;
      const evaluacion = evaluarRiesgoAbandonoSync({ diasInactivo, diasVencimientoMembresia, visitasUltimos30d, visitasPrevios30d });
      const racha = calcularRachaRealSync(cliente.ingresos.map((i) => new Date(i.fechaHora)));

      return {
        id: cliente.id,
        nombre: `${cliente.nombre} ${cliente.apellido}`,
        documento: cliente.documento,
        telefono: cliente.telefono,
        email: cliente.email,
        ultimoIngreso: ultimoIngreso?.toISOString() || null,
        diasInactivo,
        membresiaNombre: ultimoPago?.membresia?.nombre || "Sin membresía",
        fechaVencimiento: fechaVenc?.toISOString() || null,
        diasVencimientoMembresia,
        visitasUltimos30d,
        nivelRiesgo: evaluacion.nivel,
        motivoRiesgo: evaluacion.motivo,
        rachaDias: racha.rachaActualDias,
        promedioSemanal: racha.promedioSemanalMes,
        ultimoSeguimiento: cliente.seguimientos[0]
          ? { tipo: cliente.seguimientos[0].tipo, estado: cliente.seguimientos[0].estado, creadoEn: cliente.seguimientos[0].creadoEn.toISOString() }
          : null,
      };
    });

    const prioritarios = enRiesgo
      .filter((c) => c.nivelRiesgo !== "Bajo")
      .sort((a, b) => {
        const order = { Crítico: 4, Alto: 3, Medio: 2, Bajo: 1 };
        return order[b.nivelRiesgo] - order[a.nivelRiesgo] || b.diasInactivo - a.diasInactivo;
      });

    return {
      success: true,
      data: serializeData({
        totalSocios: clientes.length,
        criticos: enRiesgo.filter((c) => c.nivelRiesgo === "Crítico").length,
        altos: enRiesgo.filter((c) => c.nivelRiesgo === "Alto").length,
        medios: enRiesgo.filter((c) => c.nivelRiesgo === "Medio").length,
        sociosEnRiesgo: prioritarios.slice(0, 30),
      }),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener socios en riesgo" };
  }
}

const seguimientoSchema = z.object({
  clienteId: z.number().int().positive(),
  tipo: z.enum(["whatsapp", "llamada", "email", "nota", "oferta"]),
  estado: z.enum(["pendiente", "contactado", "recuperado", "descartado"]).default("contactado"),
  motivo: z.string().trim().max(120).optional(),
  resultado: z.string().trim().max(1000).optional(),
  proximoContacto: z.coerce.date().optional(),
});

export async function registrarSeguimientoComercial(input: z.input<typeof seguimientoSchema>) {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "socios");
    const data = seguimientoSchema.parse(input);

    const cliente = await prisma.cliente.findFirst({
      where: { id: data.clienteId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado" };

    const seguimiento = await prisma.seguimientoCliente.create({
      data: {
        tenantId: context.tenantId,
        clienteId: cliente.id,
        usuarioId: context.userId,
        tipo: data.tipo,
        estado: data.estado,
        motivo: data.motivo || null,
        resultado: data.resultado || null,
        proximoContacto: data.proximoContacto || null,
      },
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "seguimiento_comercial.crear",
      entidad: "SeguimientoCliente",
      entidadId: seguimiento.id,
      metadata: { clienteId: cliente.id, tipo: data.tipo, estado: data.estado },
    });

    return { success: true, data: serializeData(seguimiento) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al registrar seguimiento" };
  }
}

export async function getAnaliticaRetencion(periodo: "mes_actual" | "mes_anterior" | "ultimos_90d" = "mes_actual") {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "reportes");

    const now = new Date();
    let desde = new Date(now.getFullYear(), now.getMonth(), 1);
    let hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (periodo === "mes_anterior") {
      desde = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      hasta = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (periodo === "ultimos_90d") {
      desde = new Date(now.getTime() - 90 * 86400000);
      hasta = now;
    }

    const [ingresosPeriodo, clasesPeriodo, totalClientesActivos] = await Promise.all([
      prisma.ingreso.findMany({
        where: { tenantId: context.tenantId, fechaHora: { gte: desde, lte: hasta }, estado: { in: ["permitido", "ACTIVO"] } },
        select: { fechaHora: true, clienteId: true },
      }),
      prisma.clase.findMany({
        where: { tenantId: context.tenantId, inicio: { gte: desde, lte: hasta } },
        include: {
          tipoClase: true,
          entrenador: { include: { user: { select: { name: true } } } },
          _count: { select: { reservas: { where: { estado: { in: ["confirmada", "asistio"] } } } } },
        },
      }),
      prisma.cliente.count({ where: { tenantId: context.tenantId, estado: "activo" } }),
    ]);

    const horasCount: Record<number, number> = {};
    for (let h = 6; h <= 23; h++) horasCount[h] = 0;
    ingresosPeriodo.forEach((ing) => {
      const h = new Date(ing.fechaHora).getHours();
      if (horasCount[h] !== undefined) horasCount[h]++;
    });

    const topHorarios = Object.entries(horasCount)
      .map(([hora, cantidad]) => ({ hora: `${hora.padStart(2, "0")}:00 hs`, cantidad: Number(cantidad) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const topClases = clasesPeriodo
      .map((c) => ({
        nombre: c.tipoClase.nombre,
        profesor: c.entrenador?.user.name || "Equipo OnlyGym",
        reservas: c._count.reservas,
        cupoMaximo: c.cupoMaximo,
        ocupacionPromedio: Math.min(100, Math.round((c._count.reservas / c.cupoMaximo) * 100)),
      }))
      .sort((a, b) => b.ocupacionPromedio - a.ocupacionPromedio)
      .slice(0, 5);

    const clientesConAsistencia = new Set(ingresosPeriodo.map((i) => i.clienteId)).size;
    const frecuenciaPromedioVisitas = totalClientesActivos > 0 ? (ingresosPeriodo.length / totalClientesActivos).toFixed(1) : "0";
    const tasaRetencionEstimada = totalClientesActivos > 0 ? Math.min(100, Math.round((clientesConAsistencia / totalClientesActivos) * 100)) : 0;

    return {
      success: true,
      data: serializeData({
        periodo,
        totalAsistencias: ingresosPeriodo.length,
        clientesConAsistencia,
        totalClientesActivos,
        frecuenciaPromedioVisitas,
        tasaRetencionEstimada,
        topHorarios,
        topClases,
        distribucionHoraria: Object.entries(horasCount).map(([hora, cantidad]) => ({ hora: `${hora.padStart(2, "0")}:00`, cantidad })),
      }),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener analítica" };
  }
}
