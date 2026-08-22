"use client";

import { useEffect, useState } from "react";
import { getHistorialVentasPOS, getDetalleVentaPOS } from "@/app/actions/pos";
import { getMovimientosHoy } from "@/app/actions/caja";
import { 
  Receipt, 
  Calendar, 
  User, 
  ArrowLeft, 
  ShoppingCart, 
  CreditCard, 
  DollarSign, 
  History, 
  Printer, 
  X, 
  FileText, 
  Eye
} from "lucide-react";
import Link from "next/link";

function formatMoney(n: any) {
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MovimientosPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "membresias">("pos");
  const [desde, setDesde] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [hasta, setHasta] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState<string>("todos");
  
  const [sucursalId, setSucursalId] = useState<number>(1);
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");

  const [ventasPOS, setVentasPOS] = useState<any[]>([]);
  const [resumenPOS, setResumenPOS] = useState<any>({
    totalGeneral: 0,
    totalEfectivo: 0,
    totalCuentaCorriente: 0,
    totalTarjeta: 0,
    totalTransferencia: 0,
    totalVentas: 0,
    totalArticulos: 0,
  });

  const [movimientosMembresias, setMovimientosMembresias] = useState<any[]>([]);
  const [totalMembresias, setTotalMembresias] = useState(0);
  const [loading, setLoading] = useState(true);

  const [ticketModal, setTicketModal] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    const id = sId ? parseInt(sId) : 1;
    setSucursalId(id);
    if (sName) setSucursalNombre(sName);

    loadAllData(id, desde, hasta, tipoPagoFiltro);
  }, []);

  const loadAllData = async (sId?: number, d?: string, h?: string, tipo?: string) => {
    setLoading(true);
    const sid = sId || sucursalId;
    const fDesde = d || desde;
    const fHasta = h || hasta;
    const fTipo = tipo || tipoPagoFiltro;

    const resPOS = await getHistorialVentasPOS({
      desde: fDesde,
      hasta: fHasta,
      sucursalId: sid,
      tipoPago: fTipo,
    });

    if (resPOS.success && resPOS.data) {
      setVentasPOS(resPOS.data.ventas);
      setResumenPOS(resPOS.data.resumen);
    }

    const resMem = await getMovimientosHoy(sid);
    if (resMem.success && resMem.data) {
      setMovimientosMembresias(resMem.data);
      const sum = resMem.data.reduce((acc: number, curr: any) => acc + Number(curr.monto), 0);
      setTotalMembresias(sum);
    }

    setLoading(false);
  };

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    loadAllData(sucursalId, desde, hasta, tipoPagoFiltro);
  };

  const handleVerDetalleTicket = async (ventaId: number) => {
    setLoadingDetalle(true);
    const res = await getDetalleVentaPOS(ventaId);
    if (res.success && res.data) {
      setTicketModal(res.data);
    }
    setLoadingDetalle(false);
  };

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/caja"
            className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              Historial de Caja & Arqueo
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sede: <strong className="text-slate-800">{sucursalNombre}</strong> — Auditoría de ventas en cantina y cobros de cuotas.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200 text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "pos"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Ventas Kiosco ({ventasPOS.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("membresias")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "membresias"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Cobro Cuotas ({movimientosMembresias.length})</span>
          </button>
        </div>
      </div>

      {/* Filtros de Fecha y Método */}
      <form onSubmit={handleFiltrar} className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">Desde:</span>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="font-medium">Hasta:</span>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {activeTab === "pos" && (
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="font-medium">Método:</span>
            <select
              value={tipoPagoFiltro}
              onChange={e => setTipoPagoFiltro(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="todos">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="cuenta_corriente">Cuenta Corriente</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
        >
          {loading ? "Cargando..." : "Filtrar"}
        </button>
      </form>

      {/* PESTAÑA 1: VENTAS DE KIOSCO */}
      {activeTab === "pos" && (
        <div className="space-y-5">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Total Recaudado</span>
              <p className="text-base font-bold font-mono text-slate-900 tabular-nums">{formatMoney(resumenPOS.totalGeneral)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">{resumenPOS.totalVentas} ventas</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Efectivo</span>
              <p className="text-base font-bold font-mono text-emerald-700 tabular-nums">{formatMoney(resumenPOS.totalEfectivo)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">Caja física</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Tarjetas</span>
              <p className="text-base font-bold font-mono text-indigo-700 tabular-nums">{formatMoney(resumenPOS.totalTarjeta)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">Débito / Crédito</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Transferencias</span>
              <p className="text-base font-bold font-mono text-blue-700 tabular-nums">{formatMoney(resumenPOS.totalTransferencia)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">Bancario / MP</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">A Cuenta (Fiado)</span>
              <p className="text-base font-bold font-mono text-amber-700 tabular-nums">{formatMoney(resumenPOS.totalCuentaCorriente)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">Saldo deudor</span>
            </div>
          </div>

          {/* Tabla de Tickets de Cantina */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Ticket</th>
                    <th className="px-4 py-2.5 text-left">Fecha y Hora</th>
                    <th className="px-4 py-2.5 text-left">Cliente / Socio</th>
                    <th className="px-4 py-2.5 text-center">Items</th>
                    <th className="px-4 py-2.5 text-center">Método</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ventasPOS.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                        No hay ventas registradas en el período.
                      </td>
                    </tr>
                  ) : (
                    ventasPOS.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-slate-900">#{v.id}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{new Date(v.fecha).toLocaleString("es-AR")}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : <span className="text-slate-400 italic">Consumidor Final</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">{v.detalles?.length || 0}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {v.tipoPago.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">{formatMoney(Number(v.total))}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleVerDetalleTicket(v.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium shadow-2xs transition"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>Ver Ticket</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: COBRO DE MEMBRESÍAS */}
      {activeTab === "membresias" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Cobrado en Membresías Hoy</span>
            <span className="text-xl font-bold font-mono text-indigo-700 tabular-nums">{formatMoney(totalMembresias)}</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Hora</th>
                    <th className="px-4 py-2.5 text-left">Socio</th>
                    <th className="px-4 py-2.5 text-left">Plan</th>
                    <th className="px-4 py-2.5 text-left">Vence</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {movimientosMembresias.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Sin pagos de membresías registrados hoy.
                      </td>
                    </tr>
                  ) : (
                    movimientosMembresias.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{new Date(m.fechaPago).toLocaleTimeString("es-AR")}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{m.cliente?.nombre} {m.cliente?.apellido}</td>
                        <td className="px-4 py-2.5 text-slate-600">{m.membresia?.nombre}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{new Date(m.fechaVencimiento).toLocaleDateString("es-AR")}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">{formatMoney(Number(m.monto))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Ticket */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 p-4 text-white text-center relative">
              <button
                onClick={() => setTicketModal(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <Receipt className="h-5 w-5 mx-auto mb-1 text-slate-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Ticket #{ticketModal.id}</h3>
              <p className="text-[10px] text-slate-400 font-mono">{ticketModal.sucursal}</p>
            </div>

            <div className="p-4 space-y-3 font-mono text-xs text-slate-800">
              <div className="text-center pb-2 border-b border-dashed border-slate-200">
                <p className="text-[10px] text-slate-400">{new Date(ticketModal.fechaVenta).toLocaleString("es-AR")}</p>
              </div>

              <div className="space-y-0.5 text-[11px]">
                <p><strong>Cliente:</strong> {ticketModal.cliente}</p>
                {ticketModal.documento && <p><strong>DNI:</strong> {ticketModal.documento}</p>}
                <p><strong>Pago:</strong> {ticketModal.tipoPago.toUpperCase()}</p>
                <p><strong>Cajero:</strong> {ticketModal.vendedor}</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-200 py-2 space-y-1">
                {ticketModal.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between items-center text-[11px]">
                    <span className="truncate max-w-[170px]">{it.cantidad}x {it.nombre}</span>
                    <span className="font-bold">{formatMoney(it.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span>TOTAL:</span>
                <span className="text-sm text-slate-900">{formatMoney(ticketModal.total)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 flex items-center justify-center gap-1 shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setTicketModal(null)}
                className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-semibold text-xs hover:bg-slate-800 shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
