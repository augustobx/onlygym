import Link from "next/link";
import { getPlanesSaaS } from "@/app/actions/superadmin";
import { Layers, ChevronRight } from "lucide-react";
import PlanesManager from "./PlanesManager";

export const dynamic = "force-dynamic";

export default async function SuperAdminPlanesPage() {
  const result = await getPlanesSaaS();
  const planes = result.success && result.data ? (result.data as any[]) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Link href="/superadmin" className="hover:text-white transition">
            Plataforma
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-cyan-400">Planes Comerciales</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
          Planes Comerciales SaaS
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configuración dinámica de precios, límites de usuarios, sedes, socios y módulos incluidos
        </p>
      </div>

      <PlanesManager initialPlanes={planes} />
    </div>
  );
}
