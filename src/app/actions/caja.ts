"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";

const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const BILLING_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];

function validPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export async function searchClientes(query: string, sucursalId: number) {
  try {
    const context = await requireStaffContext({ branchId: sucursalId, roles: BILLING_ROLES });
    await requireTenantModule(context.tenantId, "membresias");
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return { success: true, data: [] };

    const clientes = await prisma.cliente.findMany({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        sucursales: { some: { id: context.branchId! } },
        OR: [
          { documento: { contains: cleanQuery, mode: "insensitive" } },
          { nombre: { contains: cleanQuery, mode: "insensitive" } },
          { apellido: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      include: { pagos: { orderBy: { fechaVencimiento: "desc" }, take: 1 } },
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
      take: 10,
    });

    return {
      success: true,
      data: serializeData(clientes.map((cliente) => ({
        ...cliente,
        pagos: cliente.pagos.map((pago) => ({ ...pago, monto: Number(pago.monto) })),
      }))),
    };
  } catch {
    return { success: false, error: "Error buscando socios" };
  }
}

export async function getClienteParaCobro(clienteId: number, sucursalId: number) {
  try {
    const context = await requireStaffContext({ branchId: sucursalId, roles: BILLING_ROLES });
    await requireTenantModule(context.tenantId, "membresias");

    const cliente = await prisma.cliente.findFirst({
      where: {
        id: clienteId,
        tenantId: context.tenantId,
        estado: "activo",
        sucursales: { some: { id: context.branchId! } },
      },
      include: {
        pagos: {
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
          include: { membresia: { select: { nombre: true } } },
        },
      },
    });

    if (!cliente) return { success: false, error: "El socio no pertenece a la sede activa" };

    return {
      success: true,
      data: serializeData({
        id: cliente.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        documento: cliente.documento,
        ultimoPago: cliente.pagos[0]
          ? { ...cliente.pagos[0], monto: Number(cliente.pagos[0].monto) }
          : null,
      }),
    };
  } catch {
    return { success: false, error: "No se pudo cargar el socio" };
  }
}

export async function getMembresiasDisponibles() {
  try {
    const context = await requireStaffContext();
    await requireTenantModule(context.tenantId, "membresias");
    const membresias = await prisma.membresia.findMany({
      where: { tenantId: context.tenantId, estado: "activo" },
      orderBy: [{ diasDuracion: "asc" }, { nombre: "asc" }],
    });
    return {
      success: true,
      data: serializeData(membresias.map((membresia) => ({
        ...membresia,
        precio: Number(membresia.precio),
      }))),
    };
  } catch {
    return { success: false, error: "Error cargando membresías" };
  }
}

export async function registrarPago(data: {
  clienteId: number;
  membresiaId: number;
  sucursalId: number;
  monto?: number;
  metodoPago?: PaymentMethod;
  notas?: string;
}) {
  try {
    const context = await requireStaffContext({ branchId: data.sucursalId, roles: BILLING_ROLES });
    await requireTenantModule(context.tenantId, "membresias");

    const [membresia, cliente] = await Promise.all([
      prisma.membresia.findFirst({ where: { id: data.membresiaId, tenantId: context.tenantId, estado: "activo" } }),
      prisma.cliente.findFirst({
        where: {
          id: data.clienteId,
          tenantId: context.tenantId,
          estado: "activo",
          sucursales: { some: { id: context.branchId! } },
        },
        select: { id: true },
      }),
    ]);

    if (!membresia) return { success: false, error: "Plan de membresía no válido" };
    if (!cliente) return { success: false, error: "El socio no pertenece a la sede activa" };

    const metodoPago = data.metodoPago || "efectivo";
    if (!validPaymentMethod(metodoPago)) return { success: false, error: "Método de pago no válido" };

    const fechaActual = new Date();
    const ultimoPago = await prisma.pago.findFirst({
      where: { tenantId: context.tenantId, clienteId: data.clienteId, estado: "pagado" },
      orderBy: { fechaVencimiento: "desc" },
    });

    const fechaInicioBase = ultimoPago && ultimoPago.fechaVencimiento > fechaActual ? ultimoPago.fechaVencimiento : fechaActual;
    const fechaVencimiento = new Date(fechaInicioBase);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + membresia.diasDuracion);

    const montoFinal = Number(membresia.precio);
    const pago = await prisma.pago.create({
      data: {
        tenantId: context.tenantId,
        clienteId: data.clienteId,
        membresiaId: data.membresiaId,
        sucursalId: context.branchId,
        monto: montoFinal,
        metodoPago,
        notas: data.notas?.trim() || null,
        fechaVencimiento,
        estado: "pagado",
      },
      include: {
        cliente: { select: { nombre: true, apellido: true } },
        membresia: { select: { nombre: true } },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pagos");
    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${data.clienteId}`);
    revalidatePath("/portal/dashboard");

    return { success: true, data: serializeData({ ...pago, monto: Number(pago.monto) }) };
  } catch (error) {
    console.error("Error registrando pago:", error);
    return { success: false, error: "Error registrando el cobro" };
  }
}

export async function getMovimientosHoy(sucursalId: number) {
  try {
    const context = await requireStaffContext({ branchId: sucursalId, roles: BILLING_ROLES });
    await requireTenantModule(context.tenantId, "membresias");
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const pagos = await prisma.pago.findMany({
      where: { tenantId: context.tenantId, sucursalId: context.branchId, fechaPago: { gte: hoy } },
      include: { cliente: true, membresia: true },
      orderBy: { fechaPago: "desc" },
    });

    return {
      success: true,
      data: serializeData(pagos.map((pago) => ({
        ...pago,
        monto: Number(pago.monto),
        membresia: pago.membresia ? { ...pago.membresia, precio: Number(pago.membresia.precio) } : null,
      }))),
    };
  } catch {
    return { success: false, error: "Error cargando cobros" };
  }
}
