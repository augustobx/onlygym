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
  secondary?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sucursalNombre, setSucursalNombre] = useState("Sucursal activa");
  const [userName, setUserName] = useState("Administrador");
  const [userRole, setUserRole] = useState("ADMIN");
  const [tenantName, setTenantName] = useState("OnlyGym");
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

  const operationsRoles = ["OWNER", "ADMIN", "RECEPCION"];
  const navigationGroups: NavGroup[] = [
    {
      label: "Inicio",
      items: [
        { href: "/dashboard", label: "Resumen", description: "Lo importante de la sede hoy", icon: LayoutDashboard },
        { href: "/dashboard/entrenador", label: "Mi trabajo", description: "Socios y tareas del entrenador", icon: UserCheck, roles: ["ENTRENADOR"] },
      ],
    },
    {
      label: "Socios",
      items: [
        { href: "/dashboard/clientes", label: "Padrón de socios", description: "Altas, fichas y estado de membresía", icon: Users, roles: operationsRoles, module: "socios" },
        { href: "/dashboard/pagos", label: "Cobrar membresía", description: "Renovaciones y pagos", icon: CreditCard, roles: operationsRoles, module: "membresias", secondary: true },
        { href: "/dashboard/cuentas", label: "Cuentas corrientes", description: "Deudas, abonos y límites", icon: Receipt, roles: operationsRoles, secondary: true },
      ],
    },
    {
      label: "Entrenamiento",
      items: [
        { href: "/dashboard/entrenamiento", label: "Rutinas y planes", description: "Objetivos, rutinas y asignaciones", icon: Dumbbell, module: "entrenamiento" },
        { href: "/dashboard/clases", label: "Clases y reservas", description: "Agenda, cupos y asistencia", icon: CalendarDays, module: "clases" },
        { href: "/dashboard/entrenadores", label: "Entrenadores", description: "Equipo de profesores", icon: UserCheck, roles: ["OWNER", "ADMIN"], secondary: true },
        { href: "/dashboard/mediciones", label: "Mediciones y progreso", description: "Evolución física de socios", icon: Ruler, module: "mediciones", secondary: true },
        { href: "/dashboard/recompensas", label: "Puntos y beneficios", description: "Fidelización y premios", icon: Trophy, roles: ["OWNER", "ADMIN"], module: "puntos", secondary: true },
      ],
    },
    {
      label: "Operación",
      items: [
        { href: "/dashboard/caja", label: "Ventas / POS", description: "Venta de productos y consumos", icon: ShoppingCart, roles: operationsRoles, module: "caja" },
        { href: "/dashboard/productos", label: "Productos y stock", description: "Catálogo e inventario", icon: Store, roles: operationsRoles, module: "caja", secondary: true },
        { href: "/dashboard/aforo", label: "Aforo y salidas", description: "Personas dentro de la sede", icon: Activity, module: "accesos", secondary: true },
      ],
    },
    {
      label: "Administración",
      items: [
        { href: "/dashboard/reportes", label: "Reportes", description: "Indicadores y finanzas", icon: BarChart3, roles: ["OWNER", "ADMIN"], module: "reportes" },
        { href: "/dashboard/empleados", label: "Personal y permisos", description: "Usuarios internos y accesos", icon: UserCheck, roles: ["OWNER", "ADMIN"], secondary: true },
        { href: "/dashboard/configuracion", label: "Sedes y configuración", description: "Horarios y parámetros", icon: Settings, roles: ["OWNER", "ADMIN"], secondary: true },
        { href: "/dashboard/seguridad", label: "Seguridad y auditoría", description: "Sesiones y actividad administrativa", icon: ShieldAlert, roles: ["OWNER", "ADMIN"], secondary: true },
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

  const canUseTurnstile = operationsRoles.includes(userRole);
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
        className={`${item.secondary ? "ml-3 border-l border-slate-800 pl-3" : ""} flex items-center gap-2.5 rounded-r-lg py-2 pr-2.5 text-xs transition-all ${
          item.secondary ? "rounded-l-none" : "rounded-l-lg pl-2.5"
        } ${
          isActive
            ? "bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white shadow-xs shadow-cyan-600/20"
            : item.secondary
              ? "font-medium text-slate-400 hover:bg-slate-900 hover:text-white"
              : "font-semibold text-slate-200 hover:bg-slate-900 hover:text-white"
        }`}
      >
        <Icon className={`${item.secondary ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 ${isActive ? "text-white" : item.secondary ? "text-slate-500" : "text-slate-400"}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased md:flex-row">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600"><Dumbbell className="h-4 w-4" /></div><span className="text-sm font-bold">OnlyGym</span></Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300" aria-label="Abrir menú">{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>

      <aside className={`${mobileMenuOpen ? "block" : "hidden"} z-30 w-full shrink-0 border-r border-slate-800/90 bg-slate-950 text-slate-300 md:sticky md:top-0 md:flex md:h-screen md:w-72 md:flex-col`}>
        <div className="border-b border-slate-800/80 p-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" title="Ir al resumen"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 text-white"><Dumbbell className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-1.5"><span className="text-sm font-bold leading-none text-white">OnlyGym</span><span className="rounded border border-cyan-700/60 bg-cyan-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-300">PRO</span></div><span className="mt-1 block max-w-48 truncate text-[11px] font-medium text-slate-400">{tenantName}</span></div></Link>
        </div>

        <div className="px-3 pb-1 pt-3">
          <Link href="/seleccionar-sucursal" className="group flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2.5 text-xs hover:border-cyan-500/40"><div className="flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" /><div className="min-w-0"><span className="block text-[10px] font-semibold uppercase leading-none text-slate-400">Sucursal activa</span><span className="mt-1 block truncate text-xs font-bold text-white">{sucursalNombre}</span></div></div><ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-cyan-400" /></Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-4">
            {navigationGroups.map((group) => (
              <section key={group.label}>
                <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{group.label}</div>
                <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>
                {group.label === "Operación" && canUseTurnstile && (
                  <a href="/molinete" target="_blank" rel="noreferrer" className="ml-3 mt-0.5 flex items-center justify-between border-l border-slate-800 py-2 pl-3 pr-2.5 text-xs font-medium text-cyan-300 hover:bg-cyan-950/40" title="Abrir terminal de ingreso"><span className="flex items-center gap-2.5"><ExternalLink className="h-3.5 w-3.5 text-cyan-400" />Molinete / ingreso</span><ExternalLink className="h-3 w-3 text-slate-500" /></a>
                )}
              </section>
            ))}
          </div>
        </nav>

        <div className="space-y-2 border-t border-slate-800/80 p-3">
          <PWAInstallPrompt variant="sidebar" appName="OnlyGym Admin" />
          <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-2 py-1.5"><div className="flex min-w-0 items-center gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-cyan-700 to-blue-800 text-xs font-bold text-white">{userName.charAt(0).toUpperCase()}</div><div className="truncate"><p className="truncate text-xs font-semibold leading-tight text-white">{userName}</p><p className="text-[10px] font-mono leading-none text-cyan-400">{userRole}</p></div></div><button onClick={handleLogout} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs sm:px-6">
          <div className="min-w-0"><div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Link href="/dashboard" className="hover:text-cyan-700">Inicio</Link>{pathname !== "/dashboard" && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate font-bold text-slate-900">{currentNav.label}</span></>}</div>{pathname !== "/dashboard" && <p className="mt-0.5 hidden text-[10px] font-medium text-slate-400 lg:block">{currentNav.description}</p>}</div>
          <div className="flex items-center gap-2.5"><Link href="/seleccionar-sucursal" className="hidden items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900 sm:flex" title="Cambiar sucursal"><MapPin className="h-3 w-3 text-cyan-600" />{sucursalNombre}</Link>{canConfigure && <Link href="/dashboard/configuracion" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Sedes y configuración"><Settings className="h-4 w-4" /></Link>}</div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
