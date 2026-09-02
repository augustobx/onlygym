"use server";

import { RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { requireStaffContext } from "@/lib/tenant-context";

const ACCOUNT_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];

function validAmount(value: number) {
  return Number.isFinite(value) && value > 0;
}

function revalidateAccountPaths(clienteId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cuentas");
  revalidatePath("/dashboard/clientes");
  if (clienteId) revalidatePath(`/dashboard/clientes/${clienteId}`);
  revalidatePath("/portal/dashboard");
}

async function accountContext() {
  const context = await requireStaffContext({ roles: ACCOUNT_ROLES });
  return { context, memberScope: await getStaffMemberScope(context) };
}

export async function getAccountOperationsContext() {
  try {
    const context = await requireStaffContext({ roles: ACCOUNT_ROLES });
    return {
      success: true,
      data: {
        role: context.role,
        branchId: context.branchId,
        canSetCreditLimit: context.role === RolTenant.OWNER || context.role === RolTenant.ADMIN,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function getCuentas() {
  try {
    const { memberScope } = await accountContext();
    const cuentas = await prisma.cuentaCorriente.findMany({
      where: { cliente: memberScope },
      include: { cliente: true },
      orderBy: { saldo: "desc" },
    });

    return {
      success: true,
      data: serializeData(cuentas.map((cuenta) => ({
        ...cuenta,
        saldo: Number(cuenta.saldo),
        limiteCredito: Number(cuenta.limiteCredito),
      }))),
    };
  } catch {
    return { success: false, error: "Error obteniendo cuentas corrientes" };
  }
}

export async function registrarPagoCuenta(clienteId: number, monto: number, concepto: string) {
  try {
    if (!validAmount(monto)) return { success: false, error: "Ingresá un monto válido" };
    const { context, memberScope } = await accountContext();
    const cuenta = await prisma.cuentaCorriente.findFirst({ where: { clienteId, cliente: memberScope } });
    if (!cuenta) return { success: false, error: "El socio no tiene una cuenta accesible desde la sede activa" };

    const saldoActual = Number(cuenta.saldo);
    if (saldoActual <= 0) return { success: false, error: "La cuenta no tiene deuda pendiente" };
    if (monto > saldoActual) return { success: false, error: `El abono no puede superar la deuda actual de $${saldoActual.toFixed(2)}` };

    await prisma.$transaction([
      prisma.cuentaCorriente.update({ where: { id: cuenta.id }, data: { saldo: { decrement: monto } } }),
      prisma.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "pago",
          monto,
          concepto: concepto.trim() || "Abono a cuenta corriente",
          usuarioAdminId: context.userId,
        },
      }),
    ]);

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch {
    return { success: false, error: "Error registrando el abono" };
  }
}

export async function registrarCargoCuenta(clienteId: number, monto: number, concepto: string) {
  try {
    if (!validAmount(monto)) return { success: false, error: "Ingresá un monto válido" };
    const { context, memberScope } = await accountContext();
    const member = await prisma.cliente.findFirst({
      where: { ...memberScope, id: clienteId, estado: "activo" },
      select: { id: true },
    });
    if (!member) return { success: false, error: "Socio no encontrado o fuera de la sede activa" };

    let cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId: member.id } });
    if (!cuenta) cuenta = await prisma.cuentaCorriente.create({ data: { clienteId, saldo: 0, limiteCredito: 0 } });

    const saldoActual = Number(cuenta.saldo);
    const limite = Number(cuenta.limiteCredito);
    if (limite <= 0) return { success: false, error: "La cuenta no tiene crédito habilitado" };
    if (saldoActual + monto > limite) {
      return { success: false, error: `El cargo supera el límite disponible de $${Math.max(0, limite - saldoActual).toFixed(2)}` };
    }

    await prisma.$transaction([
      prisma.cuentaCorriente.update({ where: { id: cuenta.id }, data: { saldo: { increment: monto } } }),
      prisma.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "cargo",
          monto,
          concepto: concepto.trim() || "Cargo a cuenta corriente",
          usuarioAdminId: context.userId,
        },
      }),
    ]);

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch {
    return { success: false, error: "Error registrando el cargo" };
  }
}

export async function getMovimientosCuenta(clienteId: number) {
  try {
    const { memberScope } = await accountContext();
    const cuenta = await prisma.cuentaCorriente.findFirst({ where: { clienteId, cliente: memberScope } });
    if (!cuenta) return { success: true, data: [] };

    const movimientos = await prisma.cuentaMovimiento.findMany({
      where: { cuentaId: cuenta.id },
      include: { usuarioAdmin: true },
      orderBy: { fecha: "desc" },
    });

    return {
      success: true,
      data: serializeData(movimientos.map((movimiento) => ({
        ...movimiento,
        monto: Number(movimiento.monto),
        usuario: movimiento.usuarioAdmin ? movimiento.usuarioAdmin.name : "Sistema",
      }))),
    };
  } catch {
    return { success: false, error: "Error obteniendo historial" };
  }
}

export async function setLimiteCredito(clienteId: number, limite: number) {
  try {
    if (!Number.isFinite(limite) || limite < 0) return { success: false, error: "Ingresá un límite válido" };
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const member = await prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!member) return { success: false, error: "Socio no encontrado" };

    const cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId: member.id } });
    if (!cuenta) {
      await prisma.cuentaCorriente.create({ data: { clienteId, saldo: 0, limiteCredito: limite } });
    } else {
      const saldoActual = Number(cuenta.saldo);
      if (limite < saldoActual) return { success: false, error: `El límite no puede quedar por debajo de la deuda actual de $${saldoActual.toFixed(2)}` };
      await prisma.cuentaCorriente.update({ where: { id: cuenta.id }, data: { limiteCredito: limite } });
    }

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch {
    return { success: false, error: "Error estableciendo el límite" };
  }
}
