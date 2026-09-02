"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CreditCard,
  Receipt,
  ShoppingCart,
  UserPlus,
  Users,
} from "lucide-react";
import { getDashboardStats } from "@/app/actions/dashboard";
import { getAforoEnVivo } from "@/app/actions/horarios";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("es-AR") : "—";
}

function time(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [aforo, setAforo] = useState<any>(null);
  const [branchName, setBranchName] = useState("Sucursal activa");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const context = await getStaffNavigationContext();
        if (!context.success || !context.data) {
          router.replace("/login");
          return;
        }
        if (!context.data.branchId || !context.data.branchName) {
          router.replace("/seleccionar-sucursal");
          return;
        }

        const branchId = context.data.branchId;
        setBranchName(context.data.branchName);
        localStorage.setItem("activeSucursalId", String(branchId));
        localStorage.setItem("activeSucursalName", context.data.branchName);

        const [statsResult, capacityResult] = await Promise.all([
          getDashboardStats(branchId),
          getAforoEnVivo(branchId),
        ]);

        if (!statsResult.success || !statsResult.data) {
          setError(statsResult.error || "No se pudieron cargar las métricas de la sede.");
        } else {
          setStats(statsResult.data);
        }
        if (capacityResult.success && capacityResult.data) setAforo(capacityResult.data);
      } catch {
        setError("No se pudo cargar el resumen de la sede.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600" />
        <p className="text-xs font-semibold text-slate-500">Cargando resumen de la sede…</p>
      </div>
    );
  }

  const s = stats || {
    sociosActivos: 0,
    sociosAlDia: 0,
    sociosVencidos: 0,
    ingresosMes: 0,
    totalDeuda: 0,
    ultimosPagos: [],
    ultimosIngresos: [],
    clasesHoy: [],
    sociosInactivos7d: 0,
    sociosInactivos14d: 0,
  };

  const capacity = aforo?.capacidadMaxima || 0;
  const peopleInside = aforo?.personasAdentro || 0;
  const occupancy = aforo?.porcentaje || 0;
  const pendingAttention = Number(s.sociosVencidos || 0) + Number(s.sociosInactivos14d || 0);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Resumen de hoy</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{branchName}</h1>
            <p className="mt-1 text-sm text-slate-500">Cobros, socios, actividad y tareas que requieren atención.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/clientes/nuevo" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 text-xs font-black text-white">
              <UserPlus className="h-3.5 w-3.5" /> Nuevo socio
            </Link>
            <Link href="/dashboard/pagos" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 text-xs font-black text-white">
              <CreditCard className="h-3.5 w-3.5" /> Cobrar membresía
            </Link>
            <Link href="/dashboard/caja" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-800">
              <ShoppingCart className="h-3.5 w-3.5" /> Nueva venta
            </Link>
          </div>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Recaudación del mes" value={money(s.ingresosMes)} hint="Membresías + ventas" />
        <Metric label="Socios al día" value={String(s.sociosAlDia || 0)} hint="Con membresía vigente" tone="success" />
        <Metric label="A renovar" value={String(s.sociosVencidos || 0)} hint="Membresías vencidas" tone="danger" href="/dashboard/clientes" />
        <Metric label="Deuda en cuentas" value={money(s.totalDeuda)} hint="Saldo pendiente" tone="danger" href="/dashboard/cuentas" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Aforo actual</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />En vivo</span>
          </div>
          <p className="mt-2 text-xl font-black text-slate-950">{peopleInside}<span className="text-sm font-semibold text-slate-400"> / {capacity || "—"}</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.min(100, occupancy)}%` }} /></div>
          <Link href="/dashboard/aforo" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-cyan-700">Ver ingresos <ArrowRight className="h-3 w-3" /></Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <Panel title="Últimos cobros" icon={CreditCard} href="/dashboard/pagos" linkLabel="Ver cobros">
            {s.ultimosPagos?.length ? (
              <div className="divide-y divide-slate-100">
                {s.ultimosPagos.slice(0, 6).map((payment: any) => (
                  <div key={payment.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{payment.clienteNombre || (payment.cliente ? `${payment.cliente.nombre} ${payment.cliente.apellido}` : "Socio")}</p>
                      <p className="text-xs text-slate-500">{payment.membresia?.nombre || payment.membresia || "Membresía"} · {date(payment.fechaPago || payment.fecha)}</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">{money(payment.monto)}</p>
                  </div>
                ))}
              </div>
            ) : <Empty text="Todavía no hay cobros recientes." />}
          </Panel>

          <Panel title="Actividad de ingreso" icon={Activity} href="/dashboard/aforo" linkLabel="Ver aforo">
            {s.ultimosIngresos?.length ? (
              <div className="divide-y divide-slate-100">
                {s.ultimosIngresos.slice(0, 6).map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{entry.clienteNombre || (entry.cliente ? `${entry.cliente.nombre} ${entry.cliente.apellido}` : "Socio")}</p>
                      <p className="text-xs text-slate-500">{time(entry.fechaHora || entry.fecha)} · {entry.duracionMinutos ? `${entry.duracionMinutos} min` : "En sala"}</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">INGRESO OK</span>
                  </div>
                ))}
              </div>
            ) : <Empty text="Todavía no hay ingresos recientes." />}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Qué requiere atención" icon={AlertCircle}>
            <div className="space-y-2">
              <AttentionRow label="Membresías vencidas" value={s.sociosVencidos || 0} href="/dashboard/clientes" />
              <AttentionRow label="Sin asistir hace 7+ días" value={s.sociosInactivos7d || 0} href="/dashboard/reportes" />
              <AttentionRow label="Sin asistir hace 14+ días" value={s.sociosInactivos14d || 0} href="/dashboard/reportes" danger />
              <AttentionRow label="Deuda en cuentas" value={money(s.totalDeuda)} href="/dashboard/cuentas" danger={Number(s.totalDeuda || 0) > 0} />
            </div>
            <div className={`mt-4 rounded-xl p-3 text-xs font-bold ${pendingAttention > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
              {pendingAttention > 0 ? `${pendingAttention} situaciones de socios conviene revisar hoy.` : "No hay alertas urgentes de socios para hoy."}
            </div>
          </Panel>

          <Panel title="Clases de hoy" icon={CalendarDays} href="/dashboard/clases" linkLabel="Abrir agenda">
            {s.clasesHoy?.length ? (
              <div className="space-y-2">
                {s.clasesHoy.slice(0, 5).map((gymClass: any) => (
                  <div key={gymClass.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-900">{gymClass.nombre}</p>
                      <span className="text-xs font-black text-cyan-700">{time(gymClass.inicio)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{gymClass.profesor || "Sin entrenador asignado"} · {gymClass.reservados}/{gymClass.cupoMaximo} reservas</p>
                  </div>
                ))}
              </div>
            ) : <Empty text="No hay clases programadas para hoy." />}
          </Panel>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/dashboard/clientes" icon={Users} title="Socios" text="Buscar fichas, altas y estados de membresía" />
        <QuickLink href="/dashboard/cuentas" icon={Receipt} title="Cuentas corrientes" text="Revisar deuda, cargos y pagos pendientes" />
        <QuickLink href="/dashboard/clases" icon={CalendarDays} title="Agenda" text="Ver clases, cupos, reservas y asistencia" />
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone = "default", href }: { label: string; value: string; hint: string; tone?: "default" | "success" | "danger"; href?: string }) {
  const valueClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-slate-950";
  const body = <><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><p className={`mt-2 text-xl font-black ${valueClass}`}>{value}</p><p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p></>;
  return href ? <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">{body}</Link> : <div className="rounded-2xl border border-slate-200 bg-white p-4">{body}</div>;
}

function Panel({ title, icon: Icon, href, linkLabel, children }: { title: string; icon: typeof Activity; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-700" /><h2 className="text-xs font-black uppercase tracking-wider text-slate-900">{title}</h2></div>{href && <Link href={href} className="text-xs font-bold text-cyan-700 hover:text-cyan-900">{linkLabel || "Ver más"} →</Link>}</div>{children}</section>;
}

function AttentionRow({ label, value, href, danger = false }: { label: string; value: string | number; href: string; danger?: boolean }) {
  return <Link href={href} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-slate-100"><span className="text-xs font-bold text-slate-700">{label}</span><span className={`text-sm font-black ${danger ? "text-rose-700" : "text-slate-900"}`}>{value}</span></Link>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 p-5 text-center text-xs font-medium text-slate-500">{text}</p>;
}

function QuickLink({ href, icon: Icon, title, text }: { href: string; icon: typeof Users; title: string; text: string }) {
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon className="h-4 w-4" /></span><div><p className="text-sm font-black text-slate-900">{title}</p><p className="text-xs text-slate-500">{text}</p></div></div></Link>;
}
