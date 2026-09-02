"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  History,
  PackageSearch,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCheck,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: typeof Dumbbell;
  roles?: string[];
  module?: string;
};

type Props = {
  pathname: string;
  userRole: string;
  modules: Record<string, boolean>;
};

const trainingItems: Item[] = [
  { href: "/dashboard/entrenamiento", label: "Planificación", icon: Dumbbell, module: "entrenamiento" },
  { href: "/dashboard/clases", label: "Clases y reservas", icon: CalendarDays, module: "clases" },
  { href: "/dashboard/entrenadores", label: "Entrenadores", icon: UserCheck, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/mediciones", label: "Progreso", icon: ClipboardList, module: "mediciones" },
];

const operationItems: Item[] = [
  { href: "/dashboard/caja", label: "Ventas", icon: ShoppingCart, module: "caja" },
  { href: "/dashboard/caja/movimientos", label: "Arqueo y movimientos", icon: History, module: "caja" },
  { href: "/dashboard/productos", label: "Productos y stock", icon: PackageSearch, module: "caja" },
  { href: "/dashboard/aforo", label: "Aforo y salidas", icon: Activity, module: "accesos" },
];

const managementItems: Item[] = [
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, roles: ["OWNER", "ADMIN"], module: "reportes" },
  { href: "/dashboard/empleados", label: "Personal", icon: UserCheck, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/seguridad", label: "Seguridad", icon: ShieldCheck, roles: ["OWNER", "ADMIN"] },
];

function groupFor(pathname: string) {
  if (["/dashboard/entrenamiento", "/dashboard/clases", "/dashboard/entrenadores", "/dashboard/mediciones"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return { label: "Entrenamiento", items: trainingItems };
  }
  if (["/dashboard/caja", "/dashboard/productos", "/dashboard/aforo"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return { label: "Operación de sede", items: operationItems };
  }
  if (["/dashboard/reportes", "/dashboard/empleados", "/dashboard/configuracion", "/dashboard/seguridad"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return { label: "Gestión", items: managementItems };
  }
  return null;
}

export default function AreaOperationsNav({ pathname, userRole, modules }: Props) {
  const group = groupFor(pathname);
  if (!group) return null;

  const visible = group.items.filter((item) =>
    (!item.roles || item.roles.includes(userRole)) && (!item.module || modules[item.module] !== false),
  );
  if (visible.length < 2) return null;

  return (
    <div className="border-b border-slate-200 bg-white/95 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto">
        <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 lg:block">{group.label}</span>
        <nav className="flex min-w-0 gap-1" aria-label={`Sección ${group.label}`}>
          {visible.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
