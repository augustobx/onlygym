import Link from "next/link";
import { getSuperAdminDashboard } from "@/app/actions/superadmin";
import {
  Building2,
  Users,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Plus,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Layers,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const result = await getSuperAdminDashboard();
  if (!result.success || !result.data) {
    return (
      <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-300">
        <h2 className="text-lg font-bold">Error de Acceso</h2>
        <p className="text-sm mt-1">{result.error || "No se pudieron cargar los datos de plataforma"}</p>
        <Link
          href="/superadmin/login"
          className="mt-4 inline-block px-4 py-2 bg-red-500 text-white font-bold rounded-xl text-xs"
        >
          Iniciar Sesión
        </Link>
      </div>
    );
  }

  const data = result.data as any;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
              OnlyGym SaaS · v4
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Plano de Control Central
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión global de gimnasios, planes, membresías y suscripciones
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/tenants?action=nuevo"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" /> Nuevo Gimnasio
          </Link>
          <Link
            href="/superadmin/planes"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition"
          >
            <Layers className="w-4 h-4 text-cyan-400" /> Planes
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard
          label="Total Tenants"
          value={data.totalTenants}
          subtext="Gimnasios registrados"
          icon={Building2}
          color="cyan"
        />
        <KpiCard
          label="Activos"
          value={data.activos}
          subtext="Con membresía al día"
          icon={CheckCircle2}
          color="emerald"
        />
        <KpiCard
          label="En Prueba"
          value={data.enPrueba}
          subtext="Período de trial"
          icon={Clock}
          color="amber"
        />
        <KpiCard
          label="Suspendidos"
          value={data.suspendidos}
          subtext="Falta de pago"
          icon={Ban}
          color="red"
        />
        <KpiCard
          label="Por Vencer (7d)"
          value={data.proximosAVencer}
          subtext="Requieren gestión"
          icon={AlertTriangle}
          color="orange"
        />
        <KpiCard
          label="MRR Estimado"
          value={`$${Number(data.mrr).toLocaleString("es-AR")}`}
          subtext="Ingresos recurrentes"
          icon={TrendingUp}
          color="indigo"
        />
      </section>

      {/* Second Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#121824] border border-white/8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Socios en Plataforma</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{data.totalSocios.toLocaleString("es-AR")}</p>
          <p className="text-[11px] text-slate-400 mt-1">Clientes activos en todos los gimnasios</p>
        </div>

        <div className="p-5 rounded-3xl bg-[#121824] border border-white/8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Check-ins Hoy</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{data.totalIngresosHoy.toLocaleString("es-AR")}</p>
          <p className="text-[11px] text-slate-400 mt-1">Accesos por molinete y recepción</p>
        </div>

        <div className="p-5 rounded-3xl bg-[#121824] border border-white/8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Planes SaaS</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{data.planes.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Planes comerciales configurados</p>
        </div>

        <div className="p-5 rounded-3xl bg-[#121824] border border-white/8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Router Wildcard</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm font-black text-emerald-300 mt-2 font-mono">*.nanoapps.ar</p>
          <p className="text-[11px] text-slate-400 mt-1">Subdominios automáticos sin DNS manual</p>
        </div>
      </section>

      {/* Main Grid: Recent Tenants & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenants Recientes (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" /> Gimnasios Recientes
            </h2>
            <Link
              href="/superadmin/tenants"
              className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
            >
              Ver todos ({data.totalTenants}) <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-[#121824] border border-white/8 rounded-3xl overflow-hidden divide-y divide-white/5">
            {data.recentTenants.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                No hay gimnasios registrados aún.
              </div>
            ) : (
              data.recentTenants.map((tenant: any) => (
                <div
                  key={tenant.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 grid place-items-center font-black shrink-0">
                      {tenant.nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/superadmin/tenants/${tenant.id}`}
                          className="font-black text-sm text-white hover:text-cyan-400 transition truncate"
                        >
                          {tenant.nombre}
                        </Link>
                        <TenantStatusBadge estado={tenant.estado} />
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        https://{tenant.slug}.nanoapps.ar
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Plan: <b>{tenant.planSaaS?.nombre || "Sin plan"}</b></span>
                        <span>·</span>
                        <span>{tenant._count?.clientes || 0} socios</span>
                        <span>·</span>
                        <span>{tenant._count?.sucursales || 1} sedes</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      href={`/superadmin/tenants/${tenant.id}`}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white border border-white/10 transition"
                    >
                      Administrar
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Auditoría y Actividad Reciente (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" /> Registro de Actividad
            </h2>
          </div>

          <div className="bg-[#121824] border border-white/8 rounded-3xl p-4 divide-y divide-white/5">
            {data.recentAudits.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Sin registros de auditoría recientes.</p>
            ) : (
              data.recentAudits.map((audit: any) => (
                <div key={audit.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-cyan-400 uppercase">{audit.accion}</span>
                    <span className="text-slate-400">
                      {new Date(audit.creadaEn).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {audit.tenant ? (
                      <span className="font-bold text-white">{audit.tenant.nombre}: </span>
                    ) : null}
                    {audit.entidad} #{audit.entidadId || ""}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{audit.actorUserId || "Sistema"}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "cyan" | "emerald" | "amber" | "red" | "orange" | "indigo";
}) {
  const colorMap = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[#121824] border border-white/8 relative overflow-hidden flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-400">{label}</span>
        <div className={`p-2 rounded-xl border ${colorMap[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

export function TenantStatusBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    prueba: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    suspendido: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelado: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };

  const style = styles[estado] || styles.activo;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${style}`}
    >
      {estado}
    </span>
  );
}
