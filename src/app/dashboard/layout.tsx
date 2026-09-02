"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import AreaOperationsNav from "@/components/AreaOperationsNav";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

type PrimaryItem = {
  key: "inicio" | "socios" | "entrenamiento" | "operacion" | "gestion" | "entrenador";
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
};

const operationsRoles = ["OWNER", "ADMIN", "RECEPCION"];

function areaForPath(pathname: string) {
  if (pathname === "/dashboard") return "inicio" as const;
  if (pathname === "/dashboard/entrenador" || pathname.startsWith("/dashboard/entrenador/")) return "entrenador" as const;
  if (["/dashboard/clientes", "/dashboard/pagos", "/dashboard/cuentas", "/dashboard/recompensas"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return "socios" as const;
  if (["/dashboard/entrenamiento", "/dashboard/clases", "/dashboard/entrenadores", "/dashboard/mediciones"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return "entrenamiento" as const;
  if (["/dashboard/caja", "/dashboard/productos", "/dashboard/aforo"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return "operacion" as const;
  if (["/dashboard/reportes", "/dashboard/empleados", "/dashboard/configuracion", "/dashboard/seguridad"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return "gestion" as const;
  return "inicio" as const;
}

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
      if (!result.success || !result.data) {
        localStorage.removeItem("activeSucursalId");
        localStorage.removeItem("activeSucursalName");
        router.replace("/login");
        return;
      }

      setUserName(result.data.name);
      setUserRole(result.data.role);
      setModules(result.data.modules);
      setTenantName(result.data.tenantName);

      if (!result.data.branchId || !result.data.branchName) {
        localStorage.removeItem("activeSucursalId");
        localStorage.removeItem("activeSucursalName");
        router.replace("/seleccionar-sucursal");
        return;
      }

      setSucursalNombre(result.data.branchName);
      localStorage.setItem("activeSucursalId", String(result.data.branchId));
      localStorage.setItem("activeSucursalName", result.data.branchName);
    });
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    } finally {
      localStorage.removeItem("activeSucursalId");
      localStorage.removeItem("activeSucursalName");
      router.replace("/login");
      router.refresh();
    }
  };

  const activeArea = areaForPath(pathname);
  const moduleEnabled = (key: string) => modules[key] !== false;
  const canOperate = operationsRoles.includes(userRole);
  const canManage = ["OWNER", "ADMIN"].includes(userRole);
  const receptionMode = userRole === "RECEPCION";
  const hasTraining = receptionMode
    ? moduleEnabled("clases")
    : moduleEnabled("entrenamiento") || moduleEnabled("clases") || moduleEnabled("mediciones");
  const trainingHome = receptionMode ? "/dashboard/clases" : "/dashboard/entrenamiento";
  const trainingDescription = receptionMode ? "Agenda, reservas y asistencia" : "Rutinas, clases, entrenadores y progreso";

  const primaryItems: PrimaryItem[] = [
    { key: "inicio", href: "/dashboard", label: "Resumen", description: "Lo importante de la sede hoy", icon: LayoutDashboard },
    ...(userRole === "ENTRENADOR" ? [{ key: "entrenador" as const, href: "/dashboard/entrenador", label: "Mi trabajo", description: "Socios y tareas asignadas", icon: UserCheck }] : []),
    ...(canOperate && moduleEnabled("socios") ? [{ key: "socios" as const, href: "/dashboard/clientes", label: "Socios", description: "Altas, membresías, cobros y cuentas", icon: Users }] : []),
    ...(hasTraining ? [{ key: "entrenamiento" as const, href: trainingHome, label: "Entrenamiento", description: trainingDescription, icon: Dumbbell }] : []),
    ...(canOperate && moduleEnabled("caja") ? [{ key: "operacion" as const, href: "/dashboard/caja", label: "Operación", description: "Ventas, stock, aforo y caja", icon: ShoppingCart }] : []),
    ...(canManage ? [{ key: "gestion" as const, href: "/dashboard/reportes", label: "Gestión", description: "Reportes, personal y configuración", icon: Building2 }] : []),
  ];

  const activeItem = primaryItems.find((item) => item.key === activeArea) || primaryItems[0];
  const canUseTurnstile = canOperate && moduleEnabled("accesos");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased md:flex-row">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600"><Dumbbell className="h-4 w-4" /></span>
          <span><strong className="block text-sm leading-none">OnlyGym</strong><small className="mt-1 block max-w-44 truncate text-[10px] font-semibold text-slate-400">{tenantName}</small></span>
        </Link>
        <button onClick={() => setMobileMenuOpen((value) => !value)} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300" aria-label="Abrir menú">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside className={`${mobileMenuOpen ? "flex" : "hidden"} z-40 w-full shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 md:sticky md:top-0 md:flex md:h-screen md:w-64`}>
        <div className="border-b border-slate-800 p-4">
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/30"><Dumbbell className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-black text-white">OnlyGym</span><span className="block truncate text-[11px] font-semibold text-slate-400">{tenantName}</span></span>
          </Link>
        </div>

        <div className="px-3 pt-3">
          <Link href="/seleccionar-sucursal" onClick={() => setMobileMenuOpen(false)} className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" /><span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Sede activa</span><strong className="mt-0.5 block truncate text-white">{sucursalNombre}</strong></span></span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-cyan-400" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Áreas principales">
          <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Áreas de trabajo</p>
          <div className="space-y-1">
            {primaryItems.map(({ key, href, label, description, icon: Icon }) => {
              const active = activeArea === key;
              return (
                <Link
                  key={key}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  title={description}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
                  <span className="min-w-0"><strong className="block text-xs">{label}</strong><small className={`mt-0.5 hidden truncate text-[9px] font-medium xl:block ${active ? "text-cyan-100" : "text-slate-600"}`}>{description}</small></span>
                </Link>
              );
            })}
          </div>

          {canUseTurnstile && (
            <div className="mt-5 border-t border-slate-800 pt-3">
              <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Terminal</p>
              <a href="/molinete" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-950/40">
                <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" />Ingreso / molinete</span><ExternalLink className="h-3 w-3 text-slate-600" />
              </a>
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-slate-800 p-3">
          <PWAInstallPrompt variant="sidebar" appName="OnlyGym Admin" />
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-900 text-xs font-black text-cyan-100">{userName.charAt(0).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-xs text-white">{userName}</strong><small className="block text-[9px] font-mono text-cyan-400">{userRole}</small></span></span>
            <button onClick={handleLogout} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Link href="/dashboard" className="hover:text-cyan-700">Inicio</Link>{activeArea !== "inicio" && <><ChevronRight className="h-3.5 w-3.5" /><strong className="truncate text-slate-900">{activeItem?.label || "Panel"}</strong></>}</div>
            {activeArea !== "inicio" && <p className="mt-0.5 hidden text-[10px] font-medium text-slate-400 lg:block">{activeItem?.description}</p>}
          </div>
          <div className="flex items-center gap-2"><Link href="/seleccionar-sucursal" className="hidden items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-950 sm:flex"><MapPin className="h-3 w-3 text-cyan-600" />{sucursalNombre}</Link>{canManage && <Link href="/dashboard/configuracion" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950" title="Configuración"><Settings className="h-4 w-4" /></Link>}</div>
        </header>

        <AreaOperationsNav pathname={pathname} userRole={userRole} modules={modules} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
