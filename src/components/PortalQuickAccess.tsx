"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode, ShieldCheck, WalletCards } from "lucide-react";

export default function PortalQuickAccess() {
  const pathname = usePathname();
  if (pathname !== "/portal/dashboard") return null;

  return (
    <div className="fixed bottom-[92px] right-3 z-30 flex flex-col gap-2 sm:right-5">
      <Link href="/portal/seguridad" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-[#151a22]/95 text-slate-400 shadow-xl backdrop-blur" aria-label="Seguridad" title="Seguridad">
        <ShieldCheck className="h-5 w-5" />
      </Link>
      <Link href="/portal/cuenta" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-[#151a22]/95 text-cyan-300 shadow-xl backdrop-blur" aria-label="Mi cuenta" title="Mi cuenta">
        <WalletCards className="h-5 w-5" />
      </Link>
      <Link href="/portal/carnet" className="grid h-14 w-14 place-items-center rounded-2xl bg-lime-300 text-slate-950 shadow-2xl shadow-lime-950/30" aria-label="Abrir carnet QR" title="Carnet QR">
        <QrCode className="h-6 w-6" />
      </Link>
    </div>
  );
}
