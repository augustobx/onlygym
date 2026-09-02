import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantDetailSuperAdmin } from "@/app/actions/superadmin";
import {
  Building2,
  ChevronRight,
  ExternalLink,
  CreditCard,
  Users,
  Activity,
  CheckCircle2,
  Shield,
  ArrowLeft,
} from "lucide-react";
import TenantDetailActions from "./TenantDetailActions";
import TenantAdminCredentials from "./TenantAdminCredentials";
import { TenantStatusBadge } from "../../page";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = parseInt(id, 10);
  if (isNaN(tenantId)) notFound();

  const result = await getTenantDetailSuperAdmin(tenantId);
  if (!result.success || !result.data) {
    notFound();
  }

  const { tenant, planes } = result.data as any;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Link href="/superadmin" className="hover:text-white transition">
            Plataforma
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <Link href="/superadmin/tenants" className="hover:text-white transition">
            Gimnasios
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-cyan-400">{tenant.nombre}</span>
        </div>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 grid place-items-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/20 shrink-0">
              {tenant.nombre.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {tenant.nombre}
                </h1>
                <TenantStatusBadge estado={tenant.estado} />
              </div>
              <a
                href={`https://${tenant.slug}.nanoapps.ar`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline mt-1"
              >
                https://{tenant.slug}.nanoapps.ar <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <Link
            href="/superadmin/tenants"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 border border-white/10 transition self-start sm:self-center"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a la lista
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard label="Socios Totales" value={tenant._count?.clientes || 0} icon={Users} />
        <MetricCard label="Sedes / Sucursales" value={tenant._count?.sucursales || 0} icon={Building2} />
        <MetricCard label="Usuarios Staff" value={tenant._count?.usuarios || 0} icon={Shield} />
        <MetricCard label="Clases Creadas" value={tenant._count?.clases || 0} icon={Activity} />
        <MetricCard label="Pagos Socios" value={tenant._count?.pagos || 0} icon={CreditCard} />
        <MetricCard label="Check-ins Totales" value={tenant._count?.ingresos || 0} icon={CheckCircle2} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TenantDetailActions tenant={tenant} planes={planes} />
          <TenantAdminCredentials tenantId={tenant.id} usuarios={tenant.usuarios || []} />
        </div>

        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-[#121824] border border-white/8 space-y-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" /> Facturación SaaS
            </h2>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Plan actual:</span>
                <span className="font-bold text-white">{tenant.planSaaS?.nombre || "Sin Plan"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Precio mensual:</span>
                <span className="font-bold text-cyan-400">
                  ${Number(tenant.planSaaS?.precioMensual || 0).toLocaleString("es-AR")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Vencimiento:</span>
                <span className="font-bold text-white">
                  {tenant.fechaVencimiento
                    ? new Date(tenant.fechaVencimiento).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "No configurado"}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Historial de Pagos SaaS
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tenant.suscripciones.flatMap((s: any) => s.pagosPlataforma || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Sin pagos registrados aún.</p>
                ) : (
                  tenant.suscripciones
                    .flatMap((s: any) => s.pagosPlataforma || [])
                    .map((pago: any) => (
                      <div key={pago.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">${Number(pago.monto).toLocaleString("es-AR")}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(pago.fechaPago).toLocaleDateString("es-AR")} · {pago.metodoPago}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {pago.estado}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="p-4 rounded-2xl bg-[#121824] border border-white/8 flex flex-col justify-between">
      <div className="flex items-center justify-between text-slate-500 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
      </div>
      <p className="text-xl font-black text-white">{value.toLocaleString("es-AR")}</p>
    </div>
  );
}
