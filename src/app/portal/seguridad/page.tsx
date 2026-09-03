import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import PortalSecurityControl from "@/components/PortalSecurityControl";

export default function MemberSecurityPage() {
  return (
    <main className="min-h-dvh bg-[#080b10] px-4 py-5 text-white">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center gap-3">
          <Link href="/portal/cuenta" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/5 text-slate-300" aria-label="Volver a mi cuenta">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-300"><ShieldCheck className="h-3.5 w-3.5" /> Portal del socio</p>
            <h1 className="mt-1 text-xl font-black">Seguridad</h1>
          </div>
        </header>
        <PortalSecurityControl />
      </div>
    </main>
  );
}
