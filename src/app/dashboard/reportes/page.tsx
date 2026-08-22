"use client";

import { useEffect, useState } from "react";
import { getReportes } from "@/app/actions/reportes";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity, 
  Calendar, 
  Package, 
  ShieldAlert, 
  Printer, 
  Clock, 
  Receipt,
  ArrowUpRight
} from "lucide-react";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR");
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default function ReportesPage() {
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split("T")[0]);
  const [preset, setPreset] = useState<"mes" | "semana" | "hoy" | "custom">("mes");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const applyPreset = (tipo: "mes" | "semana" | "hoy") => {
    setPreset(tipo);
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];

    if (tipo === "hoy") {
      setDesde(hoyStr);
      setHasta(hoyStr);
    } else if (tipo === "semana") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setDesde(d.toISOString().split("T")[0]);
      setHasta(hoyStr);
    } else if (tipo === "mes") {
      const d = new Date();
      d.setDate(1);
      setDesde(d.toISOString().split("T")[0]);
      setHasta(hoyStr);
    }
  };

  const load = () => {
    setLoading(true);
    const sucursalId = typeof window !== "undefined" ? Number(localStorage.getItem("activeSucursalId") || "1") : 1;
    getReportes(desde, hasta, sucursalId).then(r => {
      if (r.success) setStats(r.data);
      setLoading(false);
    });
  };

  useEffect(() => { 
    load(); 
  }, [desde, hasta]);

  const maxIngresosHora = stats?.histogramaHorarios?.reduce((max: number, h: any) => Math.max(max, h.cantidad), 0) || 1;

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header & Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Reportes & Analíticas de Sede
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Métricas de ingresos, ventas en cantina y afluencia de socios en el período.
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-medium border border-slate-200">
            <button
              onClick={() => applyPreset("hoy")}
              className={`px-2.5 py-1 rounded-md transition ${
                preset === "hoy" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => applyPreset("semana")}
              className={`px-2.5 py-1 rounded-md transition ${
                preset === "semana" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Últimos 7d
            </button>
            <button
              onClick={() => applyPreset("mes")}
              className={`px-2.5 py-1 rounded-md transition ${
                preset === "mes" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Este Mes
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={desde}
              onChange={e => { setDesde(e.target.value); setPreset("custom"); }}
              className="bg-transparent border-none text-xs focus:outline-none font-mono"
            />
            <span className="text-slate-400">a</span>
            <input
              type="date"
              value={hasta}
              onChange={e => { setHasta(e.target.value); setPreset("custom"); }}
              className="bg-transparent border-none text-xs focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 shadow-2xs transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs font-medium">Generando analíticas del período...</div>
      ) : !stats ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200/90 text-xs">
          No hay datos disponibles para el rango seleccionado.
        </div>
      ) : (
        <div className="space-y-5">
          
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Total Facturado</span>
              <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{formatMoney(stats.totalFacturado)}</p>
              <span className="text-[10px] text-emerald-600 font-medium block">Cobros + Ventas</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Cobro de Cuotas</span>
              <p className="text-lg font-bold font-mono text-indigo-700 tabular-nums">{formatMoney(stats.totalMembresias)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">{stats.pagosMembresias?.length || 0} cuotas</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Ventas Cantina</span>
              <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{formatMoney(stats.totalPOS)}</p>
              <span className="text-[10px] text-slate-500 font-medium block">{stats.ventasPOS?.length || 0} tickets emitidos</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Accesos Totales</span>
              <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{stats.totalIngresos}</p>
              <span className="text-[10px] text-slate-500 font-medium block">Ingresos por molinete</span>
            </div>
          </div>

          {/* Histograma de Horarios Pico */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  Afluencia Horaria (Horas Pico & Valle)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Distribución de ingresos por franja horaria en la sede.</p>
              </div>
            </div>

            {/* Bars */}
            <div className="h-44 flex items-end gap-1 sm:gap-2 pt-6 px-2">
              {stats.histogramaHorarios?.map((h: any) => {
                const pct = Math.round((h.cantidad / maxIngresosHora) * 100);
                return (
                  <div key={h.hora} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <span className="text-[9px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition">
                      {h.cantidad}
                    </span>
                    <div className="w-full bg-slate-100 rounded-t h-full flex items-end overflow-hidden">
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 transition rounded-t"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">{h.hora}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tablas Inferiores: Ranking Productos & Auditoría de Accesos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Top Productos */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Productos Vendidos</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2">Producto</th>
                      <th className="px-4 py-2 text-center">Unidades</th>
                      <th className="px-4 py-2 text-right">Recaudado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.topProductos?.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400 font-medium">
                          Sin ventas en el período.
                        </td>
                      </tr>
                    ) : (
                      stats.topProductos?.map((p: any) => (
                        <tr key={p.productoId} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-2 font-medium text-slate-900">{p.nombre}</td>
                          <td className="px-4 py-2 text-center font-mono">{p.cantidad}</td>
                          <td className="px-4 py-2 text-right font-bold font-mono text-slate-900 tabular-nums">
                            {formatMoney(p.recaudado)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desglose de Cobros por Método */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Últimas Cuotas Cobradas</h3>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Socio</th>
                      <th className="px-4 py-2">Plan</th>
                      <th className="px-4 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.pagosMembresias?.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400 font-medium">
                          Sin cobros en el período.
                        </td>
                      </tr>
                    ) : (
                      stats.pagosMembresias?.slice(0, 10).map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-2 font-medium text-slate-900">{p.cliente?.nombre} {p.cliente?.apellido}</td>
                          <td className="px-4 py-2 text-slate-600">{p.membresia?.nombre}</td>
                          <td className="px-4 py-2 text-right font-bold font-mono text-slate-900 tabular-nums">
                            {formatMoney(Number(p.monto))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
