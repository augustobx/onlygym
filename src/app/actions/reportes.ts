"use server";

import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

const REPORT_ROLES = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION];

function parseReportRange(desde: string, hasta: string) {
  const fechaDesde = new Date(`${desde}T00:00:00`);
  const fechaHasta = new Date(`${hasta}T23:59:59.999`);
  if (Number.isNaN(fechaDesde.getTime()) || Number.isNaN(fechaHasta.getTime())) {
    throw new Error("Período inválido");
  }
  if (fechaDesde > fechaHasta) throw new Error("La fecha desde no puede ser posterior a la fecha hasta");
  return { fechaDesde, fechaHasta };
}

export async function getReportes(desde: string, hasta: string, _legacySucursalId?: number) {
  try {
    const context = await requireStaffContext({ roles: REPORT_ROLES });
    await requireTenantModule(context.tenantId, "reportes");
    if (!context.branchId) throw new Error("Seleccioná una sucursal antes de consultar reportes");

    const branchId = context.branchId;
    const { fechaDesde, fechaHasta } = parseReportRange(desde, hasta);
    const whereDate = { gte: fechaDesde, lte: fechaHasta };
    const whereSucursal = { sucursalId: branchId };
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const totalClientes = await prisma.cliente.count({
      where: { tenantId: context.tenantId, estado: "activo", sucursales: { some: { id: branchId } } },
    });
    const clientesActivos = await prisma.cliente.count({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        sucursales: { some: { id: branchId } },
        pagos: {
          some: {
            tenantId: context.tenantId,
            fechaVencimiento: { gte: inicioHoy },
            estado: "pagado",
          },
        },
      },
    });

    const pagoStats = await prisma.pago.aggregate({
      _sum: { monto: true },
      _count: true,
      _avg: { monto: true },
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
    });

    const pagosPorMetodo = await prisma.pago.groupBy({
      by: ["metodoPago"],
      _sum: { monto: true },
      _count: true,
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
    });

    const ventaStats = await prisma.venta.aggregate({
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
      where: { tenantId: context.tenantId, fechaVenta: whereDate, ...whereSucursal },
    });

    const ventasPorTipoPago = await prisma.venta.groupBy({
      by: ["tipoPago"],
      _sum: { total: true },
      _count: true,
      where: { tenantId: context.tenantId, fechaVenta: whereDate, ...whereSucursal },
    });

    const topProductosRaw = await prisma.ventaItem.groupBy({
      by: ["productoId"],
      _sum: { cantidad: true, subtotal: true },
      _count: true,
      where: {
        venta: {
          tenantId: context.tenantId,
          fechaVenta: whereDate,
          sucursalId: branchId,
        },
      },
      orderBy: { _sum: { cantidad: "desc" } },
      take: 10,
    });

    const productoIds = topProductosRaw.map((p) => p.productoId);
    const productos = await prisma.producto.findMany({
      where: { tenantId: context.tenantId, id: { in: productoIds } },
      select: { id: true, nombre: true, categoria: true },
    });
    const productoMap = new Map(productos.map((p) => [p.id, p]));

    const topProductos = topProductosRaw.map((item, idx) => {
      const p = productoMap.get(item.productoId);
      return {
        posicion: idx + 1,
        productoId: item.productoId,
        nombre: p?.nombre || "Producto",
        categoria: p?.categoria || "General",
        unidadesVendidas: item._sum.cantidad || 0,
        recaudacionTotal: Number(item._sum.subtotal || 0),
      };
    });

    const membresiasVendidas = await prisma.pago.groupBy({
      by: ["membresiaId"],
      _count: true,
      _sum: { monto: true },
      where: { tenantId: context.tenantId, fechaPago: whereDate, ...whereSucursal },
      orderBy: { _count: { membresiaId: "desc" } },
      take: 10,
    });

    const membresiaIds = membresiasVendidas.map((m) => m.membresiaId);
    const membresias = await prisma.membresia.findMany({
      where: { tenantId: context.tenantId, id: { in: membresiaIds } },
      select: { id: true, nombre: true },
    });
    const membresiaMap = new Map(membresias.map((m) => [m.id, m.nombre]));

    const todosIngresos = await prisma.ingreso.findMany({
      where: {
        tenantId: context.tenantId,
        sucursalId: branchId,
        fechaHora: whereDate,
      },
      select: {
        fechaHora: true,
        estado: true,
        motivo: true,
        documento: true,
        cliente: { select: { nombre: true, apellido: true } },
      },
    });

    const distribucionHoras: Record<number, number> = {};
    for (let h = 0; h < 24; h++) distribucionHoras[h] = 0;

    let permitidos = 0;
    let denegados = 0;
    const motivosDenegadosCount: Record<string, number> = {};

    todosIngresos.forEach((ingreso) => {
      const hora = new Date(ingreso.fechaHora).getHours();
      if (ingreso.estado === "permitido" || ingreso.estado === "ACTIVO") {
        permitidos++;
        distribucionHoras[hora] = (distribucionHoras[hora] || 0) + 1;
      } else {
        denegados++;
        const motivo = ingreso.motivo || "No especificado";
        motivosDenegadosCount[motivo] = (motivosDenegadosCount[motivo] || 0) + 1;
      }
    });

    const histogramaHorarios = Object.keys(distribucionHoras)
      .map(Number)
      .filter((hora) => hora >= 6 && hora <= 23)
      .map((hora) => ({
        hora: `${hora.toString().padStart(2, "0")}:00`,
        cantidad: distribucionHoras[hora] || 0,
      }));

    const ultimosDenegados = await prisma.ingreso.findMany({
      where: {
        tenantId: context.tenantId,
        sucursalId: branchId,
        fechaHora: whereDate,
        estado: { notIn: ["permitido", "ACTIVO"] },
      },
      include: { cliente: true },
      orderBy: { fechaHora: "desc" },
      take: 8,
    });

    return {
      success: true,
      data: serializeData({
        branchId,
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
        motivosDenegados: Object.entries(motivosDenegadosCount).map(([motivo, cantidad]) => ({ motivo, cantidad })),
        ultimosDenegados: ultimosDenegados.map((denegado) => ({
          id: denegado.id,
          nombre: `${denegado.cliente.nombre} ${denegado.cliente.apellido}`,
          documento: denegado.documento,
          estado: denegado.estado,
          motivo: denegado.motivo || "Acceso Denegado",
          fechaHora: denegado.fechaHora.toISOString(),
        })),
        membresiasVendidas: membresiasVendidas.map((membresia) => ({
          nombre: membresiaMap.get(membresia.membresiaId) || "Desconocida",
          cantidad: membresia._count,
          total: Number(membresia._sum.monto || 0),
        })),
        pagosPorMetodo: pagosPorMetodo.map((pago) => ({
          metodo: pago.metodoPago || "efectivo",
          cantidad: pago._count,
          total: pago._sum?.monto ? Number(pago._sum.monto) : 0,
        })),
        ventasPorTipoPago: ventasPorTipoPago.map((venta) => ({
          tipo: venta.tipoPago || "efectivo",
          cantidad: venta._count,
          total: venta._sum?.total ? Number(venta._sum.total) : 0,
        })),
      }),
    };
  } catch (error) {
    console.error("Error al generar reportes analíticos:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error generando reportes" };
  }
}
