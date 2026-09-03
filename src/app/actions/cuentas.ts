"use server";

import { Prisma, RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { getStaffMemberScope } from "@/lib/staff-member-access";
import { requireStaffContext } from "@/lib/tenant-context";
import { canChargeCurrentAccount } from "@/lib/credit-policy";
import { writeAudit } from "@/lib/audit";

const ACCOUNT_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];

function validAmount(value: number) {
  return Number.isFinite(value) && value > 0;
}

function expectedAccountError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message === "NO_DEBT") return "La cuenta no tiene deuda pendiente";
  if (error.message === "PAYMENT_EXCEEDS_DEBT") return "El abono supera la deuda disponible. Actualizá la cuenta e intentá nuevamente";
  if (error.message === "NO_CREDIT") return "La cuenta no tiene crédito habilitado";
  if (error.message === "CREDIT_LIMIT") return "El cargo supera el crédito disponible. Actualizá la cuenta e intentá nuevamente";
  if (error.message === "ACCOUNT_CHANGED") return "La cuenta cambió mientras se procesaba la operación. Intentá nuevamente";
  return fallback;
}

function revalidateAccountPaths(clienteId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cuentas");
  revalidatePath("/dashboard/clientes");
  if (clienteId) revalidatePath(`/dashboard/clientes/${clienteId}`);
  revalidatePath("/portal/dashboard");
  revalidatePath("/portal/cuenta");
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

    const result = await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaCorriente.findFirst({ where: { clienteId, cliente: memberScope } });
      if (!cuenta) throw new Error("ACCOUNT_CHANGED");

      const saldoActual = Number(cuenta.saldo);
      if (saldoActual <= 0) throw new Error("NO_DEBT");
      if (monto > saldoActual) throw new Error("PAYMENT_EXCEEDS_DEBT");

      const updated = await tx.cuentaCorriente.updateMany({
        where: { id: cuenta.id, saldo: { gte: monto } },
        data: { saldo: { decrement: monto } },
      });
      if (!updated.count) throw new Error("ACCOUNT_CHANGED");

      const movimiento = await tx.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "pago",
          monto,
          concepto: concepto.trim() || "Abono a cuenta corriente",
          usuarioAdminId: context.userId,
        },
      });
      return { cuentaId: cuenta.id, movimientoId: movimiento.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "cuenta_corriente.abono",
      entidad: "CuentaCorriente",
      entidadId: result.cuentaId,
      metadata: { clienteId, movimientoId: result.movimientoId, monto },
    });

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch (error) {
    return { success: false, error: expectedAccountError(error, "Error registrando el abono") };
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

    const result = await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaCorriente.upsert({
        where: { clienteId: member.id },
        update: {},
        create: { clienteId: member.id, saldo: 0, limiteCredito: 0 },
      });

      const saldoActual = Number(cuenta.saldo);
      const limite = Number(cuenta.limiteCredito);
      if (limite <= 0) throw new Error("NO_CREDIT");
      if (!canChargeCurrentAccount(saldoActual, limite, monto)) throw new Error("CREDIT_LIMIT");

      const updated = await tx.cuentaCorriente.updateMany({
        where: { id: cuenta.id, saldo: { lte: limite - monto } },
        data: { saldo: { increment: monto } },
      });
      if (!updated.count) throw new Error("ACCOUNT_CHANGED");

      const movimiento = await tx.cuentaMovimiento.create({
        data: {
          cuentaId: cuenta.id,
          tipo: "cargo",
          monto,
          concepto: concepto.trim() || "Cargo a cuenta corriente",
          usuarioAdminId: context.userId,
        },
      });
      return { cuentaId: cuenta.id, movimientoId: movimiento.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "cuenta_corriente.cargo",
      entidad: "CuentaCorriente",
      entidadId: result.cuentaId,
      metadata: { clienteId, movimientoId: result.movimientoId, monto },
    });

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch (error) {
    return { success: false, error: expectedAccountError(error, "Error registrando el cargo") };
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

    const accountId = await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaCorriente.upsert({
        where: { clienteId: member.id },
        update: {},
        create: { clienteId, saldo: 0, limiteCredito: 0 },
      });
      const saldoActual = Number(cuenta.saldo);
      if (limite < saldoActual) {
        throw new Error(`El límite no puede quedar por debajo de la deuda actual de $${saldoActual.toFixed(2)}`);
      }
      await tx.cuentaCorriente.update({ where: { id: cuenta.id }, data: { limiteCredito: limite } });
      return cuenta.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "cuenta_corriente.limite_actualizar",
      entidad: "CuentaCorriente",
      entidadId: accountId,
      metadata: { clienteId, limite },
    });

    revalidateAccountPaths(clienteId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error estableciendo el límite" };
  }
}
