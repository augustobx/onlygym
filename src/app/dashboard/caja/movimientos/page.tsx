"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CreditCard,
  Eye,
  History,
  MapPin,
  Printer,
  Receipt,
  ShoppingCart,
  X,
} from "lucide-react";
import { getDetalleVentaPOS, getHistorialVentasPOS } from "@/app/actions/pos";
import { getMovimientosHoy } from "@/app/actions/caja";

function formatMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MovimientosPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "membresias">("pos");
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState("todos");
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("Sucursal activa");
  const [branchReady, setBranchReady] = useState(false);
  const [ventasPOS, setVentasPOS] = useState<any[]>([]);
  const [resumenPOS, setResumenPOS] = useState<any>({ totalGeneral: 0, totalEfectivo: 0, totalCuentaCorriente: 0, totalTarjeta: 0, totalTransferencia: 0, totalVentas: 0, totalArticulos: 0 });
  const [movimientosMembresias, setMovimientosMembresias] = useState<any[]>([]);
  const [totalMembresias, setTotalMembresias] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ticketModal, setTicketModal] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = async (branchId: number, from = desde, to = hasta, paymentType = tipoPagoFiltro) => {
    setLoading(true);
    setError(null);
    const [posResult, membershipResult] = await Promise.all([
      getHistorialVentasPOS({ desde: from, hasta: to, sucursalId: branchId, tipoPago: paymentType }),
      getMovimientosHoy(branchId, from, to),
    ]);

    if (posResult.success && posResult.data) {
      setVentasPOS(posResult.data.ventas);
      setResumenPOS(posResult.data.resumen);
    } else {
      setVentasPOS([]);
      setResumenPOS({ totalGeneral: 0, totalEfectivo: 0, totalCuentaCorriente: 0, totalTarjeta: 0, totalTransferencia: 0, totalVentas: 0, totalArticulos: 0 });
      setError(posResult.error || "No se pudo cargar el historial de ventas");
    }

    if (membershipResult.success && membershipResult.data) {
      setMovimientosMembresias(membershipResult.data);
      setTotalMembresias(membershipResult.data.reduce((sum: number, item: any) => sum + Number(item.monto), 0));
    } else {
      setMovimientosMembresias([]);
      setTotalMembresias(0);
      setError((current) => current || membershipResult.error || "No se pudieron cargar los cobros de membresía");
    }
    setLoading(false);
  };

  useEffect(() => {
    const storedId = Number(localStorage.getItem("activeSucursalId") || 0);
    const storedName = localStorage.getItem("activeSucursalName");
    if (storedName) setSucursalNombre(storedName);
    if (!Number.isInteger(storedId) || storedId <= 0) {
      setBranchReady(true);
      return;
    }
    setSucursalId(storedId);
    setBranchReady(true);
    void loadAllData(storedId, desde, hasta, tipoPagoFiltro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltrar = (event: React.FormEvent) => {
    event.preventDefault();
    if (sucursalId) void loadAllData(sucursalId, desde, hasta, tipoPagoFiltro);
  };

  const handleVerDetalleTicket = async (ventaId: number) => {
    setLoadingDetalle(true);
    setError(null);
    const result = await getDetalleVentaPOS(ventaId);
    if (result.success && result.data) setTicketModal(result.data);
    else setError(result.error || "No se pudo abrir el ticket");
    setLoadingDetalle(false);
  };

  if (!branchReady) return <p className="py-20 text-center text-sm font-semibold text-slate-500">Preparando arqueo…</p>;

  if (!sucursalId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MapPin className="mx-auto h-7 w-7 text-amber-700" />
        <h1 className="mt-2 text-lg font-black text-amber-950">Seleccioná una sucursal</h1>
        <p className="mt-1 text-sm text-amber-800">El arqueo siempre corresponde a la sede activa. Ya no se usa una sucursal por defecto.</p>
        <Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Seleccionar sucursal</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 font-sans">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/caja" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Operación de sede</p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><History className="h-5 w-5 text-cyan-600" />Arqueo y movimientos</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-600">{sucursalNombre} · ventas de productos y cobros de membresía del período elegido.</p>
          </div>
        </div>
        <div className="flex self-start rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs sm:self-auto">
          <button onClick={() => setActiveTab("pos")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold ${activeTab === "pos" ? "border border-slate-200/80 bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}><ShoppingCart className="h-3.5 w-3.5 text-cyan-600" />Ventas ({ventasPOS.length})</button>
          <button onClick={() => setActiveTab("membresias")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold ${activeTab === "membresias" ? "border border-slate-200/80 bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}><CreditCard className="h-3.5 w-3.5 text-cyan-600" />Membresías ({movimientosMembresias.length})</button>
        </div>
      </header>

      {error && <button onClick={() => setError(null)} className="flex w-full items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-left text-xs font-bold text-rose-900"><AlertCircle className="h-4 w-4" />{error}</button>}

      <form onSubmit={handleFiltrar} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 text-xs shadow-2xs">
        <label className="flex items-center gap-1.5 font-bold text-slate-800"><Calendar className="h-3.5 w-3.5 text-cyan-600" />Desde<input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1 font-mono" /></label>
        <label className="flex items-center gap-1.5 font-bold text-slate-800">Hasta<input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1 font-mono" /></label>
        {activeTab === "pos" && <label className="flex items-center gap-1.5 font-bold text-slate-800">Método<select value={tipoPagoFiltro} onChange={(event) => setTipoPagoFiltro(event.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1 font-semibold"><option value="todos">Todos</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="cuenta_corriente">Cuenta corriente</option></select></label>}
        <button type="submit" disabled={loading} className="rounded-lg bg-slate-950 px-4 py-1.5 font-bold text-white disabled:opacity-50">{loading ? "Cargando…" : "Aplicar filtros"}</button>
      </form>

      {activeTab === "pos" ? (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Kpi label="Total vendido" value={formatMoney(resumenPOS.totalGeneral)} detail={`${resumenPOS.totalVentas} ventas`} />
            <Kpi label="Efectivo" value={formatMoney(resumenPOS.totalEfectivo)} detail="Caja física" />
            <Kpi label="Tarjetas" value={formatMoney(resumenPOS.totalTarjeta)} detail="Débito / crédito" />
            <Kpi label="Transferencias" value={formatMoney(resumenPOS.totalTransferencia)} detail="Transferencias" />
            <Kpi label="Cuenta corriente" value={formatMoney(resumenPOS.totalCuentaCorriente)} detail="Consumos financiados" />
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3 text-left">Ticket</th><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Socio</th><th className="px-4 py-3 text-center">Ítems</th><th className="px-4 py-3 text-center">Pago</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">{ventasPOS.map((venta) => <tr key={venta.id}><td className="px-4 py-3 font-mono font-black">#{venta.id}</td><td className="px-4 py-3 font-mono text-slate-500">{new Date(venta.fechaVenta).toLocaleString("es-AR")}</td><td className="px-4 py-3 font-bold">{venta.cliente}</td><td className="px-4 py-3 text-center font-mono">{venta.articulosCantidad}</td><td className="px-4 py-3 text-center"><span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-black">{String(venta.tipoPago).replace("_", " ").toUpperCase()}</span></td><td className="px-4 py-3 text-right font-mono font-black">{formatMoney(venta.total)}</td><td className="px-4 py-3 text-right"><button disabled={loadingDetalle} onClick={() => void handleVerDetalleTicket(venta.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 font-bold"><Eye className="h-3.5 w-3.5 text-cyan-600" />Ver ticket</button></td></tr>)}{!ventasPOS.length && <tr><td colSpan={7} className="px-4 py-10 text-center font-semibold text-slate-500">No hay ventas en el período seleccionado.</td></tr>}</tbody></table></div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cobrado en membresías</p><p className="text-xs text-slate-500">Período {desde} a {hasta}</p></div><strong className="font-mono text-xl text-cyan-700">{formatMoney(totalMembresias)}</strong></section>
          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Socio</th><th className="px-4 py-3 text-left">Plan</th><th className="px-4 py-3 text-left">Vence</th><th className="px-4 py-3 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{movimientosMembresias.map((movimiento) => <tr key={movimiento.id}><td className="px-4 py-3 font-mono text-slate-500">{new Date(movimiento.fechaPago).toLocaleString("es-AR")}</td><td className="px-4 py-3 font-bold">{movimiento.cliente?.nombre} {movimiento.cliente?.apellido}</td><td className="px-4 py-3">{movimiento.membresia?.nombre}</td><td className="px-4 py-3 font-mono text-slate-500">{new Date(movimiento.fechaVencimiento).toLocaleDateString("es-AR")}</td><td className="px-4 py-3 text-right font-mono font-black">{formatMoney(movimiento.monto)}</td></tr>)}{!movimientosMembresias.length && <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-500">No hay cobros de membresía en el período.</td></tr>}</tbody></table></div></section>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="relative bg-slate-950 p-4 text-center text-white"><button onClick={() => setTicketModal(null)} className="absolute right-3 top-3 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button><Receipt className="mx-auto h-5 w-5 text-cyan-400" /><h2 className="mt-1 text-sm font-black">Ticket #{ticketModal.id}</h2><p className="text-[10px] font-mono text-slate-400">{ticketModal.sucursal}</p></div>
            <div className="space-y-3 p-4 font-mono text-xs"><p className="border-b border-dashed border-slate-200 pb-2 text-center text-[10px] text-slate-500">{new Date(ticketModal.fechaVenta).toLocaleString("es-AR")}</p><div className="text-[11px]"><p><strong>Cliente:</strong> {ticketModal.cliente?.nombre || "Consumidor Final"}</p>{ticketModal.cliente?.documento && <p><strong>DNI:</strong> {ticketModal.cliente.documento}</p>}<p><strong>Pago:</strong> {String(ticketModal.tipoPago).replace("_", " ").toUpperCase()}</p><p><strong>Cajero:</strong> {ticketModal.vendedor}</p></div><div className="space-y-1 border-y border-dashed border-slate-200 py-2">{ticketModal.items.map((item: any) => <div key={item.id} className="flex justify-between gap-2 text-[11px]"><span className="truncate">{item.cantidad}x {item.nombre}</span><strong>{formatMoney(item.subtotal)}</strong></div>)}</div><div className="flex justify-between font-black"><span>TOTAL</span><span>{formatMoney(ticketModal.total)}</span></div></div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3"><button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold"><Printer className="h-3.5 w-3.5 text-cyan-600" />Imprimir</button><button onClick={() => setTicketModal(null)} className="flex-1 rounded-lg bg-slate-950 py-2 text-xs font-bold text-white">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-mono text-base font-black text-slate-950">{value}</p><p className="text-[10px] font-medium text-slate-500">{detail}</p></article>;
}
