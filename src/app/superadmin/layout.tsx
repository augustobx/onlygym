import { redirect } from "next/navigation";
import Link from "next/link";
import { getSuperAdminSession } from "@/lib/superadmin-auth";
import {
  Shield,
  Building2,
  CreditCard,
  Activity,
  Layers,
  LogOut,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import SuperAdminLogoutButton from "./SuperAdminLogoutButton";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSuperAdminSession();

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row antialiased selection:bg-cyan-500 selection:text-black">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 shrink-0 bg-[#0d131f] border-b md:border-b-0 md:border-r border-white/8 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-white/8 flex items-center justify-between">
            <Link href="/superadmin" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 grid place-items-center text-slate-950 font-black shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
                <Shield className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <span className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                  OnlyGym <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">SaaS</span>
                </span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano Central</p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <NavItem href="/superadmin" icon={Activity} label="Dashboard Global" />
            <NavItem href="/superadmin/tenants" icon={Building2} label="Gimnasios & Tenants" />
            <NavItem href="/superadmin/planes" icon={Layers} label="Planes Comerciales" />
          </nav>
        </div>

        {/* User Info & Footer */}
        <div className="p-4 border-t border-white/8 bg-[#090d16]/50">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-white">{session?.nombre || "SuperAdmin"}</p>
              <p className="text-[10px] text-slate-400 truncate">{session?.email || "admin@nanolabs.ar"}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <Link
              href="/"
              target="_blank"
              className="text-[11px] font-bold text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
            >
              Ver Portal <ExternalLink className="w-3 h-3" />
            </Link>
            <SuperAdminLogoutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header bar */}
        <header className="h-16 px-6 border-b border-white/8 bg-[#0d131f]/60 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <span>Plataforma</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-cyan-400">NanoLabs Cloud v4</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Router Activo
            </span>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition group"
    >
      <Icon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition" />
      <span>{label}</span>
    </Link>
  );
}
