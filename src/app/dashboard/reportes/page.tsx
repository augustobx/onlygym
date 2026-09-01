"use client";

import { useEffect, useState } from "react";
import { getReportes } from "@/app/actions/reportes";
import { getAnaliticaRetencion, getSociosEnRiesgo, registrarSeguimientoComercial } from "@/app/actions/retencion";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Calendar,
  Package,
  ShieldAlert,
  Clock,
  Receipt,
  ArrowUpRight,
  Flame,
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  Phone,
  Filter,
  Sparkles,
  Loader2,
} from "lucide-react";

function formatMoney(n: any) {
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR");
}

export default function ReportesPage() {
  const [tab, setTab] = useState<"ventas" | "retencion" | "riesgo">("ventas");

  // Ventas filters
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split("T")[0]);
  const [preset, setPreset] = useState<"mes" | "semana" | "hoy">("mes");
  const [stats, setStats] = useState<any>(null);

  // Retención stats
  const [periodoRetencion, setPeriodoRetencion] = useState<"mes_actual" | "mes_anterior" | "ultimos_90d">("mes_actual");
  const [retencionStats, setRetencionStats] = useState<any>(null);

  // Riesgo stats
  const [riesgoData, setRiesgoData] = useState<any>(null);
  const [contactingMember, setContactingMember] = useState<any | null>(null);
  const [contactType, setContactType] = useState<"whatsapp" | "llamada" | "email">("whatsapp");
  const [contactNotes, setContactNotes] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadVentas = () => {
    setLoading(true);
    const sucursalId = typeof window !== "undefined" ? Number(localStorage.getItem("activeSucursalId") || "1") : 1;
    getReportes(desde, hasta, sucursalId).then((r) => {
      if (r.success) setStats(r.data);
      setLoading(false);
    });
  };

  const loadRetencion = () => {
    setLoading(true);
    getAnaliticaRetencion(periodoRetencion).then((r) => {
      if (r.success) setRetencionStats(r.data);
      setLoading(false);
    });
  };

  const loadRiesgo = () => {
    setLoading(true);
    getSociosEnRiesgo().then((r) => {
      if (r.success) setRiesgoData(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (tab === "ventas") loadVentas();
    else if (tab === "retencion") loadRetencion();
    else if (tab === "riesgo") loadRiesgo();
  }, [tab, desde, hasta, periodoRetencion]);

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

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactingMember) return;
    setSavingContact(true);

    await registrarSeguimientoComercial({
      clienteId: contactingMember.id,
      tipo: contactType,
      estado: "contactado",
      resultado: contactNotes,
      motivo: contactingMember.motivoRiesgo,
    });

    setContactingMember(null);
    setContactNotes("");
    setSavingContact(false);
    loadRiesgo();
  }

  const maxIngresosHora =
    stats?.histogramaHorarios?.reduce((max: number, h: any) => Math.max(max, h.cantidad), 0) || 1;

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      {/* Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Fase 8 · Analítica & CRM</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">Reportes y Retención</h1>
          <p className="text-xs text-slate-500 font-medium">
            Facturación, afluencia horaria, prevención de abandono y seguimiento comercial.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setTab("ventas")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "ventas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Facturación & Ventas
          </button>
          <button
            onClick={() => setTab("retencion")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "retencion" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Hábitos & Ocupación
          </button>
          <button
            onClick={() => setTab("riesgo")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "riesgo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Socios en Riesgo CRM
          </button>
        </div>
      </div>

      {/* TAB 1: Facturación & Ventas */}
      {tab === "ventas" && (
        <div className="space-y-5">
          {/* Date Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Período:</span>
              <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-bold">
                <button
                  onClick={() => applyPreset("hoy")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    preset === "hoy" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => applyPreset("semana")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    preset === "semana" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  7 Días
                </button>
                <button
                  onClick={() => applyPreset("mes")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    preset === "mes" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Este Mes
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-200 font-bold text-slate-700 bg-white"
              />
              <span className="text-slate-400">a</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-200 font-bold text-slate-700 bg-white"
              />
            </div>
          </div>

          {stats && (
            <>
              {/* Financial KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">Recaudación Total</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.totalRecaudacion)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Membresías + Kiosco / Cantina</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">Ingresos Cuotas</span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{formatMoney(stats.totalIngresosMembresías)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{stats.totalPagos} pagos registrados</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">Ventas Kiosco</span>
                  <p className="text-2xl font-black text-cyan-700 mt-1">{formatMoney(stats.totalVendido)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{stats.totalVentas} tickets de cantina</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">Socios con Cuota al Día</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {stats.clientesActivos}/{stats.totalClientes}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {stats.totalClientes > 0 ? Math.round((stats.clientesActivos / stats.totalClientes) * 100) : 0}% al día
                  </p>
                </div>
              </div>

              {/* Breakdown tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Membresías más vendidas */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-cyan-700" /> Membresías más Contratadas
                  </h3>
                  <div className="space-y-2">
                    {stats.membresiasVendidas?.map((m: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{m.nombre}</span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{m.cantidad} cuotas</span>
                          <span className="text-slate-500 ml-2">({formatMoney(m.total)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Productos Cantina */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-700" /> Top Productos Kiosco / Cantina
                  </h3>
                  <div className="space-y-2">
                    {stats.topProductos?.map((p: any) => (
                      <div key={p.productoId} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">#{p.posicion} {p.nombre}</span>
                          <span className="text-[10px] text-slate-400 block">{p.categoria}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{p.unidadesVendidas} un.</span>
                          <span className="text-slate-500 ml-2 font-mono">({formatMoney(p.recaudacionTotal)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Hábitos & Ocupación */}
      {tab === "retencion" && (
        <div className="space-y-5">
          {/* Selector de Comparación de Períodos */}
          <div className="flex items-center gap-2 bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500">Comparativa de Período:</span>
            <div className="flex gap-2">
              {[
                { id: "mes_actual", label: "Mes Actual" },
                { id: "mes_anterior", label: "Mes Anterior" },
                { id: "ultimos_90d", label: "Últimos 90 Días" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodoRetencion(p.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    periodoRetencion === p.id ? "bg-cyan-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {retencionStats && (
            <>
              {/* Retention Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Tasa de Asistencia</span>
                  <p className="text-2xl font-black text-cyan-700 mt-1">{retencionStats.tasaRetencionEstimada}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Socios activos que asistieron en el período</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Frecuencia Promedio</span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">
                    {retencionStats.frecuenciaPromedioVisitas} <span className="text-sm font-bold text-slate-400">visitas / socio</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Intensidad de uso del gimnasio</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Total Check-ins</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">{retencionStats.totalAsistencias}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Ingresos por molinete / recepción</p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Socios Únicos en Sala</span>
                  <p className="text-2xl font-black text-indigo-700 mt-1">{retencionStats.clientesConAsistencia}</p>
                  <p className="text-[11px] text-slate-400 mt-1">De un total de {retencionStats.totalClientesActivos} activos</p>
                </div>
              </div>

              {/* Heatmap & Peak Hours */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top Horarios */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-700" /> Horarios Pico de Mayor Concurrencia
                  </h3>
                  <div className="space-y-3">
                    {retencionStats.topHorarios?.map((h: any, idx: number) => {
                      const max = retencionStats.topHorarios[0]?.cantidad || 1;
                      const pct = Math.round((h.cantidad / max) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span>#{idx + 1} {h.hora}</span>
                            <span className="text-cyan-700">{h.cantidad} ingresos</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Clases */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-600" /> Clases Más Populares por Ocupación
                  </h3>
                  <div className="space-y-3">
                    {retencionStats.topClases?.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">Sin datos de clases en este período.</p>
                    ) : (
                      retencionStats.topClases?.map((c: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-900">{c.nombre}</p>
                            <p className="text-[10px] text-slate-500">Prof: {c.profesor}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-700 text-sm">{c.ocupacionPromedio}%</span>
                            <span className="text-[10px] text-slate-400 block">{c.reservas}/{c.cupoMaximo} cupos</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Socios en Riesgo & CRM */}
      {tab === "riesgo" && (
        <div className="space-y-5">
          {riesgoData && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Socios Totales</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">{riesgoData.totalSocios}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Base activa de clientes</p>
                </div>

                <div className="p-5 rounded-2xl bg-red-50 border border-red-200">
                  <span className="text-xs font-bold text-red-700">Riesgo Crítico (14+ días)</span>
                  <p className="text-2xl font-black text-red-900 mt-1">{riesgoData.criticos}</p>
                  <p className="text-[10px] text-red-600 mt-0.5">Acción inmediata requerida</p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-700">Riesgo Alto (7+ días)</span>
                  <p className="text-2xl font-black text-amber-900 mt-1">{riesgoData.altos}</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Caída de frecuencia</p>
                </div>

                <div className="p-5 rounded-2xl bg-cyan-50 border border-cyan-200">
                  <span className="text-xs font-bold text-cyan-700">Riesgo Moderado</span>
                  <p className="text-2xl font-black text-cyan-900 mt-1">{riesgoData.medios}</p>
                  <p className="text-[10px] text-cyan-600 mt-0.5">Vencimiento cercano</p>
                </div>
              </div>

              {/* Table of At-Risk Members */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Socios Prioritarios para Contacto Comercial
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Mostrando {riesgoData.sociosEnRiesgo.length} socios en riesgo
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Socio</th>
                        <th className="px-4 py-3">Nivel de Riesgo</th>
                        <th className="px-4 py-3">Inactividad</th>
                        <th className="px-4 py-3">Membresía</th>
                        <th className="px-4 py-3">Racha / Promedio</th>
                        <th className="px-4 py-3 text-right">Acción Comercial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {riesgoData.sociosEnRiesgo.map((socio: any) => {
                        const whatsappMsg = encodeURIComponent(
                          `¡Hola ${socio.nombre.split(" ")[0]}! 💪 Te extrañamos en el gimnasio. Notamos que hace unos días no vienes a entrenar. ¿Cómo podemos ayudarte con tu rutina?`
                        );
                        const whatsappUrl = socio.telefono
                          ? `https://wa.me/${socio.telefono.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`
                          : null;

                        return (
                          <tr key={socio.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{socio.nombre}</p>
                              <p className="text-[10px] text-slate-400">DNI {socio.documento} · Tel: {socio.telefono || "Sin tel"}</p>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  socio.nivelRiesgo === "Crítico"
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : socio.nivelRiesgo === "Alto"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-cyan-100 text-cyan-800 border border-cyan-200"
                                }`}
                              >
                                {socio.nivelRiesgo}
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5">{socio.motivoRiesgo}</p>
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900">
                                {socio.diasInactivo >= 99 ? "Nunca asistió" : `${socio.diasInactivo} días`}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {socio.ultimoIngreso ? `Última: ${formatDate(socio.ultimoIngreso)}` : "Sin check-ins"}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{socio.membresiaNombre}</p>
                              <p className="text-[10px] text-slate-500">
                                {socio.fechaVencimiento ? `Vence: ${formatDate(socio.fechaVencimiento)}` : "Sin cuota"}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-mono text-slate-800 font-bold">{socio.rachaDias} días racha</p>
                              <p className="text-[10px] text-slate-400">{socio.promedioSemanal} visitas/sem</p>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {whatsappUrl ? (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setContactingMember(socio)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600 transition flex items-center gap-1 shadow-xs"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                  </a>
                                ) : null}

                                <button
                                  onClick={() => setContactingMember(socio)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
                                >
                                  Registrar Contacto
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Modal Registrar Seguimiento CRM */}
          {contactingMember && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-700">Seguimiento Comercial CRM</span>
                    <h3 className="text-base font-black text-slate-900">{contactingMember.nombre}</h3>
                  </div>
                  <button onClick={() => setContactingMember(null)} className="text-slate-400 hover:text-slate-900">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveContact} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Canal de Contacto</label>
                    <select
                      value={contactType}
                      onChange={(e) => setContactType(e.target.value as any)}
                      className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="llamada">Llamada Telefónica</option>
                      <option value="email">Email</option>
                      <option value="nota">Nota Interna</option>
                      <option value="oferta">Oferta de Reactivación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Notas / Resultado del Contacto</label>
                    <textarea
                      rows={3}
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                      placeholder="Ej. El socio indica que retomará el lunes. Se le ofreció rutina personalizada."
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none focus:border-cyan-600"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setContactingMember(null)}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingContact}
                      className="px-5 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      {savingContact ? "Guardando..." : "Guardar Gestión"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
