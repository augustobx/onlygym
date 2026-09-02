"use server";

import { Prisma, RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { canChargeCurrentAccount, getAvailableCredit } from "@/lib/credit-policy";

const POS_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];
const PAYMENT_TYPES = ["efectivo", "cuenta_corriente", "tarjeta", "transferencia"] as const;

type PaymentType = (typeof PAYMENT_TYPES)[number];

export interface ItemVentaInput {
  productoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ProcesarVentaInput {
  items: ItemVentaInput[];
  clienteId?: number | null;
  sucursalId: number;
  tipoPago: PaymentType;
  metodoPago?: string;
  notas?: string;
  userId?: string;
}

async function requirePosContext(requestedBranchId?: number) {
  const context = await requireStaffContext({ roles: POS_ROLES });
  await requireTenantModule(context.tenantId, "caja");
  const branchId = context.branchId;
  if (!branchId) throw new Error("Seleccioná una sucursal antes de operar la caja");
  if (requestedBranchId && requestedBranchId !== branchId) {
    throw new Error("La sucursal solicitada no coincide con la sede activa");
  }
  return { ...context, branchId };
}

function expectedPosError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message === "NO_CREDIT") return "La cuenta corriente no tiene crédito habilitado";
  if (error.message === "CREDIT_LIMIT") return "La compra supera el crédito disponible del socio";
  if (error.message === "STOCK_CHANGED") return "El stock cambió mientras se procesaba la venta. Revisá el carrito e intentá nuevamente";
  if (error.message === "Seleccioná una sucursal antes de operar la caja" || error.message === "La sucursal solicitada no coincide con la sede activa") return error.message;
  return fallback;
}

export async function getProductosPOS(sucursalId: number, categoria?: string, buscar?: string) {
  try {
    const context = await requirePosContext(sucursalId);
    const where: Prisma.ProductoWhereInput = { tenantId: context.tenantId, estado: "activo" };

    if (categoria && categoria !== "todas") where.categoria = categoria;
    if (buscar?.trim()) {
      const q = buscar.trim();
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { codigo: { contains: q, mode: "insensitive" } },
        { categoria: { contains: q, mode: "insensitive" } },
      ];
    }

    const [productos, categoriasDb] = await Promise.all([
      prisma.producto.findMany({ where, orderBy: [{ categoria: "asc" }, { nombre: "asc" }] }),
      prisma.producto.findMany({
        where: { tenantId: context.tenantId, estado: "activo", categoria: { not: null } },
        select: { categoria: true },
        distinct: ["categoria"],
      }),
    ]);

    return {
      success: true,
      data: serializeData({
        productos: productos.map((producto) => ({ ...producto, precio: Number(producto.precio) })),
        categorias: categoriasDb.map(({ categoria }) => categoria).filter((categoria): categoria is string => Boolean(categoria)),
      }),
    };
  } catch (error) {
    console.error("Error al obtener productos POS:", error);
    return { success: false, error: expectedPosError(error, "Error al cargar productos para la venta") };
  }
}

export async function searchClientesPOS(query: string, sucursalId?: number) {
  try {
    const context = await requirePosContext(sucursalId);
    const q = query.trim();
    if (q.length < 2) return { success: true, data: [] };

    const clientes = await prisma.cliente.findMany({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        sucursales: { some: { id: context.branchId } },
        OR: [
          { documento: { contains: q, mode: "insensitive" } },
          { nombre: { contains: q, mode: "insensitive" } },
          { apellido: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { cuentaCorriente: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      take: 8,
    });

    return {
      success: true,
      data: serializeData(clientes.map((cliente) => {
        const saldo = cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.saldo) : 0;
        const limite = cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.limiteCredito) : 0;
        return {
          id: cliente.id,
          documento: cliente.documento,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          telefono: cliente.telefono,
          email: cliente.email,
          saldoCuenta: saldo,
          limiteCredito: limite,
          disponibleCredito: getAvailableCredit(saldo, limite),
        };
      })),
    };
  } catch (error) {
    console.error("Error buscando clientes POS:", error);
    return { success: false, error: expectedPosError(error, "Error buscando clientes") };
  }
}

export async function procesarVentaPOS(data: ProcesarVentaInput) {
  try {
    const { items, clienteId, sucursalId, tipoPago, metodoPago, notas } = data;
    const context = await requirePosContext(sucursalId);

    if (!Array.isArray(items) || items.length === 0) return { success: false, error: "El carrito de compras está vacío" };
    if (!PAYMENT_TYPES.includes(tipoPago as PaymentType)) return { success: false, error: "Método de pago no válido" };
    if (tipoPago === "cuenta_corriente" && !clienteId) return { success: false, error: "Seleccioná un socio para vender a cuenta corriente" };

    const productIds = items.map((item) => item.productoId);
    if (productIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(productIds).size !== productIds.length) {
      return { success: false, error: "El carrito contiene productos inválidos" };
    }
    if (items.some((item) => !Number.isInteger(item.cantidad) || item.cantidad <= 0)) {
      return { success: false, error: "Las cantidades del carrito deben ser enteros positivos" };
    }

    const productosEnDb = await prisma.producto.findMany({
      where: { tenantId: context.tenantId, id: { in: productIds }, estado: "activo" },
    });
    const productoMap = new Map(productosEnDb.map((producto) => [producto.id, producto]));
    if (productoMap.size !== productIds.length) return { success: false, error: "Uno o más productos ya no están disponibles" };

    for (const item of items) {
      const producto = productoMap.get(item.productoId)!;
      if (producto.stock < item.cantidad) {
        return { success: false, error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}` };
      }
    }

    const total = items.reduce((sum, item) => sum + Number(productoMap.get(item.productoId)!.precio) * item.cantidad, 0);
    if (!Number.isFinite(total) || total <= 0) return { success: false, error: "El total de la venta no es válido" };

    let memberId: number | null = null;
    if (clienteId) {
      const member = await prisma.cliente.findFirst({
        where: {
          id: clienteId,
          tenantId: context.tenantId,
          estado: "activo",
          sucursales: { some: { id: context.branchId } },
        },
        select: { id: true },
      });
      if (!member) return { success: false, error: "El socio no pertenece a la sede activa" };
      memberId = member.id;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      let accountId: number | null = null;
      if (tipoPago === "cuenta_corriente" && memberId) {
        const account = await tx.cuentaCorriente.findUnique({ where: { clienteId: memberId } });
        if (!account || Number(account.limiteCredito) <= 0) throw new Error("NO_CREDIT");
        if (!canChargeCurrentAccount(Number(account.saldo), Number(account.limiteCredito), total)) throw new Error("CREDIT_LIMIT");
        accountId = account.id;
      }

      const venta = await tx.venta.create({
        data: {
          tenantId: context.tenantId,
          sucursalId: context.branchId,
          clienteId: memberId,
          tipoPago,
          estadoPago: tipoPago === "cuenta_corriente" ? "pendiente" : "pagado",
          metodoPago: metodoPago?.trim() || tipoPago,
          total,
          userId: context.userId,
          notas: notas?.trim() || null,
        },
      });

      for (const item of items) {
        const producto = productoMap.get(item.productoId)!;
        await tx.ventaItem.create({
          data: {
            ventaId: venta.id,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: producto.precio,
            subtotal: Number(producto.precio) * item.cantidad,
          },
        });

        const stockUpdate = await tx.producto.updateMany({
          where: { id: item.productoId, tenantId: context.tenantId, stock: { gte: item.cantidad } },
          data: { stock: { decrement: item.cantidad } },
        });
        if (!stockUpdate.count) throw new Error("STOCK_CHANGED");
      }

      if (tipoPago === "cuenta_corriente" && memberId && accountId) {
        await tx.cuentaCorriente.update({ where: { id: accountId }, data: { saldo: { increment: total } } });
        await tx.cuentaMovimiento.create({
          data: {
            cuentaId: accountId,
            tipo: "cargo",
            monto: total,
            concepto: `Compra en tienda - Ticket #${venta.id}`,
            usuarioAdminId: context.userId,
          },
        });
      }

      return tx.venta.findUnique({
        where: { id: venta.id },
        include: { cliente: true, user: true, items: { include: { producto: true } }, sucursal: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/dashboard/caja");
    revalidatePath("/dashboard/caja/movimientos");
    revalidatePath("/dashboard/productos");
    revalidatePath("/dashboard/cuentas");
    revalidatePath("/dashboard/reportes");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: serializeData({
        id: resultado!.id,
        total: Number(resultado!.total),
        tipoPago: resultado!.tipoPago,
        estadoPago: resultado!.estadoPago,
        fechaVenta: resultado!.fechaVenta.toISOString(),
        cliente: resultado!.cliente ? `${resultado!.cliente.nombre} ${resultado!.cliente.apellido}` : "Consumidor Final",
        documento: resultado!.cliente?.documento,
        vendedor: resultado!.user?.name || "Cajero",
        sucursal: resultado!.sucursal?.nombre || "Sucursal activa",
        items: resultado!.items.map((item) => ({
          id: item.id,
          nombre: item.producto.nombre,
          codigo: item.producto.codigo,
          cantidad: item.cantidad,
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
        })),
      }),
    };
  } catch (error) {
    console.error("Error al procesar venta POS:", error);
    return { success: false, error: expectedPosError(error, "Error interno al procesar la venta") };
  }
}

export async function getHistorialVentasPOS(params: {
  desde?: string;
  hasta?: string;
  sucursalId?: number;
  tipoPago?: string;
}) {
  try {
    const { desde, hasta, sucursalId, tipoPago } = params;
    const context = await requirePosContext(sucursalId);
    const where: Prisma.VentaWhereInput = { tenantId: context.tenantId, sucursalId: context.branchId };

    if (desde || hasta) {
      where.fechaVenta = {};
      if (desde) {
        const start = new Date(desde);
        start.setHours(0, 0, 0, 0);
        where.fechaVenta.gte = start;
      }
      if (hasta) {
        const end = new Date(hasta);
        end.setHours(23, 59, 59, 999);
        where.fechaVenta.lte = end;
      }
    }
    if (tipoPago && tipoPago !== "todos") where.tipoPago = tipoPago;

    const ventas = await prisma.venta.findMany({
      where,
      include: { cliente: true, user: true, items: { include: { producto: true } } },
      orderBy: { fechaVenta: "desc" },
      take: 1000,
    });

    let totalEfectivo = 0;
    let totalCuentaCorriente = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalGeneral = 0;
    let totalArticulos = 0;

    const ventasMapeadas = ventas.map((venta) => {
      const monto = Number(venta.total);
      totalGeneral += monto;
      if (venta.tipoPago === "efectivo") totalEfectivo += monto;
      else if (venta.tipoPago === "cuenta_corriente") totalCuentaCorriente += monto;
      else if (venta.tipoPago === "tarjeta") totalTarjeta += monto;
      else if (venta.tipoPago === "transferencia") totalTransferencia += monto;
      const itemsCount = venta.items.reduce((acc, item) => acc + item.cantidad, 0);
      totalArticulos += itemsCount;

      return {
        id: venta.id,
        fechaVenta: venta.fechaVenta.toISOString(),
        total: monto,
        tipoPago: venta.tipoPago,
        estadoPago: venta.estadoPago,
        metodoPago: venta.metodoPago,
        notas: venta.notas,
        cliente: venta.cliente ? `${venta.cliente.nombre} ${venta.cliente.apellido}` : "Consumidor Final",
        documentoCliente: venta.cliente?.documento || null,
        clienteId: venta.clienteId,
        vendedor: venta.user?.name || "Sistema",
        articulosCantidad: itemsCount,
        items: venta.items.map((item) => ({
          id: item.id,
          nombre: item.producto.nombre,
          codigo: item.producto.codigo,
          cantidad: item.cantidad,
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
        })),
      };
    });

    return {
      success: true,
      data: serializeData({
        ventas: ventasMapeadas,
        resumen: { totalGeneral, totalEfectivo, totalCuentaCorriente, totalTarjeta, totalTransferencia, totalVentas: ventas.length, totalArticulos },
      }),
    };
  } catch (error) {
    console.error("Error al obtener historial de ventas POS:", error);
    return { success: false, error: expectedPosError(error, "Error al cargar historial de ventas") };
  }
}

export async function getDetalleVentaPOS(ventaId: number) {
  try {
    const context = await requirePosContext();
    const venta = await prisma.venta.findFirst({
      where: { id: ventaId, tenantId: context.tenantId, sucursalId: context.branchId },
      include: { cliente: true, user: true, sucursal: true, items: { include: { producto: true } } },
    });
    if (!venta) return { success: false, error: "Venta no encontrada en la sede activa" };

    return {
      success: true,
      data: serializeData({
        id: venta.id,
        fechaVenta: venta.fechaVenta.toISOString(),
        total: Number(venta.total),
        tipoPago: venta.tipoPago,
        estadoPago: venta.estadoPago,
        metodoPago: venta.metodoPago,
        notas: venta.notas,
        cliente: venta.cliente
          ? { id: venta.cliente.id, nombre: `${venta.cliente.nombre} ${venta.cliente.apellido}`, documento: venta.cliente.documento, telefono: venta.cliente.telefono }
          : null,
        vendedor: venta.user?.name || "Cajero",
        sucursal: venta.sucursal?.nombre || "Sucursal activa",
        items: venta.items.map((item) => ({
          id: item.id,
          nombre: item.producto.nombre,
          codigo: item.producto.codigo,
          categoria: item.producto.categoria,
          cantidad: item.cantidad,
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
        })),
      }),
    };
  } catch (error) {
    console.error("Error obteniendo detalle de venta:", error);
    return { success: false, error: expectedPosError(error, "Error al cargar detalle del ticket") };
  }
}
