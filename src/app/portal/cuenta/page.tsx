import Link from "next/link";
import { ArrowLeft, CalendarDays, CreditCard, Flame, QrCode, ReceiptText, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { getPortalData } from "@/app/actions/portalAuth";
import PortalPushControl from "@/components/PortalPushControl";

type MemberAccountData = {
  tenant: { nombre: string };
  visitasSemana: number;
  visitasMes: number;
  visitasTotal: number;
  visitasRacha: number;
  membresiaActual?: {
    nombre?: string | null;
    state: "none" | "active" | "expiring" | "expired";
    active: boolean;
    daysRemaining: number;
    fechaVencimiento?: string | null;
  };
  cuentaCorriente?: {
    saldo: number;
    limiteCredito: number;
    movimientos: Array<{ id: number; tipo: string; monto: number; concepto?: string | null; fecha: string }>;
  } | null;
  pagos: Array<{
    id: number;
    fechaPago: string;
    fechaVencimiento: string;
    monto: number;
    metodoPago?: string | null;
    estado: string;
    membresia: { nombre: string };
  }>;
};

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function membershipLabel(membership: MemberAccountData["membresiaActual"]) {
  if (!membership || membership.state === "none") return "Sin membresía";
  if (membership.state === "expired") return "Vencida";
  if (membership.state === "expiring") return membership.daysRemaining === 0 ? "Vence hoy" : `Vence en ${membership.daysRemaining} días`;
  return "Activa";
}

export default async function MemberAccountPage() {
  const result = await getPortalData();
  if (!result.success || !result.data) redirect("/portal/login");
  const data = result.data as unknown as MemberAccountData;
  const account = data.cuentaCorriente;
  const saldo = Number(account?.saldo || 0);
  const limit = Number(account?.limiteCredito || 0);
  const available = Math.max(0, limit - saldo);

  return (
    <main className="min-h-dvh bg-[#080b10] px-4 py-5 text-white">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/portal/dashboard" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/5 text-slate-300" aria-label="Volver al portal">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">Mi cuenta</p>
            <h1 className="truncate text-xl font-black">{data.tenant.nombre}</h1>
          </div>
          <Link href="/portal/carnet" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/5 text-lime-300" aria-label="Carnet QR">
            <QrCode className="h-5 w-5" />
          </Link>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-[#182118] via-[#111820] to-[#11131a] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Membresía actual</p>
              <h2 className="mt-2 text-2xl font-black">{data.membresiaActual?.nombre || "Sin plan"}</h2>
              {data.membresiaActual?.fechaVencimiento && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> Hasta {new Date(data.membresiaActual.fechaVencimiento).toLocaleDateString("es-AR")}</p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${data.membresiaActual?.active ? "bg-lime-300 text-slate-950" : "bg-rose-400/15 text-rose-300"}`}>
              {membershipLabel(data.membresiaActual)}
            </span>
          </div>
          <Link href="/portal/carnet" className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-300 text-sm font-black text-slate-950">
            <QrCode className="h-4 w-4" /> Abrir carnet de ingreso
          </Link>
        </section>

        <section className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
          <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Cuenta corriente</h2></div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="Saldo usado" value={money(saldo)} />
            <Metric label="Límite" value={money(limit)} />
            <Metric label="Disponible" value={money(available)} />
          </div>
          {!account || limit <= 0 ? (
            <p className="mt-4 rounded-2xl bg-white/[0.035] p-3 text-xs text-slate-500">No tenés crédito en cuenta corriente habilitado. Esto no afecta tu membresía.</p>
          ) : account.movimientos.length ? (
            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Últimos movimientos</p>
              {account.movimientos.slice(0, 12).map((movement) => (
                <div key={movement.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black">{movement.concepto || (movement.tipo === "pago" ? "Pago" : "Consumo")}</p>
                    <p className="mt-1 text-[10px] text-slate-600">{new Date(movement.fecha).toLocaleString("es-AR")}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-black ${movement.tipo === "pago" ? "text-lime-300" : "text-orange-300"}`}>
                    {movement.tipo === "pago" ? "−" : "+"}{money(Number(movement.monto))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Todavía no hay movimientos en tu cuenta.</p>
          )}
        </section>

        <section className="grid grid-cols-4 gap-2">
          <Stat icon={TrendingUp} label="Semana" value={data.visitasSemana} />
          <Stat icon={CalendarDays} label="Mes" value={data.visitasMes} />
          <Stat icon={Flame} label="Racha" value={data.visitasRacha} />
          <Stat icon={ShieldCheck} label="Total" value={data.visitasTotal} />
        </section>

        <section className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
          <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-lime-300" /><h2 className="font-black">Historial de membresías</h2></div>
          {data.pagos.length ? (
            <div className="mt-4 space-y-3">
              {data.pagos.slice(0, 10).map((payment) => (
                <article key={payment.id} className="flex items-start justify-between gap-3 border-b border-white/6 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{payment.membresia.nombre}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{new Date(payment.fechaPago).toLocaleDateString("es-AR")} → {new Date(payment.fechaVencimiento).toLocaleDateString("es-AR")}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase text-slate-600">{payment.metodoPago || "Pago registrado"} · {payment.estado}</p>
                  </div>
                  <p className="shrink-0 text-sm font-black">{money(payment.monto)}</p>
                </article>
              ))}
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">Todavía no hay pagos de membresía registrados.</p>}
        </section>

        <PortalPushControl />

        <div className="flex items-center justify-center gap-2 pb-4 text-[10px] font-semibold text-slate-600">
          <CreditCard className="h-3.5 w-3.5" /> Los pagos y movimientos son sólo de lectura desde el portal.
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl bg-white/[0.035] p-3"><p className="truncate text-[9px] font-black uppercase tracking-wide text-slate-600">{label}</p><p className="mt-2 truncate text-sm font-black">{value}</p></div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/7 bg-white/[0.035] p-3 text-center"><Icon className="mx-auto h-4 w-4 text-lime-300" /><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[8px] font-black uppercase text-slate-600">{label}</p></div>;
}
