"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";

export async function getDashboardStats(sucursalId?: number) {
  try {
    const context = await requireStaffContext(sucursalId ? { branchId: sucursalId } : {});
    const tenantId = context.tenantId;
    const branch = context.branchId ? { sucursalId: context.branchId } : {};
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const sieteDias = new Date(hoy);
    sieteDias.setDate(sieteDias.getDate() + 7);

    // Total clientes activos
    const totalClientes = await prisma.cliente.count({
      where: { tenantId, estado: "activo" }
    });

    // Clientes al día (con pago vigente)
    const clientesAlDia = await prisma.cliente.count({
      where: {
        tenantId,
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
        tenantId,
        fechaHora: { gte: hoy },
        estado: { in: ["permitido", "ACTIVO"] },
        ...branch
      }
    });

    // Personas activas adentro en tiempo real
    const personasAdentro = await prisma.ingreso.count({
      where: {
        tenantId,
        fechaHora: { gte: hoy },
        estado: { in: ["permitido", "ACTIVO"] },
        horaSalida: null,
        ...branch
      }
    });

    // Ventas de hoy (pagos de membresías)
    const ventasHoyResult = await prisma.pago.aggregate({
      _sum: { monto: true },
      _count: true,
      where: {
        tenantId,
        fechaPago: { gte: hoy },
        ...branch
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
        tenantId,
        fechaVenta: { gte: hoy },
        ...branch
      }
    });

    const ventasProductosHoy = ventasProductosResult._sum.total
      ? Number(ventasProductosResult._sum.total)
      : 0;

    // Recaudación del mes (membresías + cantina)
    const pagosMesResult = await prisma.pago.aggregate({
      _sum: { monto: true },
      where: {
        tenantId,
        fechaPago: { gte: primerDiaMes },
        ...branch
      }
    });
    const ventasMesResult = await prisma.venta.aggregate({
      _sum: { total: true },
      where: {
        tenantId,
        fechaVenta: { gte: primerDiaMes },
        ...branch
      }
    });

    const ingresosMes = (Number(pagosMesResult._sum.monto) || 0) + (Number(ventasMesResult._sum.total) || 0);

    // Total de deuda acumulada en Cuentas Corrientes
    const cuentasResult = await prisma.cuentaCorriente.aggregate({
      _sum: { saldo: true },
      where: { cliente: { tenantId } },
    });
    const totalDeuda = Number(cuentasResult._sum.saldo) || 0;

    // Productos bajo stock
    const productosBajoStock = await prisma.producto.count({
      where: {
        tenantId,
        stock: { lte: 5 },
        estado: "activo"
      }
    });

    // Membresías a vencer en 7 días
    const membresiasVencer = await prisma.cliente.count({
      where: {
        tenantId,
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
        tenantId,
        ...branch
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
        tenantId,
        fechaHora: { gte: hoy },
        ...branch
      },
      include: { cliente: true },
      orderBy: { fechaHora: "desc" },
      take: 5
    });

    // Clases y reservas de hoy
    const finHoy = new Date(hoy);
    finHoy.setDate(finHoy.getDate() + 1);

    const clasesHoy = await prisma.clase.findMany({
      where: {
        tenantId,
        inicio: { gte: hoy, lt: finHoy },
        estado: "programada",
        ...branch,
      },
      include: {
        tipoClase: true,
        entrenador: { include: { user: { select: { name: true } } } },
        sucursal: true,
        _count: { select: { reservas: { where: { estado: { in: ["confirmada", "asistio"] } } } } },
      },
      orderBy: { inicio: "asc" },
    });

    // Conteo de socios en riesgo (7+ días inactivos con membresía activa)
    const hace7dias = new Date(hoy.getTime() - 7 * 86400000);
    const hace14dias = new Date(hoy.getTime() - 14 * 86400000);

    const sociosInactivos7d = await prisma.cliente.count({
      where: {
        tenantId,
        estado: "activo",
        OR: [{ ingresos: { none: {} } }, { ingresos: { none: { fechaHora: { gte: hace7dias } } } }],
      },
    });

    const sociosInactivos14d = await prisma.cliente.count({
      where: {
        tenantId,
        estado: "activo",
        OR: [{ ingresos: { none: {} } }, { ingresos: { none: { fechaHora: { gte: hace14dias } } } }],
      },
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
        sociosInactivos7d,
        sociosInactivos14d,
        clasesHoy: clasesHoy.map((c: any) => ({
          id: c.id,
          nombre: c.tipoClase?.nombre || "Clase",
          inicio: c.inicio.toISOString(),
          duracionMinutos: c.duracionMinutos,
          cupoMaximo: c.cupoMaximo,
          reservados: c._count?.reservas || 0,
          sucursalNombre: c.sucursal?.nombre || "Sede",
          profesor: c.entrenador?.user?.name || "Equipo OnlyGym",
        })),
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
