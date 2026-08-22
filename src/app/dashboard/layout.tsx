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
  Sparkles,
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

    // Obtener sesión
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

  // Helper para breadcrumb
  const currentNav = navItems.find((n) => n.href === pathname) || { label: "Gestión" };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-950 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">GymLink</span>
            <span className="ml-1 text-[10px] bg-slate-800 text-slate-300 font-semibold px-1.5 py-0.5 rounded border border-slate-700">PRO</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/molinete"
            target="_blank"
            className="p-1.5 bg-slate-900 border border-slate-800 text-indigo-400 rounded-lg text-xs"
            title="Pantalla de Molinete"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-950 text-slate-300 flex flex-col justify-between border-r border-slate-800/80 z-50 transition-transform duration-200 md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand & Sede Selector */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Dumbbell className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white leading-none">GymLink</h1>
                <span className="text-[10px] text-slate-500 font-medium">Enterprise Backoffice</span>
              </div>
            </div>

            <span className="text-[9px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono font-bold px-1.5 py-0.5 rounded">
              v2.5
            </span>
          </div>

          {/* Sede Activa Switcher */}
          <Link
            href="/seleccionar-sucursal"
            onClick={() => setMobileMenuOpen(false)}
            className="group flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg transition"
            title="Cambiar sede de operación"
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Sede Activa</span>
                <span className="text-xs font-semibold text-slate-200 truncate block">{sucursalNombre}</span>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition" />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 scrollbar-thin">
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Módulos Principales
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition font-medium ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/70"
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Accesos Rápidos
          </div>

          <Link
            href="/molinete"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-900/70 transition font-medium"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Pantalla Molinete</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </Link>
        </nav>

        {/* Footer Sidebar & User */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="h-7 w-7 rounded-md bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
                <span className="text-[10px] text-slate-500 font-mono block">{userRole}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Workspace Surface */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar Header */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-slate-200/80 px-6 py-3 sticky top-0 z-30">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">GymLink</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-slate-900 font-semibold">{currentNav.label}</span>
          </div>

          {/* Quick Actions & Sede Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              <span className="font-medium">{sucursalNombre}</span>
            </div>

            <Link
              href="/molinete"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium transition"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>Molinete</span>
            </Link>

            <PWAInstallPrompt variant="button" appName="GymLink Admin" />
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
