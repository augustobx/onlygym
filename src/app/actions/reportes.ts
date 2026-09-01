"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

export async function getReportes(desde: string, hasta: string, sucursalId?: number) {
  try {
    const context = await requireStaffContext(sucursalId ? { branchId: sucursalId } : {});
    await requireTenantModule(context.tenantId, "reportes");
    const fechaDesde = new Date(desde);
    fechaDesde.setHours(0, 0, 0, 0);
    const fechaHasta = new Date(hasta);
    fechaHasta.setHours(23, 59, 59, 999);

    const whereDate = { gte: fechaDesde, lte: fechaHasta };
    const whereSucursal = sucursalId ? { sucursalId: context.branchId } : {};

    // 1. Estadísticas Globales de Clientes
    const totalClientes = await prisma.cliente.count({ where: { tenantId: context.tenantId, estado: "activo" } });
    const clientesActivos = await prisma.cliente.count({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        pagos: {
          some: {
            fechaVencimiento: { gte: new Date() },
            estado: "pagado",
          },
        },
      },
    });

    // 2. Ingresos por Pagos de Membresía
    const pagoStats = await prisma.pago.aggregate({
      _sum: { monto: true },
      _count: true,
      _avg: { monto: true },
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
    });

    // Desglose de pagos por método
    const pagosPorMetodo = await prisma.pago.groupBy({
      by: ["metodoPago"],
      _sum: { monto: true },
      _count: true,
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
    });

    // 3. Ventas de Productos Kiosco / Cantina
    const ventaStats = await prisma.venta.aggregate({
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
      where: { tenantId: context.tenantId, fechaVenta: whereDate, ...whereSucursal },
    });

    // Desglose de ventas kiosco por tipo de pago
    const ventasPorTipoPago = await prisma.venta.groupBy({
      by: ["tipoPago"],
      _sum: { total: true },
      _count: true,
      where: { tenantId: context.tenantId, fechaVenta: whereDate, ...whereSucursal },
    });

    // 4. Ranking Top 10 Productos Más Vendidos
    const topProductosRaw = await prisma.ventaItem.groupBy({
      by: ["productoId"],
      _sum: { cantidad: true, subtotal: true },
      _count: true,
      where: {
        venta: {
          tenantId: context.tenantId,
          fechaVenta: whereDate,
          ...whereSucursal,
        },
      },
      orderBy: { _sum: { cantidad: "desc" } },
      take: 10,
    });

    const productoIds = topProductosRaw.map(p => p.productoId);
    const productos = await prisma.producto.findMany({
      where: { tenantId: context.tenantId, id: { in: productoIds } },
    });
    const productoMap = new Map(productos.map(p => [p.id, p]));

    const topProductos = topProductosRaw.map((item, idx) => {
      const p = productoMap.get(item.productoId);
      return {
        posicion: idx + 1,
        productoId: item.productoId,
        nombre: p?.nombre || "Producto",
        categoria: p?.categoria || "General",
        unidadesVendidas: item._sum.cantidad || 0,
        recaudacionTotal: Number(item._sum.subtotal || 0),
        stockActual: p?.stock || 0,
      };
    });

    // 5. Membresías Más Vendidas
    const membresiasVendidas = await prisma.pago.groupBy({
      by: ["membresiaId"],
      _count: true,
      _sum: { monto: true },
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
      orderBy: { _count: { membresiaId: "desc" } },
      take: 10,
    });

    const membresiaIds = membresiasVendidas.map(m => m.membresiaId);
    const membresias = await prisma.membresia.findMany({
      where: { tenantId: context.tenantId, id: { in: membresiaIds } },
    });
    const membresiaMap = new Map(membresias.map(m => [m.id, m.nombre]));

    // 6. Análisis de Horarios Pico vs Valle (Distribución Horaria)
    const todosIngresos = await prisma.ingreso.findMany({
      where: {
        tenantId: context.tenantId,
        fechaHora: whereDate,
        ...whereSucursal,
      },
      select: {
        fechaHora: true,
        estado: true,
        motivo: true,
        documento: true,
        cliente: { select: { nombre: true, apellido: true } },
      },
    });

    const distribucionHoras: { [hora: number]: number } = {};
    for (let h = 0; h < 24; h++) distribucionHoras[h] = 0;

    let permitidos = 0;
    let denegados = 0;
    const motivosDenegadosCount: { [motivo: string]: number } = {};

    todosIngresos.forEach(ing => {
      const hora = new Date(ing.fechaHora).getHours();
      if (ing.estado === "permitido" || ing.estado === "ACTIVO") {
        permitidos++;
        distribucionHoras[hora] = (distribucionHoras[hora] || 0) + 1;
      } else {
        denegados++;
        const mot = ing.motivo || "No especificado";
        motivosDenegadosCount[mot] = (motivosDenegadosCount[mot] || 0) + 1;
      }
    });

    // Formatear horas para visualización (06:00 a 23:00 como rango habitual)
    const histogramaHorarios = Object.keys(distribucionHoras)
      .map(Number)
      .filter(h => h >= 6 && h <= 23)
      .map(h => ({
        hora: `${h.toString().padStart(2, "0")}:00`,
        cantidad: distribucionHoras[h] || 0,
      }));

    // 7. Últimos Accesos Denegados
    const ultimosDenegados = await prisma.ingreso.findMany({
      where: {
        tenantId: context.tenantId,
        fechaHora: whereDate,
        estado: { notIn: ["permitido", "ACTIVO"] },
        ...whereSucursal,
      },
      include: { cliente: true },
      orderBy: { fechaHora: "desc" },
      take: 8,
    });

    return {
      success: true,
      data: serializeData({
        totalClientes,
        clientesActivos,
        totalPagos: pagoStats._count,
        totalIngresosMembresías: Number(pagoStats._sum.monto || 0),
        promedioPago: Number(pagoStats._avg.monto || 0),
        totalVentas: ventaStats._count,
        totalVendido: Number(ventaStats._sum.total || 0),
        ticketPromedio: Number(ventaStats._avg.total || 0),
        totalRecaudacion: Number(pagoStats._sum.monto || 0) + Number(ventaStats._sum.total || 0),
        ingresosPermitidos: permitidos,
        ingresosDenegados: denegados,
        topProductos,
        histogramaHorarios,
        motivosDenegados: Object.entries(motivosDenegadosCount).map(([motivo, cantidad]) => ({
          motivo,
          cantidad,
        })),
        ultimosDenegados: ultimosDenegados.map(d => ({
          id: d.id,
          nombre: `${d.cliente.nombre} ${d.cliente.apellido}`,
          documento: d.documento,
          estado: d.estado,
          motivo: d.motivo || "Acceso Denegado",
          fechaHora: d.fechaHora.toISOString(),
        })),
        membresiasVendidas: membresiasVendidas.map(m => ({
          nombre: membresiaMap.get(m.membresiaId) || "Desconocida",
          cantidad: m._count,
          total: Number(m._sum.monto || 0),
        })),
        pagosPorMetodo: pagosPorMetodo.map(p => ({
          metodo: p.metodoPago || "efectivo",
          cantidad: p._count,
          total: p._sum?.monto ? Number(p._sum.monto) : 0,
        })),
        ventasPorTipoPago: ventasPorTipoPago.map(v => ({
          tipo: v.tipoPago || "efectivo",
          cantidad: v._count,
          total: v._sum?.total ? Number(v._sum.total) : 0,
        })),
      }),
    };
  } catch (error) {
    console.error("Error al generar reportes analíticos:", error);
    return { success: false, error: "Error generando reportes" };
  }
}
