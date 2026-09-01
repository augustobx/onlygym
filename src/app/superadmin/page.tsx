import Link from "next/link";
import { getSuperAdminDashboard } from "@/app/actions/superadmin";
import { Building2, Layers, DollarSign, TrendingUp, AlertTriangle, Plus, ArrowUpRight, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const result = await getSuperAdminDashboard();
  if (!result.success || !result.data) {
    return <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300">{result.error || "No se pudo cargar el panel"}</div>;
  }

  const data = result.data as any;
  const planes = data.planes || [];
  const recent = data.recentTenants || [];

  return <div className="space-y-8">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950/40 p-6 rounded-2xl border border-slate-800">
      <div><h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">Plano de Control OnlyGym <ShieldCheck className="w-6 h-6 text-indigo-400" /></h1><p className="text-sm text-slate-400 mt-1">Supervisión global de gimnasios, suscripciones y módulos en producción.</p></div>
      <Link href="/superadmin/tenants?action=nuevo" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/20 transition-colors"><Plus className="w-4 h-4" /> Nuevo Gimnasio</Link>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi label="Total Tenants" value={data.totalTenants} icon={<Building2 className="w-5 h-5" />} tone="indigo"><><span className="text-emerald-400 font-semibold">{data.activos} activos</span><span>•</span><span className="text-amber-400 font-semibold">{data.enPrueba} prueba</span></></Kpi>
      <Kpi label="MRR Proyectado" value={`$${Number(data.mrr || 0).toLocaleString("es-AR")}`} icon={<DollarSign className="w-5 h-5" />} tone="emerald"><><TrendingUp className="w-3.5 h-3.5" /><span>Facturación mensual recurrente</span></></Kpi>
      <Kpi label="Planes Disponibles" value={planes.length} icon={<Layers className="w-5 h-5" />} tone="cyan"><span>Planes SaaS activos</span></Kpi>
      <Kpi label="Suspendidos" value={data.suspendidos} icon={<AlertTriangle className="w-5 h-5" />} tone="red"><span>Por falta de pago o baja</span></Kpi>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white">Gimnasios Registrados</h2><Link href="/superadmin/tenants" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Ver todos ({data.totalTenants}) <ArrowUpRight className="w-3.5 h-3.5" /></Link></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300"><thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800"><tr><th className="py-3 px-4 rounded-l-lg">Gimnasio / Subdominio</th><th className="py-3 px-4">Plan</th><th className="py-3 px-4">Estado</th><th className="py-3 px-4 text-right rounded-r-lg">Acción</th></tr></thead><tbody className="divide-y divide-slate-800/60">{recent.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-slate-500">No hay gimnasios registrados aún.</td></tr> : recent.map((t:any) => <tr key={t.id} className="hover:bg-slate-800/30 transition-colors"><td className="py-3.5 px-4 font-medium text-white"><div>{t.nombre}</div><div className="text-xs text-indigo-400 font-mono">{t.slug}.nanoapps.ar</div></td><td className="py-3.5 px-4"><span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{t.planSaaS?.nombre || "Sin plan"}</span></td><td className="py-3.5 px-4"><TenantStatusBadge estado={t.estado} /></td><td className="py-3.5 px-4 text-right"><Link href={`/superadmin/tenants/${t.id}`} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">Configurar</Link></td></tr>)}</tbody></table></div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between"><div><h2 className="text-lg font-semibold text-white mb-4">Planes y Cobertura</h2><div className="space-y-4">{planes.map((p:any) => <div key={p.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80"><div className="flex items-center justify-between"><span className="font-semibold text-white text-sm">{p.nombre}</span><span className="text-xs font-bold text-indigo-400">${Number(p.precioMensual).toLocaleString("es-AR")}/mes</span></div><p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.descripcion || "Plan SaaS OnlyGym"}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-900"><span>{p._count?.tenants || 0} gimnasios</span><span className="text-emerald-400 font-medium">Activo</span></div></div>)}</div></div><div className="mt-6 pt-4 border-t border-slate-800 text-center"><Link href="/superadmin/planes" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center justify-center gap-1">Administrar Módulos de Planes <ArrowUpRight className="w-3.5 h-3.5" /></Link></div></div>
    </div>
  </div>;
}

function Kpi({label,value,icon,tone,children}:{label:string;value:string|number;icon:React.ReactNode;tone:"indigo"|"emerald"|"cyan"|"red";children:React.ReactNode}) {
  const tones={indigo:"bg-indigo-500/10 text-indigo-400",emerald:"bg-emerald-500/10 text-emerald-400",cyan:"bg-cyan-500/10 text-cyan-400",red:"bg-red-500/10 text-red-400"};
  return <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span><div className={`p-2 rounded-lg ${tones[tone]}`}>{icon}</div></div><div className="mt-3"><span className="text-3xl font-extrabold text-white">{value}</span><div className="flex items-center gap-2 mt-1 text-xs text-slate-400">{children}</div></div></div>;
}

export function TenantStatusBadge({estado}:{estado:string}) {
  const map:Record<string,string>={activo:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20",prueba:"bg-amber-500/10 text-amber-400 border-amber-500/20",suspendido:"bg-red-500/10 text-red-400 border-red-500/20",cancelado:"bg-slate-500/10 text-slate-400 border-slate-500/20"};
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${map[estado] || map.activo}`}>{estado === "activo" ? "Activo" : estado === "prueba" ? "Prueba" : estado === "suspendido" ? "Suspendido" : "Cancelado"}</span>;
}
