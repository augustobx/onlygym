"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

export async function getCuentas() {
  try {
    const cuentas = await prisma.cuentaCorriente.findMany({
      include: {
        cliente: true
      },
      orderBy: {
        saldo: "desc"
      }
    });
    
    return { success: true, data: serializeData(cuentas.map(c => ({ ...c, saldo: Number(c.saldo), limiteCredito: Number(c.limiteCredito) }))) };
  } catch (error) {
    return { success: false, error: "Error obteniendo cuentas corrientes" };
  }
}

export async function registrarPagoCuenta(clienteId: number, monto: number, concepto: string, userId?: string) {
  try {
    const cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId } });
    if (!cuenta) {
      return { success: false, error: "El cliente no tiene cuenta corriente" };
    }

    await prisma.$transaction([
      prisma.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: { saldo: { decrement: monto } }
      }),
      prisma.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "pago",
          monto,
          concepto,
          usuarioAdminId: userId
        }
      })
    ]);

    revalidatePath("/dashboard/cuentas");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error registrando el pago" };
  }
}

export async function registrarCargoCuenta(clienteId: number, monto: number, concepto: string, userId?: string) {
  try {
    let cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId } });
    if (!cuenta) {
      cuenta = await prisma.cuentaCorriente.create({
        data: { clienteId, saldo: 0, limiteCredito: 0 }
      });
    }

    await prisma.$transaction([
      prisma.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: { saldo: { increment: monto } }
      }),
      prisma.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "cargo",
          monto,
          concepto,
          usuarioAdminId: userId
        }
      })
    ]);

    revalidatePath("/dashboard/cuentas");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error registrando el cargo" };
  }
}

export async function getMovimientosCuenta(clienteId: number) {
  try {
    const cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId } });
    if (!cuenta) return { success: true, data: [] };

    const movimientos = await prisma.cuentaMovimiento.findMany({
      where: { cuentaId: cuenta.id },
      include: { usuarioAdmin: true },
      orderBy: { fecha: "desc" }
    });

    return { 
      success: true, 
      data: serializeData(movimientos.map(m => ({ 
        ...m, 
        monto: Number(m.monto),
        usuario: m.usuarioAdmin ? m.usuarioAdmin.name : "Sistema"
      }))) 
    };
  } catch (error) {
    return { success: false, error: "Error obteniendo historial" };
  }
}

export async function setLimiteCredito(clienteId: number, limite: number) {
  try {
    const cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId } });
    if (!cuenta) {
      await prisma.cuentaCorriente.create({
        data: { clienteId, saldo: 0, limiteCredito: limite }
      });
    } else {
      await prisma.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: { limiteCredito: limite }
      });
    }
    
    revalidatePath("/dashboard/cuentas");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error estableciendo el límite" };
  }
}
