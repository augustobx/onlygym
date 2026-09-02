"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Dumbbell,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  Ruler,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Store,
  Trophy,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
  roles?: string[];
  module?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sucursal activa");
  const [userName, setUserName] = useState<string>("Administrador");
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [tenantName, setTenantName] = useState<string>("OnlyGym");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modules, setModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void getStaffNavigationContext().then((result) => {
      const storedBranchName = localStorage.getItem("activeSucursalName");
      if (storedBranchName) setSucursalNombre(storedBranchName);

      if (result.success && result.data) {
        setUserName(result.data.name);
        setUserRole(result.data.role);
        setModules(result.data.modules);
        setTenantName(result.data.tenantName);
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
      localStorage.removeItem("activeSucursalId");
      localStorage.removeItem("activeSucursalName");
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  };

  const canShow = (item: NavItem) =>
    (!item.roles || item.roles.includes(userRole)) && (!item.module || modules[item.module] !== false);

  const navigationGroups: NavGroup[] = [
    {
      label: "Inicio",
      items: [
        { href: "/dashboard", label: "Resumen", description: "Estado general de la sede", icon: LayoutDashboard },
        { href: "/dashboard/entrenador", label: "Mi trabajo", description: "Panel personal del entrenador", icon: UserCheck, roles: ["ENTRENADOR"] },
      ],
    },
    {
      label: "Socios y cobros",
      items: [
        { href: "/dashboard/clientes", label: "Socios", description: "Fichas, altas y estado de membresía", icon: Users, roles: ["OWNER", "ADMIN", "RECEPCION"], module: "socios" },
        { href: "/dashboard/pagos", label: "Cobros", description: "Renovaciones y pagos de membresías", icon: CreditCard },
        { href: "/dashboard/cuentas", label: "Cuentas corrientes", description: "Deudas, abonos y límites", icon: Receipt },
      ],
    },
    {
      label: "Entrenamiento",
      items: [
        { href: "/dashboard/entrenadores", label: "Entrenadores", description: "Equipo de profesores", icon: UserCheck, roles: ["OWNER", "ADMIN"] },
        { href: "/dashboard/entrenamiento", label: "Rutinas y planes", description: "Planificación del entrenamiento", icon: Dumbbell, module: "entrenamiento" },
        { href: "/dashboard/clases", label: "Clases", description: "Agenda, cupos y reservas", icon: CalendarDays, module: "clases" },
        { href: "/dashboard/mediciones", label: "Progreso", description: "Mediciones y evolución", icon: Ruler, module: "mediciones" },
        { href: "/dashboard/recompensas", label: "Beneficios", description: "Puntos, premios y fidelización", icon: Trophy, roles: ["ADMIN", "OWNER"], module: "puntos" },
      ],
    },
    {
      label: "Operación de sede",
      items: [
        { href: "/dashboard/caja", label: "Ventas", description: "Caja y punto de venta", icon: ShoppingCart },
        { href: "/dashboard/productos", label: "Productos y stock", description: "Inventario de la sede", icon: Store },
        { href: "/dashboard/aforo", label: "Aforo", description: "Personas dentro del gimnasio", icon: Activity },
      ],
    },
    {
      label: "Gestión",
      items: [
        { href: "/dashboard/reportes", label: "Reportes", description: "Indicadores y finanzas", icon: BarChart3, roles: ["ADMIN", "OWNER"], module: "reportes" },
        { href: "/dashboard/empleados", label: "Personal y accesos", description: "Usuarios internos y permisos", icon: UserCheck, roles: ["ADMIN", "OWNER"] },
        { href: "/dashboard/configuracion", label: "Sedes y configuración", description: "Horarios y parámetros", icon: Settings, roles: ["ADMIN", "OWNER"] },
        { href: "/dashboard/seguridad", label: "Seguridad", description: "Sesiones y auditoría", icon: ShieldAlert, roles: ["ADMIN", "OWNER"] },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter(canShow) }))
    .filter((group) => group.items.length > 0);

  const flatNavItems = navigationGroups.flatMap((group) => group.items);
  const currentNav = [...flatNavItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`))) || {
      label: "Gestión",
      description: "Panel administrativo",
      href: "/dashboard",
    };

  const canUseTurnstile = ["OWNER", "ADMIN", "RECEPCION"].includes(userRole);
  const canConfigure = ["OWNER", "ADMIN"].includes(userRole);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        title={item.description}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all ${
          isActive
            ? "bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white shadow-xs shadow-cyan-600/30"
            : "font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
        }`}
      >
        <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      <div className="md:hidden bg-slate-950 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">OnlyGym</span>
            <span className="ml-1 text-[10px] bg-cyan-950/80 text-cyan-300 font-semibold px-1.5 py-0.5 rounded border border-cyan-800/60">PRO</span>
          </div>
        </Link>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white" aria-label="Abrir menú">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside className={`${mobileMenuOpen ? "block" : "hidden"} md:flex flex-col w-full md:w-72 bg-slate-950 border-r border-slate-800/90 text-slate-300 flex-shrink-0 z-30 md:sticky md:top-0 md:h-screen`}>
        <div className="p-4 border-b border-slate-800/80">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" title="Ir al resumen">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-xs shadow-cyan-500/20">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight leading-none">OnlyGym</span>
                <span className="text-[9px] bg-cyan-950/90 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-700/60 uppercase">PRO</span>
              </div>
              <span className="block max-w-48 truncate text-[11px] font-medium text-slate-400">{tenantName}</span>
            </div>
          </Link>
        </div>

        <div className="px-3 pt-3 pb-1">
          <Link href="/seleccionar-sucursal" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs transition group">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Sucursal activa</span>
                <span className="text-xs font-bold text-white truncate block mt-1">{sucursalNombre}</span>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition flex-shrink-0" />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-3">
            {navigationGroups.map((group) => (
              <section key={group.label}>
                <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{group.label}</div>
                <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>

                {group.label === "Operación de sede" && canUseTurnstile && (
                  <a
                    href="/molinete"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-950/50 hover:text-cyan-200 transition"
                    title="Abrir terminal de control de ingreso"
                  >
                    <span className="flex items-center gap-2.5">
                      <ExternalLink className="h-4 w-4 text-cyan-400" />
                      Molinete / ingreso
                    </span>
                    <ExternalLink className="h-3 w-3 text-slate-500" />
                  </a>
                )}
              </section>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <PWAInstallPrompt variant="sidebar" appName="OnlyGym Admin" />

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

            <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Link href="/dashboard" className="text-slate-600 hover:text-cyan-700 transition">Inicio</Link>
              {pathname !== "/dashboard" && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-900 font-bold truncate">{currentNav.label}</span>
                </>
              )}
            </div>
            {pathname !== "/dashboard" && <p className="hidden lg:block mt-0.5 text-[10px] font-medium text-slate-400">{currentNav.description}</p>}
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/seleccionar-sucursal" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-900 border border-cyan-200 text-xs font-semibold" title="Cambiar sucursal">
              <MapPin className="h-3 w-3 text-cyan-600" />
              <span>{sucursalNombre}</span>
            </Link>

            {canConfigure && (
              <Link href="/dashboard/configuracion" className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition" title="Sedes y configuración">
                <Settings className="h-4 w-4" />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
