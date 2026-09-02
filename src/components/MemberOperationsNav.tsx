"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Receipt, Users } from "lucide-react";

const items = [
  { href: "/dashboard/clientes", label: "Socios", icon: Users },
  { href: "/dashboard/pagos", label: "Cobros", icon: CreditCard },
  { href: "/dashboard/cuentas", label: "Cuentas corrientes", icon: Receipt },
];

export default function MemberOperationsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1" aria-label="Gestión de socios">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/dashboard/clientes" && pathname.startsWith("/dashboard/clientes/"));
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
