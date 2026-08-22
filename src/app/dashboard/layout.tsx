"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Users, 
  CreditCard, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  LayoutDashboard, 
  ShoppingCart, 
  Store, 
  MapPin, 
  ChevronDown, 
  UserCheck, 
  Activity, 
  BarChart3, 
  Menu, 
  X,
  Dumbbell,
  Receipt,
  Smartphone,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");
  const [sucursalId, setSucursalId] = useState<string>("1");
  const [userName, setUserName] = useState<string>("Administrador");
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const sName = localStorage.getItem("activeSucursalName");
    const sId = localStorage.getItem("activeSucursalId");
    if (sName) setSucursalNombre(sName);
    if (sId) setSucursalId(sId);

    fetch("/api/auth/get-session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.session && data.session.user) {
          setUserName(data.session.user.name || "Administrador");
          setUserRole(data.session.user.role || "ADMIN");
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { credentials: "include" });
      localStorage.removeItem("activeSucursalId");
      localStorage.removeItem("activeSucursalName");
      router.push("/login");
    } catch (e) {
      router.push("/login");
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Inicio / Resumen", icon: LayoutDashboard },
    { href: "/dashboard/clientes", label: "Socios (Ficha 360)", icon: Users },
    { href: "/dashboard/pagos", label: "Cobro de Cuotas", icon: CreditCard },
    { href: "/dashboard/cuentas", label: "Cuentas Corrientes", icon: Receipt },
    { href: "/dashboard/caja", label: "Punto de Venta / POS", icon: ShoppingCart },
    { href: "/dashboard/productos", label: "Inventario & Stock", icon: Store },
    { href: "/dashboard/aforo", label: "Aforo en Vivo", icon: Activity },
    { href: "/dashboard/reportes", label: "Reportes & Finanzas", icon: BarChart3 },
    { href: "/dashboard/empleados", label: "Personal & Accesos", icon: UserCheck },
    { href: "/dashboard/configuracion", label: "Configuración & Sedes", icon: Settings },
  ];

  const currentNav = navItems.find((n) => n.href === pathname) || { label: "Gestión" };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-950 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">GymLink</span>
            <span className="ml-1 text-[10px] bg-cyan-950/80 text-cyan-300 font-semibold px-1.5 py-0.5 rounded border border-cyan-800/60">PRO</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Desktop (Linear style deep navy with ocean/cyan highlights) */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:flex flex-col w-full md:w-64 bg-slate-950 border-r border-slate-800/90 text-slate-300 flex-shrink-0 z-30 md:sticky md:top-0 md:h-screen`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-xs shadow-cyan-500/20">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight leading-none">GymLink</span>
                <span className="text-[9px] bg-cyan-950/90 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-700/60 uppercase">PRO</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Gestión & Molinetes</span>
            </div>
          </Link>
        </div>

        {/* Current Active Branch Indicator */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/seleccionar-sucursal"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs transition group"
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Sede en operación</span>
                <span className="text-xs font-bold text-white truncate block mt-0.5">{sucursalNombre}</span>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition flex-shrink-0" />
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Módulos</div>
          
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold shadow-xs shadow-cyan-600/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-cyan-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Terminal</div>
          <Link
            href="/molinete"
            target="_blank"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/50 transition"
          >
            <div className="flex items-center gap-2 truncate">
              <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
              <span>Abrir Molinete</span>
            </div>
            <span className="text-[9px] bg-cyan-900/60 text-cyan-200 px-1.5 py-0.5 rounded font-mono font-bold">5m</span>
          </Link>
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <PWAInstallPrompt variant="sidebar" appName="GymLink Admin" />

          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-700 to-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate leading-tight">{userName}</p>
                <p className="text-[10px] text-cyan-400 font-mono leading-none">{userRole}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Surface */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header / Breadcrumbs */}
        <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Link href="/dashboard" className="text-slate-600 hover:text-cyan-700 transition">
              Dashboard
            </Link>
            {pathname !== "/dashboard" && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-900 font-bold">{currentNav.label}</span>
              </>
            )}
          </div>

          {/* Right Header Status */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-900 border border-cyan-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              <span>{sucursalNombre}</span>
            </div>

            <Link
              href="/dashboard/configuracion"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
              title="Configuración"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
