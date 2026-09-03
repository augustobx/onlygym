"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, Dumbbell, Gift, Receipt, TrendingUp, Users } from "lucide-react";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

const financeItems = [
  { href: "/dashboard/clientes", label: "Socios", icon: Users },
  { href: "/dashboard/pagos", label: "Cobros", icon: CreditCard },
  { href: "/dashboard/cuentas", label: "Cuentas corrientes", icon: Receipt },
];

const trainerItems = [
  { href: "/dashboard/entrenador", label: "Mis socios", icon: Users },
  { href: "/dashboard/entrenamiento", label: "Planificación", icon: Dumbbell },
  { href: "/dashboard/mediciones", label: "Progreso", icon: TrendingUp },
];

export default function MemberOperationsNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [showBenefits, setShowBenefits] = useState(false);

  useEffect(() => {
    void getStaffNavigationContext().then((result) => {
      if (!result.success || !result.data) return;
      setRole(result.data.role);
      setShowBenefits(["OWNER", "ADMIN"].includes(result.data.role) && result.data.modules.puntos !== false);
    });
  }, []);

  if (!role) return null;

  const items = role === "ENTRENADOR"
    ? trainerItems
    : showBenefits
      ? [...financeItems, { href: "/dashboard/recompensas", label: "Beneficios", icon: Gift }]
      : financeItems;

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1" aria-label={role === "ENTRENADOR" ? "Trabajo con socios" : "Gestión de socios"}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
          || (href === "/dashboard/clientes" && pathname.startsWith("/dashboard/clientes/"))
          || (href === "/dashboard/entrenador" && pathname.startsWith("/dashboard/entrenador/"));
        return (
          <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
