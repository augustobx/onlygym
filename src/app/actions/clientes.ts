"use server";

import { prisma } from "@/lib/prisma";
import { clienteSchema, ClienteData } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { Prisma, RolTenant } from "@prisma/client";
import { hash } from "bcryptjs";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { randomBytes } from "node:crypto";
import { writeAudit } from "@/lib/audit";

function temporaryMemberPassword() {
  return `${randomBytes(8).toString("base64url")}9!`;
}

/**
 * Obtiene clientes de forma básica
 */
export async function getClientes() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    const clientes = await prisma.cliente.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { fechaRegistro: "desc" },
    });
    return { success: true, data: serializeData(clientes) };
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return { success: false, error: "No se pudieron obtener los clientes" };
  }
}

/**
 * Obtiene clientes con paginación, filtros avanzados y estado de membresía en tiempo real.
 * La paginación se aplica después de calcular el estado de la última membresía para que
 * los filtros y totales sean coherentes entre páginas.
 */
export async function getClientesPaginados(params: {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string; // todos, activo, inactivo, al_dia, vencido, vencen_pronto
  sucursalId?: number;
}) {
  try {
    const context = await requireStaffContext({
      ...(params.sucursalId ? { branchId: params.sucursalId } : {}),
      roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION],
    });
    await requireTenantModule(context.tenantId, "socios");

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(5, params.limit || 15));
    const skip = (page - 1) * limit;
    const where: Prisma.ClienteWhereInput = { tenantId: context.tenantId };

    if (params.sucursalId) {
      where.sucursales = { some: { id: params.sucursalId } };
    }

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
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    });

    const hoy = new Date();
    let filteredItems = clientesDb.map((c) => {
      const ultimoPago = c.pagos?.[0];
      let estadoMembresia: "AL_DIA" | "VENCIDO" = "VENCIDO";
      let diasRestantes = 0;
      let vencimientoDate: Date | null = null;
      let vencenPronto = false;

      if (ultimoPago) {
        vencimientoDate = new Date(ultimoPago.fechaVencimiento);
        vencimientoDate.setHours(23, 59, 59, 999);

        if (vencimientoDate >= hoy) {
          estadoMembresia = "AL_DIA";
          const diff = vencimientoDate.getTime() - hoy.getTime();
          diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
          vencenPronto = diasRestantes <= 7;
        }
      }

      return {
        id: c.id,
        documento: c.documento,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
        foto: c.foto,
        estado: c.estado,
        fechaRegistro: c.fechaRegistro,
        estadoMembresia,
        diasRestantes,
        vencenPronto,
        ultimoPlan: ultimoPago ? ultimoPago.membresia.nombre : "Sin plan",
        fechaVencimiento: vencimientoDate ? vencimientoDate.toISOString() : null,
        saldoCuenta: c.cuentaCorriente ? Number(c.cuentaCorriente.saldo) : 0,
        limiteCredito: c.cuentaCorriente ? Number(c.cuentaCorriente.limiteCredito) : 0,
      };
    });

    if (params.estado === "al_dia") {
      filteredItems = filteredItems.filter((item) => item.estadoMembresia === "AL_DIA");
    } else if (params.estado === "vencido") {
      filteredItems = filteredItems.filter((item) => item.estadoMembresia === "VENCIDO" && item.fechaVencimiento !== null);
    } else if (params.estado === "vencen_pronto") {
      filteredItems = filteredItems.filter((item) => item.estadoMembresia === "AL_DIA" && item.vencenPronto);
    }

    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const safeSkip = (safePage - 1) * limit;
    const items = filteredItems.slice(safeSkip, safeSkip + limit);

    return {
      success: true,
      data: serializeData({
        items,
        pagination: { total, page: safePage, limit, totalPages },
      }),
    };
  } catch (error) {
    console.error("Error al obtener clientes paginados:", error);
    return { success: false, error: "Error al cargar los clientes" };
  }
}

/**
 * Crea un socio nuevo con perfil, credencial de portal y cuenta corriente.
 */
export async function createCliente(data: ClienteData & { sucursalesIds?: number[] }) {
  const result = clienteSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    await requireTenantModule(context.tenantId, "socios");
    const cleanDoc = result.data.documento.trim();
    const allowedBranches = data.sucursalesIds?.length
      ? await prisma.sucursal.findMany({
          where: { tenantId: context.tenantId, id: { in: data.sucursalesIds } },
          select: { id: true },
        })
      : [];

    if (data.sucursalesIds?.length && allowedBranches.length !== new Set(data.sucursalesIds).size) {
      return { success: false, error: "Una sucursal no pertenece al gimnasio" };
    }

    const temporaryPassword = temporaryMemberPassword();
    const initialPassword = await hash(temporaryPassword, 12);

    const clienteCreado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          tenantId: context.tenantId,
          documento: cleanDoc,
          nombre: result.data.nombre.trim(),
          apellido: result.data.apellido.trim(),
          telefono: result.data.telefono?.trim() || null,
          email: result.data.email?.trim() || null,
          direccion: result.data.direccion?.trim() || null,
          foto: result.data.foto || null,
          estado: result.data.estado || "activo",
          sucursales: data.sucursalesIds?.length
            ? { connect: allowedBranches.map(({ id }) => ({ id })) }
            : undefined,
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

      await tx.cuentaCorriente.create({
        data: { clienteId: cliente.id, saldo: 0, limiteCredito: 5000 },
      });

      return cliente;
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath("/dashboard/cuentas");
    revalidatePath("/dashboard/caja");
    revalidatePath("/molinete");

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "socio.crear",
      entidad: "Cliente",
      entidadId: clienteCreado.id,
    });
    return { success: true, data: serializeData(clienteCreado), temporaryPassword };
  } catch (error: unknown) {
    console.error("Error al crear cliente:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe un cliente con ese número de documento" };
    }
    return { success: false, error: "Error interno al crear el cliente" };
  }
}

/**
 * Actualiza los datos y/o foto de un socio
 */
export async function updateCliente(id: number, data: Partial<ClienteData>) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    const updatedResult = await prisma.cliente.updateMany({ where: { id, tenantId: context.tenantId }, data });
    if (!updatedResult.count) return { success: false, error: "Cliente no encontrado" };
    const updated = await prisma.cliente.findFirst({ where: { id, tenantId: context.tenantId } });
    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${id}`);
    revalidatePath("/molinete");
    return { success: true, data: serializeData(updated) };
  } catch (error) {
    console.error("Error actualizando cliente:", error);
    return { success: false, error: "Error al actualizar los datos del cliente" };
  }
}

/**
 * Obtiene la ficha 360 completa de un socio
 */
export async function getCliente(id: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION, RolTenant.ENTRENADOR] });
    const memberScope = await getStaffMemberScope(context);
    const cliente = await prisma.cliente.findFirst({
      where: { id, ...memberScope },
      include: {
        pagos: {
          include: { membresia: true },
          orderBy: { fechaPago: "desc" },
          take: 30,
        },
        ingresos: {
          orderBy: { fechaHora: "desc" },
          take: 30,
        },
        cuentaCorriente: {
          include: {
            movimientos: {
              orderBy: { fecha: "desc" },
              take: 30,
            },
          },
        },
        sucursales: true,
        usuarioCliente: { select: { usuario: true, debeCambiarPassword: true, ultimoAcceso: true } },
      },
    });

    if (!cliente) return { success: false, error: "Cliente no encontrado" };

    const visible = context.role === RolTenant.ENTRENADOR
      ? { ...cliente, pagos: [], cuentaCorriente: null, usuarioCliente: null }
      : cliente;
    return { success: true, data: serializeData(visible) };
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    return { success: false, error: "No se pudo obtener el cliente" };
  }
}

/**
 * RENOVAR O CARGAR MEMBRESÍA 360 DIRECTAMENTE DESDE LA FICHA DEL CLIENTE
 */
export async function renovarMembresiaCliente360(data: {
  clienteId: number;
  membresiaId: number;
  sucursalId?: number;
  metodoPago?: string;
  monto?: number;
  notas?: string;
  extenderDesdeVencimiento?: boolean;
}) {
  try {
    const context = await requireStaffContext({
      branchId: data.sucursalId || undefined,
      roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION],
    });
    await requireTenantModule(context.tenantId, "membresias");

    const { clienteId, membresiaId, metodoPago = "efectivo", notas, extenderDesdeVencimiento = true } = data;
    const sucursalId = data.sucursalId ?? context.branchId;
    if (!sucursalId) return { success: false, error: "Seleccioná una sede antes de registrar el cobro" };

    const [cliente, membresia] = await Promise.all([
      prisma.cliente.findFirst({
        where: { id: clienteId, tenantId: context.tenantId },
        include: {
          pagos: { orderBy: { fechaVencimiento: "desc" }, take: 1 },
          cuentaCorriente: true,
        },
      }),
      prisma.membresia.findFirst({
        where: { id: membresiaId, tenantId: context.tenantId },
      }),
    ]);

    if (!cliente) return { success: false, error: "Socio no encontrado" };
    if (!membresia) return { success: false, error: "Plan de membresía no encontrado" };

    const montoFinal = data.monto !== undefined ? data.monto : Number(membresia.precio);
    const hoy = new Date();
    let baseDate = new Date();
    const ultimoPago = cliente.pagos?.[0];

    if (extenderDesdeVencimiento && ultimoPago) {
      const ultVenc = new Date(ultimoPago.fechaVencimiento);
      if (ultVenc > hoy) baseDate = new Date(ultVenc);
    }

    const fechaVencimiento = new Date(baseDate.getTime() + membresia.diasDuracion * 24 * 60 * 60 * 1000);

    const pagoRegistrado = await prisma.$transaction(async (tx) => {
      const nuevoPago = await tx.pago.create({
        data: {
          tenantId: context.tenantId,
          clienteId,
          membresiaId,
          sucursalId,
          fechaPago: new Date(),
          fechaVencimiento,
          monto: montoFinal,
          metodoPago,
          estado: "pagado",
          notas: notas || `Renovación 360 Plan ${membresia.nombre}`,
        },
        include: { membresia: true, cliente: true },
      });

      if (metodoPago === "cuenta_corriente") {
        let cuenta = cliente.cuentaCorriente;
        if (!cuenta) {
          cuenta = await tx.cuentaCorriente.create({ data: { clienteId, saldo: 0, limiteCredito: 5000 } });
        }

        await tx.cuentaCorriente.update({
          where: { id: cuenta.id },
          data: { saldo: { increment: montoFinal } },
        });

        await tx.cuentaMovimiento.create({
          data: {
            cuentaId: cuenta.id,
            tipo: "cargo",
            monto: montoFinal,
            concepto: `Cuota Membresía: ${membresia.nombre}`,
          },
        });
      }

      return nuevoPago;
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${clienteId}`);
    revalidatePath("/dashboard/pagos");
    revalidatePath("/dashboard/cuentas");
    revalidatePath("/dashboard/caja");
    revalidatePath("/molinete");
    revalidatePath("/portal/dashboard");

    return {
      success: true,
      mensaje: `¡Membresía ${membresia.nombre} renovada con éxito hasta el ${fechaVencimiento.toLocaleDateString("es-AR")}!`,
      data: serializeData(pagoRegistrado),
    };
  } catch (error) {
    console.error("Error al renovar membresía 360:", error);
    return { success: false, error: "Error al registrar la renovación de la membresía" };
  }
}

/**
 * Genera una nueva contraseña temporal para el portal del socio.
 */
export async function resetPasswordCliente(clienteId: number) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const auth = await prisma.usuarioCliente.findFirst({ where: { clienteId, tenantId: context.tenantId } });
    const temporaryPassword = temporaryMemberPassword();
    const password = await hash(temporaryPassword, 12);

    if (!auth) {
      const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, tenantId: context.tenantId } });
      if (!cliente) return { success: false, error: "Cliente no encontrado" };

      await prisma.$transaction([
        prisma.usuarioCliente.create({ data: { tenantId: context.tenantId, clienteId, usuario: cliente.documento.trim(), password, debeCambiarPassword: true } }),
        prisma.sesionSocio.deleteMany({ where: { tenantId: context.tenantId, clienteId } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.usuarioCliente.update({ where: { clienteId }, data: { password, debeCambiarPassword: true } }),
        prisma.sesionSocio.deleteMany({ where: { tenantId: context.tenantId, clienteId } }),
      ]);
    }

    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "socio.password_temporal", entidad: "Cliente", entidadId: clienteId });
    return { success: true, mensaje: "Contraseña temporal generada. Las sesiones anteriores fueron cerradas.", temporaryPassword };
  } catch (error) {
    console.error("Error reseteando contraseña:", error);
    return { success: false, error: "Error al resetear contraseña" };
  }
}

/**
 * Activa o desactiva un socio
 */
export async function toggleClienteEstado(id: number, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION] });
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    const result = await prisma.cliente.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { estado: nuevoEstado },
    });
    if (!result.count) return { success: false, error: "Cliente no encontrado" };

    revalidatePath("/dashboard/clientes");
    revalidatePath("/molinete");
    return { success: true, nuevoEstado };
  } catch (error) {
    console.error("Error cambiando estado cliente:", error);
    return { success: false, error: "Error cambiando estado" };
  }
}

/**
 * Exporta todos los clientes para descarga en CSV
 */
export async function exportarClientesData(sucursalId?: number) {
  try {
    const context = await requireStaffContext({
      ...(sucursalId ? { branchId: sucursalId } : {}),
      roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION],
    });
    const where: Prisma.ClienteWhereInput = { tenantId: context.tenantId };
    if (sucursalId) where.sucursales = { some: { id: sucursalId } };

    const clientes = await prisma.cliente.findMany({
      where,
      include: {
        pagos: {
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
          include: { membresia: true },
        },
        cuentaCorriente: true,
      },
      orderBy: { nombre: "asc" },
    });

    const hoy = new Date();

    return {
      success: true,
      data: clientes.map((c) => {
        const ultimoPago = c.pagos?.[0];
        const tienePagoActivo = ultimoPago && new Date(ultimoPago.fechaVencimiento) >= hoy;

        return {
          documento: c.documento,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono || "",
          email: c.email || "",
          direccion: c.direccion || "",
          estado: c.estado,
          estadoMembresia: tienePagoActivo ? "Al Día" : "Vencido",
          ultimoPlan: ultimoPago ? ultimoPago.membresia.nombre : "Sin plan",
          vencimiento: ultimoPago ? new Date(ultimoPago.fechaVencimiento).toLocaleDateString("es-AR") : "—",
          saldoDeuda: c.cuentaCorriente ? Number(c.cuentaCorriente.saldo) : 0,
          fechaRegistro: new Date(c.fechaRegistro).toLocaleDateString("es-AR"),
        };
      }),
    };
  } catch (error) {
    console.error("Error exportando clientes:", error);
    return { success: false, error: "Error exportando clientes" };
  }
}
