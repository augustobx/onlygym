import Link from "next/link";
import { getTenantsSuperAdmin, getPlanesSaaS } from "@/app/actions/superadmin";
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Users,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";
import CreateTenantModal from "./CreateTenantModal";
import { TenantStatusBadge } from "../page";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; estado?: string; page?: string; action?: string }>;
}) {
  const params = await searchParams;
  const result = await getTenantsSuperAdmin({
    search: params.search,
    estado: params.estado,
    page: params.page ? parseInt(params.page, 10) : 1,
  });

  const planesResult = await getPlanesSaaS();
  const planes = planesResult.success && planesResult.data ? (planesResult.data as any[]) : [];

  const data = result.success && result.data ? (result.data as any) : { tenants: [], total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/superadmin" className="text-xs font-bold text-slate-400 hover:text-white transition">
              Plataforma
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-cyan-400">Gimnasios</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Gimnasios y Tenants
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Administración de comercios, dominios, membresías y suscripciones
          </p>
        </div>

        <CreateTenantModal planes={planes} defaultOpen={params.action === "nuevo"} />
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {["todos", "activo", "prueba", "suspendido", "cancelado"].map((st) => (
            <Link
              key={st}
              href={`/superadmin/tenants?estado=${st}${params.search ? `&search=${encodeURIComponent(params.search)}` : ""}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition shrink-0 ${
                (params.estado || "todos") === st
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {st}
            </Link>
          ))}
        </div>

        <form method="GET" action="/superadmin/tenants" className="w-full sm:w-72 relative">
          {params.estado && <input type="hidden" name="estado" value={params.estado} />}
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={params.search || ""}
            placeholder="Buscar por nombre o slug..."
            className="w-full h-10 bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </form>
      </div>

      {/* Tenants List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.tenants.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl bg-[#121824] border border-white/8 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-white">No se encontraron gimnasios</h3>
            <p className="text-xs mt-1 text-slate-400">Probá modificando los filtros de búsqueda</p>
          </div>
        ) : (
          data.tenants.map((tenant: any) => (
            <div
              key={tenant.id}
              className="p-5 rounded-3xl bg-[#121824] border border-white/8 hover:border-cyan-500/30 transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 font-black grid place-items-center text-sm shadow-inner">
                    {tenant.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <TenantStatusBadge estado={tenant.estado} />
                </div>

                <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition truncate">
                  {tenant.nombre}
                </h3>

                <a
                  href={`https://${tenant.slug}.nanoapps.ar`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline mt-1 break-all"
                >
                  https://{tenant.slug}.nanoapps.ar <ExternalLink className="w-3 h-3 shrink-0" />
                </a>

                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tenant.planSaaS?.nombre || "Sin Plan"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tenant._count?.clientes || 0} socios</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tenant._count?.sucursales || 1} sedes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {tenant.fechaVencimiento
                        ? `Vence ${new Date(tenant.fechaVencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`
                        : "Sin fecha"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500">
                  Alta: {new Date(tenant.creadoEn).toLocaleDateString("es-AR")}
                </span>
                <Link
                  href={`/superadmin/tenants/${tenant.id}`}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500 hover:text-slate-950 text-xs font-bold text-white border border-white/10 transition"
                >
                  Ficha Completa
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
