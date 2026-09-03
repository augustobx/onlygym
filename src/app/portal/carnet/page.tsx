import Link from "next/link";
import { ArrowLeft, CalendarDays, Dumbbell, MapPin, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { getPortalData } from "@/app/actions/portalAuth";
import MemberAccessQr from "@/components/MemberAccessQr";

type PortalCardData = {
  nombre: string;
  apellido: string;
  documento: string;
  tenant: { nombre: string };
  sucursalHabitual?: { nombre: string } | null;
  membresiaActual?: {
    nombre?: string | null;
    state: "none" | "active" | "expiring" | "expired";
    active: boolean;
    daysRemaining: number;
    fechaVencimiento?: string | null;
  };
};

function statusLabel(data: PortalCardData["membresiaActual"]) {
  if (!data || data.state === "none") return "Sin membresía";
  if (data.state === "expired") return "Vencida";
  if (data.state === "expiring") return data.daysRemaining === 0 ? "Vence hoy" : `Vence en ${data.daysRemaining} días`;
  return "Activa";
}

export default async function MemberCardPage() {
  const result = await getPortalData();
  if (!result.success || !result.data) redirect("/portal/login");
  const data = result.data as unknown as PortalCardData;
  const membership = data.membresiaActual;

  return (
    <main className="min-h-dvh bg-[#080b10] px-4 py-5 text-white">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/portal/dashboard" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/5 text-slate-300" aria-label="Volver al portal">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">Carnet digital</p>
            <h1 className="truncate text-xl font-black">{data.tenant.nombre}</h1>
          </div>
          <Link href="/portal/cuenta" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/5 text-slate-300" aria-label="Mi cuenta">
            <WalletCards className="h-5 w-5" />
          </Link>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#182118] via-[#111820] to-[#11131a] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lime-300 text-lg font-black text-slate-950">
                {data.nombre.charAt(0)}{data.apellido.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-black">{data.nombre} {data.apellido}</p>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400"><UserRound className="h-3.5 w-3.5" /> DNI {data.documento}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${membership?.active ? "bg-lime-300 text-slate-950" : "bg-rose-400/15 text-rose-300"}`}>
              {statusLabel(membership)}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500"><Dumbbell className="h-3.5 w-3.5" /> Plan</p>
              <p className="mt-1 truncate text-sm font-black">{membership?.nombre || "Sin plan"}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500"><MapPin className="h-3.5 w-3.5" /> Sede habitual</p>
              <p className="mt-1 truncate text-sm font-black">{data.sucursalHabitual?.nombre || "Sin asignar"}</p>
            </div>
          </div>

          {membership?.fechaVencimiento && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" /> Vigencia hasta {new Date(membership.fechaVencimiento).toLocaleDateString("es-AR")}
            </p>
          )}
        </section>

        <MemberAccessQr />

        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs leading-relaxed text-cyan-100">
          <p className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Mostrá este QR en el ingreso.</p>
          <p className="mt-2 text-cyan-100/70">Es temporal, está firmado por OnlyGym y sólo funciona para tu gimnasio. Si hacés una captura vieja, el código vence automáticamente.</p>
        </div>
      </div>
    </main>
  );
}
