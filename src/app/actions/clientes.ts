"use server";

import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma, RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { assertActiveMemberBranch, resolveNewMemberBranches } from "@/lib/member-operations-policy";
import { prisma } from "@/lib/prisma";
import { clienteSchema, ClienteData } from "@/lib/schemas";
import { serializeData } from "@/lib/serialize";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { requireStaffContext, requireTenantModule, type StaffContext } from "@/lib/tenant-context";

const MEMBER_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];
const MEMBER_VIEW_ROLES = [...MEMBER_ROLES, RolTenant.ENTRENADOR];

const memberUpdateSchema = z.object({
  documento: z.string().trim().min(5, "El documento debe tener al menos 5 caracteres").optional(),
  nombre: z.string().trim().min(2, "El nombre es obligatorio").optional(),
  apellido: z.string().trim().min(2, "El apellido es obligatorio").optional(),
  telefono: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Correo electrónico inválido").nullable().optional().or(z.literal("")),
  direccion: z.string().trim().nullable().optional(),
  foto: z.string().nullable().optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
});

function temporaryMemberPassword() {
  return `${randomBytes(8).toString("base64url")}9!`;
}

function expectedMemberError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (
    error.message === "Seleccioná una sucursal antes de operar con socios" ||
    error.message === "La sucursal solicitada no coincide con la sede activa" ||
    error.message === "Recepción sólo puede dar de alta socios en la sede activa" ||
    error.message === "La sede activa debe estar incluida en el alta del socio"
  ) return error.message;
  return fallback;
}

async function requireMemberContext(requestedBranchId?: number) {
  const context = await requireStaffContext({ roles: MEMBER_ROLES });
  await requireTenantModule(context.tenantId, "socios");
  const branchId = assertActiveMemberBranch(context.branchId, requestedBranchId);
  return { ...context, branchId } as StaffContext & { branchId: number };
}

function activeBranchMemberScope(context: StaffContext & { branchId: number }): Prisma.ClienteWhereInput {
  return {
    tenantId: context.tenantId,
    sucursales: { some: { id: context.branchId } },
  };
}

function revalidateMemberPaths(clienteId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard/pagos");
  revalidatePath("/dashboard/cuentas");
  revalidatePath("/dashboard/caja");
  if (clienteId) revalidatePath(`/dashboard/clientes/${clienteId}`);
  revalidatePath("/molinete");
  revalidatePath("/portal/dashboard");
}

/** Obtiene socios visibles en la sede activa. */
export async function getClientes() {
  try {
    const context = await requireMemberContext();
    const clientes = await prisma.cliente.findMany({
      where: activeBranchMemberScope(context),
      orderBy: { fechaRegistro: "desc" },
    });
    return { success: true, data: serializeData(clientes) };
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return { success: false, error: expectedMemberError(error, "No se pudieron obtener los socios") };
  }
}

/**
 * Obtiene socios de la sede activa con paginación, filtros avanzados y estado de membresía en tiempo real.
 * La paginación se aplica después de calcular el estado de la última membresía para que
 * los filtros y totales sean coherentes entre páginas.
 */
export async function getClientesPaginados(params: {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
  sucursalId?: number;
}) {
  try {
    const context = await requireMemberContext(params.sucursalId);
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(5, params.limit || 15));
    const where: Prisma.ClienteWhereInput = activeBranchMemberScope(context);

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { documento: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
        { apellido: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
      ];
    }

    if (params.estado === "activo") where.estado = "activo";
    if (params.estado === "inactivo") where.estado = "inactivo";

    const clientesDb = await prisma.cliente.findMany({
      where,
      include: {
        pagos: {
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
          include: { membresia: true },
        },
        cuentaCorriente: true,
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });

    const hoy = new Date();
    let filteredItems = clientesDb.map((cliente) => {
      const ultimoPago = cliente.pagos[0];
      let estadoMembresia: "AL_DIA" | "VENCIDO" = "VENCIDO";
      let diasRestantes = 0;
      let vencimientoDate: Date | null = null;
      let vencenPronto = false;

      if (ultimoPago) {
        vencimientoDate = new Date(ultimoPago.fechaVencimiento);
        vencimientoDate.setHours(23, 59, 59, 999);
        if (vencimientoDate >= hoy) {
          estadoMembresia = "AL_DIA";
          diasRestantes = Math.ceil((vencimientoDate.getTime() - hoy.getTime()) / 86400000);
          vencenPronto = diasRestantes <= 7;
        }
      }

      return {
        id: cliente.id,
        documento: cliente.documento,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        email: cliente.email,
        direccion: cliente.direccion,
        foto: cliente.foto,
        estado: cliente.estado,
        fechaRegistro: cliente.fechaRegistro,
        estadoMembresia,
        diasRestantes,
        vencenPronto,
        ultimoPlan: ultimoPago?.membresia.nombre || "Sin plan",
        fechaVencimiento: vencimientoDate?.toISOString() || null,
        saldoCuenta: cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.saldo) : 0,
        limiteCredito: cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.limiteCredito) : 0,
      };
    });

    if (params.estado === "al_dia") filteredItems = filteredItems.filter((item) => item.estadoMembresia === "AL_DIA");
    else if (params.estado === "vencido") filteredItems = filteredItems.filter((item) => item.estadoMembresia === "VENCIDO" && item.fechaVencimiento !== null);
    else if (params.estado === "vencen_pronto") filteredItems = filteredItems.filter((item) => item.estadoMembresia === "AL_DIA" && item.vencenPronto);

    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const safeSkip = (safePage - 1) * limit;

    return {
      success: true,
      data: serializeData({
        items: filteredItems.slice(safeSkip, safeSkip + limit),
        pagination: { total, page: safePage, limit, totalPages },
      }),
    };
  } catch (error) {
    console.error("Error al obtener clientes paginados:", error);
    return { success: false, error: expectedMemberError(error, "Error al cargar los socios") };
  }
}

/** Crea un socio con acceso al portal y cuenta corriente sin crédito preautorizado. */
export async function createCliente(data: ClienteData) {
  const parsed = clienteSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  try {
    const context = await requireMemberContext();
    const branchIds = resolveNewMemberBranches(context.role, context.branchId, parsed.data.sucursalesIds);
    const allowedBranches = await prisma.sucursal.findMany({
      where: { tenantId: context.tenantId, estado: "activo", id: { in: branchIds } },
      select: { id: true },
    });
    if (allowedBranches.length !== branchIds.length) return { success: false, error: "Una de las sedes seleccionadas no está disponible" };

    const cleanDoc = parsed.data.documento.trim();
    const temporaryPassword = temporaryMemberPassword();
    const initialPassword = await hash(temporaryPassword, 12);

    const clienteCreado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          tenantId: context.tenantId,
          documento: cleanDoc,
          nombre: parsed.data.nombre.trim(),
          apellido: parsed.data.apellido.trim(),
          telefono: parsed.data.telefono?.trim() || null,
          email: parsed.data.email?.trim() || null,
          direccion: parsed.data.direccion?.trim() || null,
          foto: parsed.data.foto || null,
          estado: parsed.data.estado || "activo",
          sucursales: { connect: allowedBranches.map(({ id }) => ({ id })) },
        },
      });

      await tx.usuarioCliente.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          usuario: cleanDoc,
          password: initialPassword,
          debeCambiarPassword: true,
        },
      });

      await tx.cuentaCorriente.create({ data: { clienteId: cliente.id, saldo: 0, limiteCredito: 0 } });
      return cliente;
    });

    revalidateMemberPaths(clienteCreado.id);
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "socio.crear",
      entidad: "Cliente",
      entidadId: clienteCreado.id,
      metadata: { branchIds },
    });

    return { success: true, data: serializeData(clienteCreado), temporaryPassword };
  } catch (error: unknown) {
    console.error("Error al crear cliente:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe un socio con ese número de documento" };
    }
    return { success: false, error: expectedMemberError(error, "Error interno al crear el socio") };
  }
}

/** Actualiza datos del socio visible en la sede activa y mantiene sincronizado su usuario si cambia el DNI. */
export async function updateCliente(id: number, data: Partial<ClienteData> & { foto?: string | null }) {
  const parsed = memberUpdateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((issue) => issue.message).join(", ") };

  try {
    const context = await requireMemberContext();
    const scope = activeBranchMemberScope(context);
    const current = await prisma.cliente.findFirst({ where: { ...scope, id }, select: { id: true, documento: true } });
    if (!current) return { success: false, error: "Socio no encontrado en la sede activa" };

    const values = parsed.data;
    const nextDocument = values.documento?.trim() || current.documento;
    const updated = await prisma.$transaction(async (tx) => {
      const member = await tx.cliente.update({
        where: { id: current.id },
        data: {
          ...(values.documento !== undefined ? { documento: nextDocument } : {}),
          ...(values.nombre !== undefined ? { nombre: values.nombre.trim() } : {}),
          ...(values.apellido !== undefined ? { apellido: values.apellido.trim() } : {}),
          ...(values.telefono !== undefined ? { telefono: values.telefono?.trim() || null } : {}),
          ...(values.email !== undefined ? { email: values.email?.trim() || null } : {}),
          ...(values.direccion !== undefined ? { direccion: values.direccion?.trim() || null } : {}),
          ...(values.foto !== undefined ? { foto: values.foto || null } : {}),
          ...(values.estado !== undefined ? { estado: values.estado } : {}),
        },
      });

      if (nextDocument !== current.documento) {
        await tx.usuarioCliente.updateMany({
          where: { tenantId: context.tenantId, clienteId: current.id },
          data: { usuario: nextDocument },
        });
      }
      return member;
    });

    revalidateMemberPaths(id);
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "socio.actualizar", entidad: "Cliente", entidadId: id });
    return { success: true, data: serializeData(updated) };
  } catch (error) {
    console.error("Error actualizando cliente:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "El documento indicado ya está siendo utilizado" };
    }
    return { success: false, error: expectedMemberError(error, "Error al actualizar los datos del socio") };
  }
}

/** Obtiene la ficha 360 respetando cartera del entrenador o sede activa del equipo administrativo. */
export async function getCliente(id: number) {
  try {
    const context = await requireStaffContext({ roles: MEMBER_VIEW_ROLES });
    await requireTenantModule(context.tenantId, "socios");

    let memberScope: Prisma.ClienteWhereInput;
    if (context.role === RolTenant.ENTRENADOR) {
      memberScope = await getStaffMemberScope(context);
    } else {
      const branchId = assertActiveMemberBranch(context.branchId);
      memberScope = activeBranchMemberScope({ ...context, branchId });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id, ...memberScope },
      include: {
        pagos: { include: { membresia: true }, orderBy: { fechaPago: "desc" }, take: 30 },
        ingresos: { orderBy: { fechaHora: "desc" }, take: 30 },
        cuentaCorriente: {
          include: { movimientos: { orderBy: { fecha: "desc" }, take: 30 } },
        },
        sucursales: true,
        usuarioCliente: { select: { usuario: true, debeCambiarPassword: true, ultimoAcceso: true } },
      },
    });

    if (!cliente) return { success: false, error: "Socio no encontrado o fuera de tu alcance operativo" };
    const visible = context.role === RolTenant.ENTRENADOR
      ? { ...cliente, pagos: [], cuentaCorriente: null, usuarioCliente: null }
      : cliente;
    return { success: true, data: serializeData(visible) };
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    return { success: false, error: expectedMemberError(error, "No se pudo obtener el socio") };
  }
}

/** Genera una nueva contraseña temporal y cierra las sesiones previas del socio de la sede activa. */
export async function resetPasswordCliente(clienteId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    await requireTenantModule(context.tenantId, "socios");
    const branchId = assertActiveMemberBranch(context.branchId);
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: context.tenantId, sucursales: { some: { id: branchId } } },
      select: { id: true, documento: true },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado en la sede activa" };

    const auth = await prisma.usuarioCliente.findFirst({ where: { clienteId, tenantId: context.tenantId } });
    const temporaryPassword = temporaryMemberPassword();
    const password = await hash(temporaryPassword, 12);

    await prisma.$transaction(async (tx) => {
      if (!auth) {
        await tx.usuarioCliente.create({
          data: { tenantId: context.tenantId, clienteId, usuario: cliente.documento.trim(), password, debeCambiarPassword: true },
        });
      } else {
        await tx.usuarioCliente.update({ where: { clienteId }, data: { password, debeCambiarPassword: true } });
      }
      await tx.sesionSocio.deleteMany({ where: { tenantId: context.tenantId, clienteId } });
    });

    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "socio.password_temporal", entidad: "Cliente", entidadId: clienteId });
    revalidatePath(`/dashboard/clientes/${clienteId}`);
    return { success: true, mensaje: "Contraseña temporal generada. Las sesiones anteriores fueron cerradas.", temporaryPassword };
  } catch (error) {
    console.error("Error reseteando contraseña:", error);
    return { success: false, error: expectedMemberError(error, "Error al resetear contraseña") };
  }
}

/** Activa o desactiva un socio usando su estado real en servidor. */
export async function toggleClienteEstado(id: number, _estadoActual?: string) {
  try {
    const context = await requireMemberContext();
    const current = await prisma.cliente.findFirst({
      where: { ...activeBranchMemberScope(context), id },
      select: { id: true, estado: true },
    });
    if (!current) return { success: false, error: "Socio no encontrado en la sede activa" };

    const nuevoEstado = current.estado === "activo" ? "inactivo" : "activo";
    await prisma.cliente.update({ where: { id: current.id }, data: { estado: nuevoEstado } });
    revalidateMemberPaths(id);
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: nuevoEstado === "activo" ? "socio.activar" : "socio.desactivar",
      entidad: "Cliente",
      entidadId: id,
    });
    return { success: true, nuevoEstado };
  } catch (error) {
    console.error("Error cambiando estado cliente:", error);
    return { success: false, error: expectedMemberError(error, "Error cambiando estado") };
  }
}

/** Exporta únicamente los socios visibles en la sede activa. */
export async function exportarClientesData(sucursalId?: number) {
  try {
    const context = await requireMemberContext(sucursalId);
    const clientes = await prisma.cliente.findMany({
      where: activeBranchMemberScope(context),
      include: {
        pagos: { orderBy: { fechaVencimiento: "desc" }, take: 1, include: { membresia: true } },
        cuentaCorriente: true,
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });

    const hoy = new Date();
    return {
      success: true,
      data: clientes.map((cliente) => {
        const ultimoPago = cliente.pagos[0];
        const tienePagoActivo = Boolean(ultimoPago && new Date(ultimoPago.fechaVencimiento) >= hoy);
        return {
          documento: cliente.documento,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          telefono: cliente.telefono || "",
          email: cliente.email || "",
          direccion: cliente.direccion || "",
          estado: cliente.estado,
          estadoMembresia: ultimoPago ? (tienePagoActivo ? "Al día" : "Vencido") : "Sin membresía",
          ultimoPlan: ultimoPago?.membresia.nombre || "Sin plan",
          vencimiento: ultimoPago ? new Date(ultimoPago.fechaVencimiento).toLocaleDateString("es-AR") : "—",
          saldoDeuda: cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.saldo) : 0,
          fechaRegistro: new Date(cliente.fechaRegistro).toLocaleDateString("es-AR"),
        };
      }),
    };
  } catch (error) {
    console.error("Error exportando clientes:", error);
    return { success: false, error: expectedMemberError(error, "Error exportando socios") };
  }
}
