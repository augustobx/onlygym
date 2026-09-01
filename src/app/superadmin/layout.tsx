import Link from "next/link";
import { getSuperAdminSession } from "@/lib/superadmin-auth";
import { Shield, LayoutDashboard, Building2, Layers, CheckCircle2 } from "lucide-react";
import SuperAdminLogoutButton from "./SuperAdminLogoutButton";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSuperAdminSession();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/superadmin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white flex items-center gap-1.5 text-sm">
              OnlyGym
              <span className="text-[10px] font-semibold uppercase bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">SuperAdmin</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link href="/superadmin" className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" /> Métricas
            </Link>
            <Link href="/superadmin/tenants" className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" /> Gimnasios / Tenants
            </Link>
            <Link href="/superadmin/planes" className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Planes SaaS
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border border-slate-800 px-2.5 py-1 rounded-full bg-slate-900">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Servidor Debian OK</span>
          </div>
          {session ? <SuperAdminLogoutButton /> : null}
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
