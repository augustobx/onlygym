"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { requireMemberContext } from "@/lib/member-context";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { RolTenant } from "@prisma/client";

// ==========================================
// 1. REGLAS CONFIGURABLES DE PUNTOS
// ==========================================

const DEFAULT_RULES = [
  { evento: "asistencia", puntos: 10, descripcion: "Asistencia al gimnasio (check-in)" },
  { evento: "asistencia_clase", puntos: 15, descripcion: "Asistencia a una clase grupal" },
  { evento: "entrenamiento_completo", puntos: 25, descripcion: "Finalizar una sesión de entrenamiento" },
  { evento: "racha_3d", puntos: 50, descripcion: "Alcanzar 3 días consecutivos de entrenamiento" },
  { evento: "racha_7d", puntos: 120, descripcion: "Alcanzar 7 días consecutivos de entrenamiento" },
  { evento: "renovacion_membresia", puntos: 100, descripcion: "Renovar la cuota/membresía al día" },
];

export async function getReglasPuntosAdmin() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "puntos");

    const reglas = await prisma.reglaPuntos.findMany({
      where: { tenantId: context.tenantId },
    });

    // Combinar con defaults si aún no existen
    const existingEvents = new Set(reglas.map((r) => r.evento));
    const merged = [
      ...reglas,
      ...DEFAULT_RULES.filter((d) => !existingEvents.has(d.evento)).map((d) => ({
        id: 0,
        tenantId: context.tenantId,
        evento: d.evento,
        puntos: d.puntos,
        activo: true,
        descripcion: d.descripcion,
      })),
    ];

    return { success: true, data: serializeData(merged) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener reglas" };
  }
}

export async function guardarReglaPuntos(input: {
  evento: string;
  puntos: number;
  activo: boolean;
  descripcion?: string;
}) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "puntos");

    const regla = await prisma.reglaPuntos.upsert({
      where: { tenantId_evento: { tenantId: context.tenantId, evento: input.evento } },
      update: {
        puntos: input.puntos,
        activo: input.activo,
        descripcion: input.descripcion || null,
      },
      create: {
        tenantId: context.tenantId,
        evento: input.evento,
        puntos: input.puntos,
        activo: input.activo,
        descripcion: input.descripcion || null,
      },
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "regla_puntos.guardar",
      entidad: "ReglaPuntos",
      entidadId: regla.id,
      metadata: input,
    });

    return { success: true, data: serializeData(regla) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al guardar regla" };
  }
}

// ==========================================
// 2. DESAFÍOS Y RETOS DE SOCIOS
// ==========================================

export async function getDesafiosAdmin() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "puntos");

    const desafios = await prisma.desafio.findMany({
      where: { tenantId: context.tenantId },
      include: {
        _count: { select: { participaciones: true } },
      },
      orderBy: { creadoEn: "desc" },
    });

    return { success: true, data: serializeData(desafios) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener desafíos" };
  }
}

const desafioSchema = z.object({
  titulo: z.string().trim().min(3).max(140),
  descripcion: z.string().trim().max(1000),
  tipo: z.enum(["asistencias_semana", "entrenamientos_mes", "visitas_mes"]),
  meta: z.number().int().min(1),
  puntosRecompensa: z.number().int().min(1),
  fechaInicio: z.coerce.date().optional(),
  fechaFin: z.coerce.date().optional(),
});

export async function crearDesafio(input: z.input<typeof desafioSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "puntos");
    const data = desafioSchema.parse(input);

    const desafio = await prisma.desafio.create({
      data: {
        tenantId: context.tenantId,
        ...data,
      },
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "desafio.crear",
      entidad: "Desafio",
      entidadId: desafio.id,
      metadata: { titulo: data.titulo, meta: data.meta },
    });

    return { success: true, data: serializeData(desafio) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear desafío" };
  }
}

// ==========================================
// 3. BENEFICIOS Y CONVENIOS
// ==========================================

export async function getBeneficiosAdmin() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "puntos");

    const beneficios = await prisma.beneficio.findMany({
      where: { tenantId: context.tenantId },
      orderBy: [{ activo: "desc" }, { titulo: "asc" }],
    });

    return { success: true, data: serializeData(beneficios) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener beneficios" };
  }
}

const beneficioSchema = z.object({
  titulo: z.string().trim().min(2).max(140),
  descripcion: z.string().trim().max(2000),
  comercio: z.string().trim().max(120).optional(),
  imagenUrl: z.string().trim().optional(),
  vigenteDesde: z.coerce.date().optional(),
  vigenteHasta: z.coerce.date().optional(),
  condiciones: z.string().trim().max(2000).optional(),
  activo: z.boolean().default(true),
});

export async function crearBeneficio(input: z.input<typeof beneficioSchema>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "puntos");
    const data = beneficioSchema.parse(input);

    const beneficio = await prisma.beneficio.create({
      data: {
        tenantId: context.tenantId,
        ...data,
        comercio: data.comercio || null,
        imagenUrl: data.imagenUrl || null,
        condiciones: data.condiciones || null,
      },
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "beneficio.crear",
      entidad: "Beneficio",
      entidadId: beneficio.id,
      metadata: { titulo: data.titulo, comercio: data.comercio },
    });

    return { success: true, data: serializeData(beneficio) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear beneficio" };
  }
}

export async function archivarBeneficio(id: number, activo: boolean) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "puntos");

    const beneficio = await prisma.beneficio.update({
      where: { id, tenantId: context.tenantId },
      data: { activo },
    });

    return { success: true, data: serializeData(beneficio) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar beneficio" };
  }
}

// ==========================================
// 4. GESTIÓN DE PREMIOS Y CANJES
// ==========================================

export async function getCanjesAdmin() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "puntos");

    const canjes = await prisma.canjePremio.findMany({
      where: { tenantId: context.tenantId },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, documento: true, telefono: true } },
        premio: true,
      },
      orderBy: { creadoEn: "desc" },
    });

    return { success: true, data: serializeData(canjes) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener canjes" };
  }
}

export async function gestionarCanjeAdmin(canjeId: number, accion: "entregar" | "rechazar") {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    await requireTenantModule(context.tenantId, "puntos");

    const canje = await prisma.canjePremio.findFirst({
      where: { id: canjeId, tenantId: context.tenantId },
      include: { premio: true, cliente: true },
    });
    if (!canje) return { success: false, error: "Canje no encontrado" };
    if (canje.estado !== "pendiente") return { success: false, error: `El canje ya está ${canje.estado}` };

    const updated = await prisma.$transaction(async (tx) => {
      if (accion === "entregar") {
        return tx.canjePremio.update({
          where: { id: canjeId },
          data: { estado: "entregado", entregadoEn: new Date() },
        });
      } else {
        // Reembolsar puntos al cliente y devolver stock al premio
        await tx.movimientoPuntos.create({
          data: {
            tenantId: context.tenantId,
            clienteId: canje.clienteId,
            puntos: canje.puntos,
            tipo: "reembolso",
            concepto: `Reembolso por canje rechazado: ${canje.premio.nombre}`,
            referencia: `canje:${canje.id}`,
          },
        });

        if (canje.premio.stock !== null) {
          await tx.premio.update({
            where: { id: canje.premioId },
            data: { stock: { increment: 1 } },
          });
        }

        return tx.canjePremio.update({
          where: { id: canjeId },
          data: { estado: "rechazado" },
        });
      }
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: `canje.${accion}`,
      entidad: "CanjePremio",
      entidadId: canjeId,
      metadata: { clienteId: canje.clienteId, accion },
    });

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al gestionar canje" };
  }
}

// ==========================================
// 5. ACCIONES DEL SOCIO (PORTAL)
// ==========================================

export async function getFidelizacionSocio() {
  try {
    const context = await requireMemberContext();

    const [saldoPuntos, premios, beneficios, desafios, canjesPropios] = await Promise.all([
      prisma.movimientoPuntos.aggregate({
        where: { tenantId: context.tenantId, clienteId: context.clienteId },
        _sum: { puntos: true },
      }),
      prisma.premio.findMany({
        where: { tenantId: context.tenantId, activo: true },
        orderBy: { puntos: "asc" },
      }),
      prisma.beneficio.findMany({
        where: {
          tenantId: context.tenantId,
          activo: true,
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: new Date() } }],
        },
        orderBy: { titulo: "asc" },
      }),
      prisma.desafio.findMany({
        where: { tenantId: context.tenantId, activo: true },
        include: {
          participaciones: {
            where: { clienteId: context.clienteId },
          },
        },
      }),
      prisma.canjePremio.findMany({
        where: { tenantId: context.tenantId, clienteId: context.clienteId },
        include: { premio: true },
        orderBy: { creadoEn: "desc" },
      }),
    ]);

    const puntosDisponibles = Number(saldoPuntos._sum.puntos || 0);

    return {
      success: true,
      data: serializeData({
        puntosDisponibles,
        premios,
        beneficios,
        desafios,
        canjesPropios,
      }),
    };
  } catch (error) {
    return { success: false, error: "No autorizado" };
  }
}

export async function solicitarCanjeSocio(premioId: number) {
  try {
    const context = await requireMemberContext();

    const result = await prisma.$transaction(async (tx) => {
      const premio = await tx.premio.findFirst({
        where: { id: premioId, tenantId: context.tenantId, activo: true },
      });
      if (!premio) throw new Error("Premio no disponible");

      if (premio.stock !== null && premio.stock <= 0) {
        throw new Error("Lo sentimos, este premio se quedó sin stock disponible.");
      }

      // Verificar saldo de puntos
      const balance = await tx.movimientoPuntos.aggregate({
        where: { tenantId: context.tenantId, clienteId: context.clienteId },
        _sum: { puntos: true },
      });
      const puntosActuales = Number(balance._sum.puntos || 0);

      if (puntosActuales < premio.puntos) {
        throw new Error(`Puntos insuficientes. Tienes ${puntosActuales} pts y necesitas ${premio.puntos} pts.`);
      }

      // 1. Descontar puntos atómicamente
      await tx.movimientoPuntos.create({
        data: {
          tenantId: context.tenantId,
          clienteId: context.clienteId,
          puntos: -premio.puntos,
          tipo: "canje",
          concepto: `Canje de premio: ${premio.nombre}`,
          referencia: `premio:${premio.id}`,
        },
      });

      // 2. Descontar stock atómicamente
      if (premio.stock !== null) {
        await tx.premio.update({
          where: { id: premio.id },
          data: { stock: { decrement: 1 } },
        });
      }

      // 3. Crear registro de canje pendiente
      const canje = await tx.canjePremio.create({
        data: {
          tenantId: context.tenantId,
          clienteId: context.clienteId,
          premioId: premio.id,
          puntos: premio.puntos,
          estado: "pendiente",
        },
      });

      // 4. Notificar al socio
      await tx.notificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId: context.clienteId,
          tipo: "canje_solicitado",
          titulo: "¡Canje solicitado con éxito!",
          mensaje: `Solicitaste ${premio.nombre}. Pasa por recepción para retirarlo.`,
        },
      });

      return canje;
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorClienteId: context.clienteId,
      accion: "canje.solicitar",
      entidad: "CanjePremio",
      entidadId: result.id,
      metadata: { premioId, puntos: result.puntos },
    });

    return { success: true, data: serializeData(result), mensaje: "¡Canje solicitado! Puedes retirarlo en recepción." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al solicitar canje" };
  }
}
