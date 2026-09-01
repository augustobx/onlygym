"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import {
  clearSuperAdminSession,
  createSuperAdminSession,
  getSuperAdminSession,
  hashSuperAdminPassword,
  requireSuperAdmin,
  verifySuperAdminPassword,
} from "@/lib/superadmin-auth";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { RolTenant } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function loginSuperAdmin(formData: FormData) {
  try {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      return { success: false, error: "Email y contraseña requeridos" };
    }

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) {
      return { success: false, error: "Credenciales inválidas" };
    }

    const valid = await verifySuperAdminPassword(password, admin.password);
    if (!valid) {
      return { success: false, error: "Credenciales inválidas" };
    }

    await createSuperAdminSession(admin.id);
    await writeAudit({
      actorUserId: `superadmin:${admin.id}`,
      accion: "superadmin.login",
      entidad: "SuperAdmin",
      entidadId: admin.id,
      metadata: { email: admin.email },
    });

    return { success: true };
  } catch (error) {
    console.error("Error en login superadmin:", error);
    return { success: false, error: "No se pudo iniciar sesión" };
  }
}

export async function logoutSuperAdmin() {
  const session = await getSuperAdminSession();
  if (session) {
    await writeAudit({
      actorUserId: `superadmin:${session.id}`,
      accion: "superadmin.logout",
      entidad: "SuperAdmin",
      entidadId: session.id,
    });
  }
  await clearSuperAdminSession();
  return { success: true };
}

export async function getSuperAdminProfile() {
  const session = await getSuperAdminSession();
  if (!session) return { success: false, error: "No autenticado" };
  return { success: true, data: serializeData(session) };
}

export async function getSuperAdminDashboard() {
  try {
    await requireSuperAdmin();

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);

    const [
      totalTenants,
      activos,
      enPrueba,
      suspendidos,
      cancelados,
      proximosAVencer,
      planes,
      suscripciones,
      totalSocios,
      totalIngresosHoy,
      recentTenants,
      recentAudits,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { estado: "activo" } }),
      prisma.tenant.count({ where: { estado: "prueba" } }),
      prisma.tenant.count({ where: { estado: "suspendido" } }),
      prisma.tenant.count({ where: { estado: "cancelado" } }),
      prisma.tenant.count({
        where: {
          estado: { in: ["activo", "prueba"] },
          fechaVencimiento: { lte: in7Days },
        },
      }),
      prisma.planSaaS.findMany({ where: { activo: true }, orderBy: { precioMensual: "asc" } }),
      prisma.suscripcionSaaS.findMany({
        where: { estado: "activa" },
        select: { monto: true, intervalo: true },
      }),
      prisma.cliente.count(),
      prisma.ingreso.count({
        where: {
          fechaHora: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          estado: { in: ["permitido", "ACTIVO"] },
        },
      }),
      prisma.tenant.findMany({
        orderBy: { creadoEn: "desc" },
        take: 6,
        include: {
          planSaaS: { select: { nombre: true, precioMensual: true } },
          _count: { select: { clientes: true, sucursales: true, usuarios: true } },
        },
      }),
      prisma.auditoria.findMany({
        orderBy: { creadaEn: "desc" },
        take: 8,
        include: { tenant: { select: { nombre: true, slug: true } } },
      }),
    ]);

    // Calcular MRR estimado a partir de suscripciones activas
    const mrr = suscripciones.reduce((acc, sub) => {
      const valor = Number(sub.monto || 0);
      return acc + (sub.intervalo === "anual" ? valor / 12 : valor);
    }, 0);

    return {
      success: true,
      data: serializeData({
        totalTenants,
        activos,
        enPrueba,
        suspendidos,
        cancelados,
        proximosAVencer,
        mrr,
        planes,
        totalSocios,
        totalIngresosHoy,
        recentTenants,
        recentAudits,
      }),
    };
  } catch (error) {
    console.error("Error cargando dashboard superadmin:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error cargando dashboard" };
  }
}

export async function getTenantsSuperAdmin(params: {
  search?: string;
  estado?: string;
  planId?: number;
  page?: number;
  limit?: number;
} = {}) {
  try {
    await requireSuperAdmin();

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(5, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.estado && params.estado !== "todos") {
      where.estado = params.estado;
    }
    if (params.planId) {
      where.planSaaSId = params.planId;
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: { creadoEn: "desc" },
        skip,
        take: limit,
        include: {
          planSaaS: true,
          _count: {
            select: {
              clientes: true,
              sucursales: true,
              usuarios: true,
              clases: true,
              pagos: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: serializeData({
        tenants,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error listando tenants" };
  }
}

export async function getTenantDetailSuperAdmin(id: number) {
  try {
    await requireSuperAdmin();
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        planSaaS: true,
        sucursales: true,
        usuarios: { include: { user: { select: { id: true, name: true, email: true, nivel: true } } } },
        suscripciones: {
          include: { plan: true, pagosPlataforma: { orderBy: { fechaPago: "desc" } } },
          orderBy: { creadaEn: "desc" },
        },
        _count: {
          select: {
            clientes: true,
            sucursales: true,
            usuarios: true,
            clases: true,
            pagos: true,
            ventas: true,
            ingresos: true,
          },
        },
      },
    });

    if (!tenant) return { success: false, error: "Gimnasio no encontrado" };

    const planes = await prisma.planSaaS.findMany({ where: { activo: true }, orderBy: { precioMensual: "asc" } });

    return { success: true, data: serializeData({ tenant, planes }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error cargando tenant" };
  }
}

const createTenantSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/, "Slug solo letras minúsculas, números y guiones"),
  planSaaSId: z.number().int().positive().optional(),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(8),
  sucursalNombre: z.string().trim().min(2).max(100).default("Sede Principal"),
  sucursalDireccion: z.string().trim().optional(),
  diasPrueba: z.number().int().min(0).max(365).default(14),
});

export async function crearTenantSuperAdmin(input: z.input<typeof createTenantSchema>) {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = createTenantSchema.parse(input);

    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return { success: false, error: "El slug ya está en uso por otro gimnasio" };
    }

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + data.diasPrueba);

    // Obtener plan SaaS
    let planId = data.planSaaSId;
    if (!planId) {
      const defaultPlan = await prisma.planSaaS.findFirst({ where: { activo: true }, orderBy: { precioMensual: "asc" } });
      planId = defaultPlan?.id;
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          nombre: data.nombre,
          slug: data.slug,
          estado: data.diasPrueba > 0 ? "prueba" : "activo",
          planSaaSId: planId,
          fechaVencimiento,
        },
      });

      const sucursal = await tx.sucursal.create({
        data: {
          tenantId: newTenant.id,
          nombre: data.sucursalNombre,
          direccion: data.sucursalDireccion || null,
          estado: "activo",
        },
      });

      // Crear usuario de admin con Better Auth hash / bcrypt
      const hashedPassword = await hashSuperAdminPassword(data.adminPassword);
      const user = await tx.user.create({
        data: {
          email: data.adminEmail,
          name: data.adminName,
          nivel: "admin",
          estado: "activo",
          emailVerified: true,
          accounts: {
            create: {
              accountId: data.adminEmail,
              providerId: "credential",
              password: hashedPassword,
            },
          },
          sucursales: {
            connect: [{ id: sucursal.id }],
          },
        },
      });

      await tx.tenantUsuario.create({
        data: {
          tenantId: newTenant.id,
          userId: user.id,
          rol: RolTenant.OWNER,
          estado: "activo",
        },
      });

      // Si tiene plan, crear suscripción inicial
      if (planId) {
        const plan = await tx.planSaaS.findUnique({ where: { id: planId } });
        if (plan) {
          await tx.suscripcionSaaS.create({
            data: {
              tenantId: newTenant.id,
              planId: plan.id,
              estado: data.diasPrueba > 0 ? "prueba" : "activa",
              fechaInicio: new Date(),
              fechaVencimiento,
              monto: plan.precioMensual,
              intervalo: "mensual",
              notas: `Alta desde SuperAdmin (${data.diasPrueba} días prueba)`,
            },
          });
        }
      }

      return newTenant;
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.tenant.crear",
      entidad: "Tenant",
      entidadId: tenant.id,
      metadata: { slug: tenant.slug, nombre: tenant.nombre },
    });

    return { success: true, data: serializeData(tenant) };
  } catch (error) {
    console.error("Error creando tenant:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error al crear gimnasio" };
  }
}

export async function actualizarTenantSuperAdmin(id: number, input: {
  nombre?: string;
  slug?: string;
  estado?: "activo" | "prueba" | "suspendido" | "cancelado";
  planSaaSId?: number | null;
  fechaVencimiento?: string | null;
  modulos?: Record<string, boolean>;
}) {
  try {
    const superAdmin = await requireSuperAdmin();

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Gimnasio no encontrado" };

    if (input.slug && input.slug !== existing.slug) {
      const slugUsed = await prisma.tenant.findUnique({ where: { slug: input.slug } });
      if (slugUsed) return { success: false, error: "El slug ya está en uso" };
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(input.nombre ? { nombre: input.nombre.trim() } : {}),
        ...(input.slug ? { slug: input.slug.trim().toLowerCase() } : {}),
        ...(input.estado ? { estado: input.estado } : {}),
        ...(input.planSaaSId !== undefined ? { planSaaSId: input.planSaaSId } : {}),
        ...(input.fechaVencimiento !== undefined
          ? { fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : null }
          : {}),
        ...(input.modulos !== undefined ? { modulos: input.modulos } : {}),
      },
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.tenant.actualizar",
      entidad: "Tenant",
      entidadId: id,
      metadata: input,
    });

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error actualizando gimnasio" };
  }
}

export async function suspenderTenantSuperAdmin(id: number, motivo?: string) {
  try {
    const superAdmin = await requireSuperAdmin();
    const updated = await prisma.tenant.update({
      where: { id },
      data: { estado: "suspendido" },
    });

    // Actualizar suscripción
    await prisma.suscripcionSaaS.updateMany({
      where: { tenantId: id, estado: { in: ["activa", "prueba"] } },
      data: { estado: "suspendida" },
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.tenant.suspender",
      entidad: "Tenant",
      entidadId: id,
      metadata: { motivo },
    });

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al suspender" };
  }
}

export async function reactivarTenantSuperAdmin(id: number, diasExtension = 30) {
  try {
    const superAdmin = await requireSuperAdmin();
    const nuevaFecha = new Date();
    nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension);

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        estado: "activo",
        fechaVencimiento: nuevaFecha,
      },
    });

    await prisma.suscripcionSaaS.updateMany({
      where: { tenantId: id, estado: "suspendida" },
      data: { estado: "activa", fechaVencimiento: nuevaFecha },
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.tenant.reactivar",
      entidad: "Tenant",
      entidadId: id,
      metadata: { diasExtension, nuevaFecha },
    });

    return { success: true, data: serializeData(updated) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al reactivar" };
  }
}

export async function getPlanesSaaS() {
  try {
    await requireSuperAdmin();
    const planes = await prisma.planSaaS.findMany({
      orderBy: { precioMensual: "asc" },
      include: { _count: { select: { tenants: true, suscripciones: true } } },
    });
    return { success: true, data: serializeData(planes) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cargar planes" };
  }
}

const planSchema = z.object({
  codigo: z.string().trim().min(2).max(50).toUpperCase(),
  nombre: z.string().trim().min(2).max(100),
  descripcion: z.string().trim().optional(),
  precioMensual: z.number().min(0),
  limiteUsuarios: z.number().int().min(1).default(5),
  limiteSucursales: z.number().int().min(1).default(1),
  limiteSocios: z.number().int().min(1).nullable().default(500),
  modulos: z.record(z.string(), z.boolean()).optional(),
  activo: z.boolean().default(true),
});

export async function crearPlanSaaS(input: z.input<typeof planSchema>) {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = planSchema.parse(input);

    const plan = await prisma.planSaaS.create({
      data: {
        ...data,
        descripcion: data.descripcion || null,
        modulos: data.modulos ? (data.modulos as any) : undefined,
      },
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.plan.crear",
      entidad: "PlanSaaS",
      entidadId: plan.id,
      metadata: { codigo: plan.codigo, precio: plan.precioMensual },
    });

    return { success: true, data: serializeData(plan) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear plan" };
  }
}

export async function actualizarPlanSaaS(id: number, input: Partial<z.input<typeof planSchema>>) {
  try {
    const superAdmin = await requireSuperAdmin();

    const plan = await prisma.planSaaS.update({
      where: { id },
      data: {
        ...(input.nombre ? { nombre: input.nombre.trim() } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion || null } : {}),
        ...(input.precioMensual !== undefined ? { precioMensual: input.precioMensual } : {}),
        ...(input.limiteUsuarios !== undefined ? { limiteUsuarios: input.limiteUsuarios } : {}),
        ...(input.limiteSucursales !== undefined ? { limiteSucursales: input.limiteSucursales } : {}),
        ...(input.limiteSocios !== undefined ? { limiteSocios: input.limiteSocios } : {}),
        ...(input.modulos !== undefined ? { modulos: input.modulos } : {}),
        ...(input.activo !== undefined ? { activo: input.activo } : {}),
      },
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.plan.actualizar",
      entidad: "PlanSaaS",
      entidadId: id,
      metadata: input,
    });

    return { success: true, data: serializeData(plan) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar plan" };
  }
}

export async function registrarPagoPlataforma(input: {
  tenantId: number;
  suscripcionId: number;
  monto: number;
  metodoPago: string;
  referencia?: string;
  comprobante?: string;
  extenderDias?: number;
}) {
  try {
    const superAdmin = await requireSuperAdmin();

    const pago = await prisma.$transaction(async (tx) => {
      const nuevoPago = await tx.pagoPlataforma.create({
        data: {
          tenantId: input.tenantId,
          suscripcionId: input.suscripcionId,
          monto: input.monto,
          metodoPago: input.metodoPago,
          referencia: input.referencia || null,
          comprobante: input.comprobante || null,
          estado: "completado",
        },
      });

      if (input.extenderDias && input.extenderDias > 0) {
        const sub = await tx.suscripcionSaaS.findUnique({ where: { id: input.suscripcionId } });
        const baseFecha = sub?.fechaVencimiento && sub.fechaVencimiento > new Date()
          ? sub.fechaVencimiento
          : new Date();
        const nuevaFecha = new Date(baseFecha);
        nuevaFecha.setDate(nuevaFecha.getDate() + input.extenderDias);

        await tx.suscripcionSaaS.update({
          where: { id: input.suscripcionId },
          data: { estado: "activa", fechaVencimiento: nuevaFecha },
        });

        await tx.tenant.update({
          where: { id: input.tenantId },
          data: { estado: "activo", fechaVencimiento: nuevaFecha },
        });
      }

      return nuevoPago;
    });

    await writeAudit({
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.pago_plataforma.registrar",
      entidad: "PagoPlataforma",
      entidadId: pago.id,
      metadata: input,
    });

    return { success: true, data: serializeData(pago) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al registrar pago" };
  }
}
