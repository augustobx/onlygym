"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";

export async function getDashboardStats(sucursalId?: number) {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const sieteDias = new Date(hoy);
    sieteDias.setDate(sieteDias.getDate() + 7);

    // Total clientes activos
    const totalClientes = await prisma.cliente.count({
      where: { estado: "activo" }
    });

    // Clientes al día (con pago vigente)
    const clientesAlDia = await prisma.cliente.count({
      where: {
        estado: "activo",
        pagos: {
          some: {
            fechaVencimiento: { gte: hoy },
            estado: "pagado"
          }
        }
      }
    });

    // Ingresos hoy (accesos al gym)
    const ingresosHoy = await prisma.ingreso.count({
      where: {
        fechaHora: { gte: hoy },
        estado: { in: ["permitido", "ACTIVO"] },
        ...(sucursalId ? { sucursalId } : {})
      }
    });

    // Personas activas adentro en tiempo real
    const personasAdentro = await prisma.ingreso.count({
      where: {
        fechaHora: { gte: hoy },
        estado: { in: ["permitido", "ACTIVO"] },
        horaSalida: null,
        ...(sucursalId ? { sucursalId } : {})
      }
    });

    // Ventas de hoy (pagos de membresías)
    const ventasHoyResult = await prisma.pago.aggregate({
      _sum: { monto: true },
      _count: true,
      where: {
        fechaPago: { gte: hoy },
        ...(sucursalId ? { sucursalId } : {})
      }
    });

    const ventasHoy = ventasHoyResult._sum.monto
      ? Number(ventasHoyResult._sum.monto)
      : 0;
    const totalPagosHoy = ventasHoyResult._count;

    // Ventas de productos hoy
    const ventasProductosResult = await prisma.venta.aggregate({
      _sum: { total: true },
      _count: true,
      where: {
        fechaVenta: { gte: hoy },
        ...(sucursalId ? { sucursalId } : {})
      }
    });

    const ventasProductosHoy = ventasProductosResult._sum.total
      ? Number(ventasProductosResult._sum.total)
      : 0;

    // Recaudación del mes (membresías + cantina)
    const pagosMesResult = await prisma.pago.aggregate({
      _sum: { monto: true },
      where: {
        fechaPago: { gte: primerDiaMes },
        ...(sucursalId ? { sucursalId } : {})
      }
    });
    const ventasMesResult = await prisma.venta.aggregate({
      _sum: { total: true },
      where: {
        fechaVenta: { gte: primerDiaMes },
        ...(sucursalId ? { sucursalId } : {})
      }
    });

    const ingresosMes = (Number(pagosMesResult._sum.monto) || 0) + (Number(ventasMesResult._sum.total) || 0);

    // Total de deuda acumulada en Cuentas Corrientes
    const cuentasResult = await prisma.cuentaCorriente.aggregate({
      _sum: { saldo: true },
    });
    const totalDeuda = Number(cuentasResult._sum.saldo) || 0;

    // Productos bajo stock
    const productosBajoStock = await prisma.producto.count({
      where: {
        estado: "activo",
        stock: { lte: prisma.producto.fields.stockMinimo }
      }
    }).catch(() => {
      return prisma.producto.count({
        where: {
          estado: "activo",
          stock: { lte: 5 }
        }
      });
    });

    // Membresías por vencer en 7 días
    const membresiasVencer = await prisma.cliente.count({
      where: {
        estado: "activo",
        pagos: {
          some: {
            fechaVencimiento: { gte: hoy, lte: sieteDias },
            estado: "pagado"
          }
        }
      }
    });

    // Últimos 5 pagos
    const ultimosPagos = await prisma.pago.findMany({
      where: {
        ...(sucursalId ? { sucursalId } : {})
      },
      include: {
        cliente: true,
        membresia: true
      },
      orderBy: { fechaPago: "desc" },
      take: 5
    });

    // Últimos 5 ingresos hoy
    const ultimosIngresos = await prisma.ingreso.findMany({
      where: {
        fechaHora: { gte: hoy },
        ...(sucursalId ? { sucursalId } : {})
      },
      include: { cliente: true },
      orderBy: { fechaHora: "desc" },
      take: 5
    });

    return {
      success: true,
      data: serializeData({
        totalClientes,
        sociosActivos: totalClientes,
        clientesAlDia,
        sociosAlDia: clientesAlDia,
        sociosVencidos: Math.max(0, totalClientes - clientesAlDia),
        ingresosHoy,
        asistenciasHoy: ingresosHoy,
        personasAdentro,
        ventasHoy,
        totalPagosHoy,
        ventasProductosHoy,
        ingresosMes,
        totalDeuda,
        productosBajoStock,
        membresiasVencer,
        totalRecaudacionHoy: ventasHoy + ventasProductosHoy,
        ultimosPagos: ultimosPagos.map(p => ({
          id: p.id,
          cliente: p.cliente ? { nombre: p.cliente.nombre, apellido: p.cliente.apellido } : null,
          clienteNombre: p.cliente ? `${p.cliente.nombre} ${p.cliente.apellido}` : "Socio",
          membresia: p.membresia ? { nombre: p.membresia.nombre } : null,
          monto: Number(p.monto),
          fechaPago: p.fechaPago.toISOString()
        })),
        ultimosIngresos: ultimosIngresos.map(i => ({
          id: i.id,
          cliente: i.cliente ? { nombre: i.cliente.nombre, apellido: i.cliente.apellido } : null,
          clienteNombre: i.cliente ? `${i.cliente.nombre} ${i.cliente.apellido}` : "Socio",
          documento: i.documento,
          estado: i.estado,
          fechaHora: i.fechaHora.toISOString()
        }))
      })
    };
  } catch (error) {
    console.error("Error dashboard stats:", error);
    return { success: false, error: "Error obteniendo estadísticas" };
  }
}
