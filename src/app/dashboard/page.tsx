"use client";

import { useEffect, useState } from "react";
import { getDashboardStats } from "@/app/actions/dashboard";
import { getAforoEnVivo } from "@/app/actions/horarios";
import Link from "next/link";
import { 
  Users, 
  CreditCard, 
  DollarSign, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  ShoppingCart, 
  PlusCircle, 
  Receipt,
  UserPlus,
  Store,
  Clock,
  Sparkles,
  BarChart3
} from "lucide-react";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function formatDate(d: string) { 
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR"); 
}
function formatTime(d: string) { 
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); 
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [aforo, setAforo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    if (sName) setSucursalNombre(sName);

    const sucursalId = sId ? parseInt(sId) : 1;

    Promise.all([
      getDashboardStats(sucursalId),
      getAforoEnVivo(sucursalId)
    ]).then(([resStats, resAforo]) => {
      if (resStats.success && resStats.data) setStats(resStats.data);
      if (resAforo.success && resAforo.data) setAforo(resAforo.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        <p className="text-xs font-semibold text-slate-600">Cargando métricas de sede...</p>
      </div>
    );
  }

  const s = stats || {
    sociosActivos: 0,
    sociosAlDia: 0,
    sociosVencidos: 0,
    ingresosMes: 0,
    totalDeuda: 0,
    asistenciasHoy: 0,
    ultimosPagos: [],
    ultimosIngresos: [],
  };

  return (
    <div className="space-y-5 font-sans">
      
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Panel de Control Ejecutivo</h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Estado operativo y financiero en tiempo real para <strong className="text-slate-900">{sucursalNombre}</strong>
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/clientes/nuevo"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Nuevo Socio</span>
          </Link>

          <Link
            href="/dashboard/pagos"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Cobrar Cuota</span>
          </Link>

          <Link
            href="/dashboard/caja"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium shadow-2xs transition"
          >
            <ShoppingCart className="h-3.5 w-3.5 text-cyan-600" />
            <span>Punto de Venta</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Grid (Linear / Stripe style: 6 columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Recaudación Mensual */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Recaudación Mes</span>
          <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{formatMoney(s.ingresosMes)}</p>
          <span className="text-[10px] text-cyan-700 font-semibold block">Cobros + Ventas</span>
        </div>

        {/* Socios Al Día */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Socios Al Día</span>
          <p className="text-lg font-bold font-mono text-emerald-700 tabular-nums">{s.sociosAlDia || 0}</p>
          <span className="text-[10px] text-slate-600 font-medium block">Acceso autorizado</span>
        </div>

        {/* Membresías Vencidas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Vencidos / A Renovar</span>
          <p className="text-lg font-bold font-mono text-rose-600 tabular-nums">{s.sociosVencidos || 0}</p>
          <Link href="/dashboard/clientes" className="text-[10px] text-cyan-700 hover:text-cyan-900 hover:underline font-semibold block">
            Ver lista WhatsApp →
          </Link>
        </div>

        {/* Total Socios Activos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Padrón Total</span>
          <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{s.sociosActivos || 0}</p>
          <span className="text-[10px] text-slate-600 font-medium block">Socios en sistema</span>
        </div>

        {/* Deuda Cuentas Corrientes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Deuda en Cuentas</span>
          <p className="text-lg font-bold font-mono text-rose-600 tabular-nums">{formatMoney(s.totalDeuda)}</p>
          <Link href="/dashboard/cuentas" className="text-[10px] text-cyan-700 hover:text-cyan-900 hover:underline font-semibold block">
            Ver saldos →
          </Link>
        </div>

        {/* Aforo en Vivo */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aforo Actual</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-700 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              En vivo
            </span>
          </div>
          <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">
            {aforo ? aforo.personasAdentro : 0} <span className="text-xs font-semibold text-slate-500">/ {aforo ? aforo.capacidadMaxima : 50}</span>
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              style={{ width: `${aforo ? Math.min(100, aforo.porcentaje) : 0}%` }}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Activity Feeds (Two Columns, Dense Table Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Últimos Cobros de Cuotas */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Últimos Cobros Registrados</h3>
            </div>
            <Link href="/dashboard/pagos" className="text-xs text-cyan-700 hover:text-cyan-900 font-semibold">
              Ver todos →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Socio</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {s.ultimosPagos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-medium">
                      Sin cobros recientes registrados.
                    </td>
                  </tr>
                ) : (
                  s.ultimosPagos.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {p.clienteNombre || (p.cliente ? `${p.cliente.nombre} ${p.cliente.apellido}` : "Socio")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{p.membresia?.nombre || p.membresia || "Cuota"}</td>
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{formatDate(p.fechaPago || p.fecha)}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">
                        {formatMoney(Number(p.monto))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos Ingresos de Molinete */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Actividad en Molinete</h3>
            </div>
            <Link href="/dashboard/aforo" className="text-xs text-cyan-700 hover:text-cyan-900 font-semibold">
              Ver aforo →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Socio</th>
                  <th className="px-4 py-2.5">Hora</th>
                  <th className="px-4 py-2.5">Duración</th>
                  <th className="px-4 py-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {s.ultimosIngresos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-medium">
                      Sin ingresos recientes registrados.
                    </td>
                  </tr>
                ) : (
                  s.ultimosIngresos.map((ing: any) => (
                    <tr key={ing.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {ing.clienteNombre || (ing.cliente ? `${ing.cliente.nombre} ${ing.cliente.apellido}` : "Socio")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{formatTime(ing.fechaHora || ing.fecha)}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">
                        {ing.duracionMinutos ? `${ing.duracionMinutos} min` : "En sala"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          ● OK
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Widgets Fase 8: Clases del Día & Alertas de Retención */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Clases del Día */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Clases & Reservas de Hoy</h3>
            </div>
            <Link href="/dashboard/clases" className="text-xs text-cyan-700 hover:text-cyan-900 font-semibold">
              Ver agenda completa →
            </Link>
          </div>

          <div className="space-y-3">
            {(!s.clasesHoy || s.clasesHoy.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">No hay clases programadas para hoy.</p>
            ) : (
              s.clasesHoy.map((clase: any) => {
                const pct = Math.min(100, Math.round((clase.reservados / clase.cupoMaximo) * 100));
                return (
                  <div key={clase.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{clase.nombre}</span>
                        <span className="text-[10px] text-cyan-700 font-mono font-bold">{formatTime(clase.inicio)} hs</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Profesor: {clase.profesor} · {clase.duracionMinutos} min</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-700">{clase.reservados}/{clase.cupoMaximo} cupos</span>
                      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Retención & Socios en Riesgo */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Retención & Alerta de Abandono</h3>
            </div>
            <Link href="/dashboard/reportes" className="text-xs text-cyan-700 hover:text-cyan-900 font-semibold">
              Ver analítica →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Inactivos +7 días</span>
              <p className="text-2xl font-black text-amber-900 mt-1">{s.sociosInactivos7d || 0}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Riesgo moderado de baja</p>
            </div>

            <div className="p-3 rounded-xl bg-red-50/60 border border-red-200/70">
              <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">Inactivos +14 días</span>
              <p className="text-2xl font-black text-red-900 mt-1">{s.sociosInactivos14d || 0}</p>
              <p className="text-[10px] text-red-700 mt-0.5">Riesgo crítico de abandono</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Contactar a los socios antes de que cumplan 14 días sin asistir aumenta la tasa de retención un 40%.
          </p>
        </div>
      </div>
    </div>
  );
}

