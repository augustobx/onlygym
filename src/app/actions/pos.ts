"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

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
  tipoPago: "efectivo" | "cuenta_corriente" | "tarjeta" | "transferencia";
  metodoPago?: string;
  notas?: string;
  userId?: string;
}

/**
 * Obtiene los productos activos para el catálogo del POS con stock disponible
 */
export async function getProductosPOS(sucursalId?: number, categoria?: string, buscar?: string) {
  try {
    const context = await requireStaffContext(sucursalId ? { branchId: sucursalId } : {});
    await requireTenantModule(context.tenantId, "caja");
    const where: any = { tenantId: context.tenantId, estado: "activo" };
    
    if (categoria && categoria !== "todas") {
      where.categoria = categoria;
    }
    
    if (buscar && buscar.trim() !== "") {
      const q = buscar.trim();
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { codigo: { contains: q, mode: "insensitive" } },
        { categoria: { contains: q, mode: "insensitive" } },
      ];
    }

    const productos = await prisma.producto.findMany({
      where,
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    });

    // Obtener todas las categorías únicas disponibles
    const categoriasDb = await prisma.producto.findMany({
      where: { tenantId: context.tenantId, estado: "activo", categoria: { not: null } },
      select: { categoria: true },
      distinct: ["categoria"],
    });
    const categorias = categoriasDb
      .map(c => c.categoria)
      .filter((c): c is string => Boolean(c));

    return {
      success: true,
      data: serializeData({
        productos: productos.map(p => ({
          ...p,
          precio: Number(p.precio),
        })),
        categorias,
      }),
    };
  } catch (error) {
    console.error("Error al obtener productos POS:", error);
    return { success: false, error: "Error al cargar productos para la venta" };
  }
}

/**
 * Búsqueda de clientes rápida para asociar a la venta o para fiar en cuenta corriente
 */
export async function searchClientesPOS(query: string) {
  try {
    const context = await requireStaffContext();
    if (!query || query.trim().length < 1) {
      return { success: true, data: [] };
    }

    const q = query.trim();
    const clientes = await prisma.cliente.findMany({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        OR: [
          { documento: { contains: q, mode: "insensitive" } },
          { nombre: { contains: q, mode: "insensitive" } },
          { apellido: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        cuentaCorriente: true,
      },
      take: 8,
    });

    return {
      success: true,
      data: serializeData(
        clientes.map(c => ({
          id: c.id,
          documento: c.documento,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono,
          email: c.email,
          saldoCuenta: c.cuentaCorriente ? Number(c.cuentaCorriente.saldo) : 0,
          limiteCredito: c.cuentaCorriente ? Number(c.cuentaCorriente.limiteCredito) : 5000,
          disponibleCredito: c.cuentaCorriente
            ? Number(c.cuentaCorriente.limiteCredito) - Number(c.cuentaCorriente.saldo)
            : 5000,
        }))
      ),
    };
  } catch (error) {
    console.error("Error buscando clientes POS:", error);
    return { success: false, error: "Error buscando clientes" };
  }
}

/**
 * Procesa la venta de productos en la cantina/kiosco
 */
export async function procesarVentaPOS(data: ProcesarVentaInput) {
  try {
    const { items, clienteId, sucursalId, tipoPago, metodoPago, notas, userId } = data;
    const context = await requireStaffContext({ branchId: sucursalId });
    await requireTenantModule(context.tenantId, "caja");

    if (!items || items.length === 0) {
      return { success: false, error: "El carrito de compras está vacío" };
    }

    if (tipoPago === "cuenta_corriente" && !clienteId) {
      return { success: false, error: "Debe seleccionar un socio para realizar una venta a Cuenta Corriente" };
    }

    // 1. Validar stock de cada producto en base de datos
    const productoIds = items.map(i => i.productoId);
    const productosEnDb = await prisma.producto.findMany({
      where: { tenantId: context.tenantId, id: { in: productoIds }, estado: "activo" },
    });

    const productoMap = new Map(productosEnDb.map(p => [p.id, p]));

    for (const item of items) {
      const prod = productoMap.get(item.productoId);
      if (!prod) {
        return { success: false, error: `El producto con ID ${item.productoId} no existe` };
      }
      if (prod.stock < item.cantidad) {
        return {
          success: false,
          error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}, solicitado: ${item.cantidad}`,
        };
      }
    }

    // 2. Calcular total de la venta
    const total = items.reduce((sum, item) => sum + Number(productoMap.get(item.productoId)!.precio) * item.cantidad, 0);

    // 3. Validar límite de crédito si es cuenta corriente
    let cuentaClienteId: number | null = null;
    if (tipoPago === "cuenta_corriente" && clienteId) {
      const member = await prisma.cliente.findFirst({ where: { id: clienteId, tenantId: context.tenantId }, select: { id: true } });
      if (!member) return { success: false, error: "Socio no encontrado" };
      let cuenta = await prisma.cuentaCorriente.findUnique({ where: { clienteId: member.id } });

      if (!cuenta) {
        cuenta = await prisma.cuentaCorriente.create({
          data: {
            clienteId,
            saldo: 0,
            limiteCredito: 5000,
          },
        });
      }

      cuentaClienteId = cuenta.id;
      const nuevoSaldo = Number(cuenta.saldo) + total;
      const limite = Number(cuenta.limiteCredito);

      if (nuevoSaldo > limite) {
        return {
          success: false,
          error: `Límite de crédito excedido. Saldo actual: $${Number(cuenta.saldo).toFixed(2)}, Monto compra: $${total.toFixed(2)}, Límite: $${limite.toFixed(2)} (Excedente: $${(nuevoSaldo - limite).toFixed(2)})`,
        };
      }
    }

    // 4. Ejecutar transacción atómica
    const resultado = await prisma.$transaction(async (tx) => {
      // a) Crear la Venta
      const venta = await tx.venta.create({
        data: {
          tenantId: context.tenantId,
          sucursalId,
          clienteId: clienteId || null,
          tipoPago,
          estadoPago: tipoPago === "cuenta_corriente" ? "pendiente" : "pagado",
          metodoPago: metodoPago || tipoPago,
          total,
          userId: context.userId,
          notas: notas || null,
        },
      });

      // b) Crear los items de la venta
      for (const item of items) {
        await tx.ventaItem.create({
          data: {
            ventaId: venta.id,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: productoMap.get(item.productoId)!.precio,
            subtotal: Number(productoMap.get(item.productoId)!.precio) * item.cantidad,
          },
        });

        // c) Descontar stock
        const stockUpdate = await tx.producto.updateMany({
          where: { id: item.productoId, tenantId: context.tenantId, stock: { gte: item.cantidad } },
          data: {
            stock: {
              decrement: item.cantidad,
            },
          },
        });
        if (!stockUpdate.count) throw new Error("Stock modificado durante la venta");
      }

      // d) Si es cuenta corriente, actualizar saldo y registrar movimiento
      if (tipoPago === "cuenta_corriente" && clienteId && cuentaClienteId) {
        await tx.cuentaCorriente.update({
          where: { id: cuentaClienteId },
          data: {
            saldo: {
              increment: total,
            },
          },
        });

        await tx.cuentaMovimiento.create({
          data: {
            cuentaId: cuentaClienteId,
            tipo: "cargo",
            monto: total,
            concepto: `Compra en cantina - Ticket #${venta.id}`,
            usuarioAdminId: context.userId,
          },
        });
      }

      // e) Obtener venta completa con relaciones para el ticket
      return await tx.venta.findUnique({
        where: { id: venta.id },
        include: {
          cliente: true,
          user: true,
          items: {
            include: {
              producto: true,
            },
          },
          sucursal: true,
        },
      });
    });

    // 5. Revalidar rutas
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
        cliente: resultado!.cliente
          ? `${resultado!.cliente.nombre} ${resultado!.cliente.apellido}`
          : "Consumidor Final",
        documento: resultado!.cliente?.documento,
        vendedor: resultado!.user?.name || "Cajero",
        sucursal: resultado!.sucursal?.nombre || "Sede Principal",
        items: resultado!.items.map(i => ({
          id: i.id,
          nombre: i.producto.nombre,
          codigo: i.producto.codigo,
          cantidad: i.cantidad,
          precioUnitario: Number(i.precioUnitario),
          subtotal: Number(i.subtotal),
        })),
      }),
    };
  } catch (error) {
    console.error("Error al procesar venta POS:", error);
    return { success: false, error: "Error interno al procesar la venta" };
  }
}

/**
 * Obtiene el historial detallado de ventas del POS con filtros y resumen de caja
 */
export async function getHistorialVentasPOS(params: {
  desde?: string;
  hasta?: string;
  sucursalId?: number;
  tipoPago?: string;
}) {
  try {
    const { desde, hasta, sucursalId, tipoPago } = params;
    const context = await requireStaffContext(sucursalId ? { branchId: sucursalId } : {});
    const where: any = { tenantId: context.tenantId };

    if (desde || hasta) {
      where.fechaVenta = {};
      if (desde) {
        const d = new Date(desde);
        d.setHours(0, 0, 0, 0);
        where.fechaVenta.gte = d;
      }
      if (hasta) {
        const h = new Date(hasta);
        h.setHours(23, 59, 59, 999);
        where.fechaVenta.lte = h;
      }
    }

    if (sucursalId) {
      where.sucursalId = sucursalId;
    }

    if (tipoPago && tipoPago !== "todos") {
      where.tipoPago = tipoPago;
    }

    const ventas = await prisma.venta.findMany({
      where,
      include: {
        cliente: true,
        user: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { fechaVenta: "desc" },
    });

    let totalEfectivo = 0;
    let totalCuentaCorriente = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalGeneral = 0;
    let totalArticulos = 0;

    const ventasMapeadas = ventas.map(v => {
      const monto = Number(v.total);
      totalGeneral += monto;

      if (v.tipoPago === "efectivo") totalEfectivo += monto;
      else if (v.tipoPago === "cuenta_corriente") totalCuentaCorriente += monto;
      else if (v.tipoPago === "tarjeta") totalTarjeta += monto;
      else if (v.tipoPago === "transferencia") totalTransferencia += monto;

      const itemsCount = v.items.reduce((acc, it) => acc + it.cantidad, 0);
      totalArticulos += itemsCount;

      return {
        id: v.id,
        fechaVenta: v.fechaVenta.toISOString(),
        total: monto,
        tipoPago: v.tipoPago,
        estadoPago: v.estadoPago,
        metodoPago: v.metodoPago,
        notas: v.notas,
        cliente: v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : "Consumidor Final",
        documentoCliente: v.cliente?.documento || null,
        clienteId: v.clienteId,
        vendedor: v.user?.name || "Sistema",
        articulosCantidad: itemsCount,
        items: v.items.map(it => ({
          id: it.id,
          nombre: it.producto.nombre,
          codigo: it.producto.codigo,
          cantidad: it.cantidad,
          precioUnitario: Number(it.precioUnitario),
          subtotal: Number(it.subtotal),
        })),
      };
    });

    return {
      success: true,
      data: serializeData({
        ventas: ventasMapeadas,
        resumen: {
          totalGeneral,
          totalEfectivo,
          totalCuentaCorriente,
          totalTarjeta,
          totalTransferencia,
          totalVentas: ventas.length,
          totalArticulos,
        },
      }),
    };
  } catch (error) {
    console.error("Error al obtener historial de ventas POS:", error);
    return { success: false, error: "Error al cargar historial de ventas" };
  }
}

/**
 * Obtiene el detalle de un ticket de venta específico
 */
export async function getDetalleVentaPOS(ventaId: number) {
  try {
    const context = await requireStaffContext();
    const venta = await prisma.venta.findFirst({
      where: { id: ventaId, tenantId: context.tenantId },
      include: {
        cliente: true,
        user: true,
        sucursal: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!venta) {
      return { success: false, error: "Venta no encontrada" };
    }

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
          ? {
              id: venta.cliente.id,
              nombre: `${venta.cliente.nombre} ${venta.cliente.apellido}`,
              documento: venta.cliente.documento,
              telefono: venta.cliente.telefono,
            }
          : null,
        vendedor: venta.user?.name || "Cajero",
        sucursal: venta.sucursal?.nombre || "Sede Principal",
        items: venta.items.map(i => ({
          id: i.id,
          nombre: i.producto.nombre,
          codigo: i.producto.codigo,
          categoria: i.producto.categoria,
          cantidad: i.cantidad,
          precioUnitario: Number(i.precioUnitario),
          subtotal: Number(i.subtotal),
        })),
      }),
    };
  } catch (error) {
    console.error("Error obteniendo detalle de venta:", error);
    return { success: false, error: "Error al cargar detalle del ticket" };
  }
}
