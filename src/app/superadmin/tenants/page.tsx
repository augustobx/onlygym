import Link from "next/link";
import { getTenantsSuperAdmin, getPlanesSaaS } from "@/app/actions/superadmin";
import { Building2, Search, ExternalLink, Settings, Users, Store, CalendarDays, CheckCircle2, AlertCircle, X } from "lucide-react";
import CreateTenantModal from "./CreateTenantModal";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantsPage({ searchParams }: { searchParams: Promise<{ search?: string; estado?: string; page?: string; action?: string }> }) {
  const params = await searchParams;
  const [result, planesResult] = await Promise.all([
    getTenantsSuperAdmin({ search: params.search, estado: params.estado, page: params.page ? parseInt(params.page, 10) : 1 }),
    getPlanesSaaS(),
  ]);
  const planes = planesResult.success && planesResult.data ? planesResult.data as any[] : [];
  const data = result.success && result.data ? result.data as any : { tenants: [], total: 0 };

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2"><Building2 className="w-6 h-6 text-indigo-400" />Gestión de Gimnasios (Tenants)</h1>
        <p className="text-sm text-slate-400 mt-1">Aprovisionamiento automático, asignación de planes y estado operativo.</p>
      </div>
      <CreateTenantModal planes={planes} defaultOpen={params.action === "nuevo"} />
    </div>

    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <form method="GET" action="/superadmin/tenants" className="relative max-w-md w-full">
        {params.estado && <input type="hidden" name="estado" value={params.estado} />}
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="search" defaultValue={params.search || ""} placeholder="Buscar por nombre o subdominio..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </form>
      <div className="flex flex-wrap gap-2">{["todos","activo","prueba","suspendido","cancelado"].map(st => <Link key={st} href={`/superadmin/tenants?estado=${st}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${(params.estado || "todos") === st ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"}`}>{st === "todos" ? "Todos" : st[0].toUpperCase()+st.slice(1)}</Link>)}</div>
    </div>

    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
            <tr><th className="py-3.5 px-6">Gimnasio & Dominio</th><th className="py-3.5 px-6">Plan SaaS</th><th className="py-3.5 px-6">Recursos Creados</th><th className="py-3.5 px-6">Estado</th><th className="py-3.5 px-6 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.tenants.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-slate-500">No se encontraron gimnasios con ese criterio.</td></tr> : data.tenants.map((t:any) => <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-4 px-6"><div className="font-semibold text-white">{t.nombre}</div><div className="text-xs text-indigo-400 font-mono mt-0.5 flex items-center gap-1">{t.slug}.nanoapps.ar<a href={`https://${t.slug}.nanoapps.ar`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-300"><ExternalLink className="w-3 h-3" /></a></div></td>
              <td className="py-4 px-6"><div className="inline-block px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700">{t.planSaaS?.nombre || "Sin plan"}</div>{t.planSaaS?.precioMensual != null && <div className="text-[11px] text-emerald-400 font-semibold mt-1">${Number(t.planSaaS.precioMensual).toLocaleString("es-AR")}/mes</div>}</td>
              <td className="py-4 px-6"><div className="flex items-center gap-3 text-xs text-slate-400"><span className="flex items-center gap-1" title="Usuarios"><Users className="w-3.5 h-3.5 text-indigo-400" />{t._count?.usuarios || 0}</span><span className="flex items-center gap-1" title="Sedes"><Store className="w-3.5 h-3.5 text-cyan-400" />{t._count?.sucursales || 0}</span><span className="flex items-center gap-1" title="Socios"><Users className="w-3.5 h-3.5 text-emerald-400" />{t._count?.clientes || 0}</span>{t.fechaVencimiento && <span className="flex items-center gap-1" title="Vencimiento"><CalendarDays className="w-3.5 h-3.5 text-amber-400" />{new Date(t.fechaVencimiento).toLocaleDateString("es-AR")}</span>}</div></td>
              <td className="py-4 px-6"><Status estado={t.estado} /></td>
              <td className="py-4 px-6 text-right"><Link href={`/superadmin/tenants/${t.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 border border-slate-700 transition-colors"><Settings className="w-3.5 h-3.5" />Gestionar</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}

function Status({estado}:{estado:string}) {
  if (estado === "activo") return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" />Activo</span>;
  if (estado === "prueba") return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><AlertCircle className="w-3 h-3" />Prueba</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"><X className="w-3 h-3" />{estado === "suspendido" ? "Suspendido" : "Cancelado"}</span>;
}
