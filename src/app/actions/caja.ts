"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

export async function searchClientes(query: string, sucursalId: number) {
  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        estado: "activo",
        OR: [
          { documento: { contains: query, mode: "insensitive" } },
          { nombre: { contains: query, mode: "insensitive" } },
          { apellido: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        pagos: {
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
        },
      },
      take: 10,
    });

    return {
      success: true,
      data: serializeData(
        clientes.map(c => ({
          ...c,
          pagos: c.pagos.map(p => ({ ...p, monto: Number(p.monto) })),
        }))
      ),
    };
  } catch (error) {
    return { success: false, error: "Error buscando clientes" };
  }
}

export async function getMembresiasDisponibles() {
  try {
    const membresias = await prisma.membresia.findMany({
      where: { estado: "activo" },
      orderBy: { diasDuracion: "asc" },
    });
    return {
      success: true,
      data: serializeData(
        membresias.map(m => ({
          ...m,
          precio: Number(m.precio),
        }))
      ),
    };
  } catch (error) {
    return { success: false, error: "Error cargando membresías" };
  }
}

export async function registrarPago(data: {
  clienteId: number;
  membresiaId: number;
  sucursalId: number;
  monto: number;
  notas?: string;
}) {
  try {
    const membresia = await prisma.membresia.findUnique({
      where: { id: data.membresiaId },
    });

    if (!membresia) {
      return { success: false, error: "Membresía no válida" };
    }

    // Calcular fecha vencimiento
    const fechaActual = new Date();

    // Buscar último pago para ver si tiene días a favor
    const ultimoPago = await prisma.pago.findFirst({
      where: { clienteId: data.clienteId },
      orderBy: { fechaVencimiento: "desc" },
    });

    let fechaInicioBase = fechaActual;

    // Si el último pago aún no vence, sumamos a partir de ahí
    if (ultimoPago && ultimoPago.fechaVencimiento > fechaActual) {
      fechaInicioBase = ultimoPago.fechaVencimiento;
    }

    const fechaVencimiento = new Date(fechaInicioBase);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + membresia.diasDuracion);

    const pago = await prisma.pago.create({
      data: {
        clienteId: data.clienteId,
        membresiaId: data.membresiaId,
        sucursalId: data.sucursalId,
        monto: data.monto,
        notas: data.notas,
        fechaVencimiento: fechaVencimiento,
      },
    });

    revalidatePath("/dashboard/caja");
    revalidatePath("/dashboard/clientes");

    return {
      success: true,
      data: serializeData({
        ...pago,
        monto: Number(pago.monto),
      }),
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Error registrando pago" };
  }
}

export async function getMovimientosHoy(sucursalId: number) {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const pagos = await prisma.pago.findMany({
      where: {
        sucursalId: sucursalId,
        fechaPago: {
          gte: hoy,
        },
      },
      include: {
        cliente: true,
        membresia: true,
      },
      orderBy: { fechaPago: "desc" },
    });

    return {
      success: true,
      data: serializeData(
        pagos.map(p => ({
          ...p,
          monto: Number(p.monto),
          membresia: p.membresia ? { ...p.membresia, precio: Number(p.membresia.precio) } : null,
        }))
      ),
    };
  } catch (error) {
    return { success: false, error: "Error cargando movimientos" };
  }
}
