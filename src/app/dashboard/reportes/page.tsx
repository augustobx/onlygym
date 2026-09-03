"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { getReportes } from "@/app/actions/reportes";
import { getAnaliticaRetencion, getSociosEnRiesgo, registrarSeguimientoComercial } from "@/app/actions/retencion";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

type Tab = "ventas" | "retencion" | "riesgo";
type RetentionPeriod = "mes_actual" | "mes_anterior" | "ultimos_90d";
type ContactType = "whatsapp" | "llamada" | "email" | "nota" | "oferta";

function formatMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("es-AR") : "—";
}
function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("ventas");
  const [branchName, setBranchName] = useState("Sede activa");
  const [contextReady, setContextReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(1); return localDate(d); });
  const [hasta, setHasta] = useState(() => localDate(new Date()));
  const [preset, setPreset] = useState<"hoy" | "semana" | "mes">("mes");
  const [stats, setStats] = useState<any>(null);

  const [retentionPeriod, setRetentionPeriod] = useState<RetentionPeriod>("mes_actual");
  const [retention, setRetention] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);

  const [contacting, setContacting] = useState<any | null>(null);
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactNotes, setContactNotes] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    void getStaffNavigationContext().then((result) => {
      if (!result.success || !result.data?.branchId) {
        setError("Seleccioná una sucursal antes de abrir los reportes.");
        setContextReady(false);
        return;
      }
      setBranchName(result.data.branchName || "Sede activa");
      setContextReady(true);
    });
  }, []);

  const loadSales = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    setError(null);
    const result = await getReportes(desde, hasta);
    if (result.success) setStats(result.data);
    else setError(result.error || "No se pudieron cargar los reportes");
    setLoading(false);
  }, [contextReady, desde, hasta]);

  const loadRetention = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    setError(null);
    const result = await getAnaliticaRetencion(retentionPeriod);
    if (result.success) setRetention(result.data);
    else setError(result.error || "No se pudo cargar la analítica");
    setLoading(false);
  }, [contextReady, retentionPeriod]);

  const loadRisk = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    setError(null);
    const result = await getSociosEnRiesgo();
    if (result.success) setRisk(result.data);
    else setError(result.error || "No se pudo cargar el CRM de riesgo");
    setLoading(false);
  }, [contextReady]);

  useEffect(() => {
    if (!contextReady) return;
    if (tab === "ventas") void loadSales();
    else if (tab === "retencion") void loadRetention();
    else void loadRisk();
  }, [contextReady, tab, loadSales, loadRetention, loadRisk]);

  const applyPreset = (value: "hoy" | "semana" | "mes") => {
    setPreset(value);
    const today = new Date();
    const end = localDate(today);
    if (value === "hoy") {
      setDesde(end);
      setHasta(end);
      return;
    }
    const start = new Date(today);
    if (value === "semana") start.setDate(start.getDate() - 6);
    else start.setDate(1);
    setDesde(localDate(start));
    setHasta(end);
  };

  const saveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contacting) return;
    setSavingContact(true);
    const result = await registrarSeguimientoComercial({
      clienteId: contacting.id,
      tipo: contactType,
      estado: "contactado",
      resultado: contactNotes,
      motivo: contacting.motivoRiesgo,
    });
    setSavingContact(false);
    if (!result.success) {
      setError(result.error || "No se pudo registrar el contacto");
      return;
    }
    setContacting(null);
    setContactNotes("");
    await loadRisk();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">Analítica operativa · {branchName}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Reportes y retención</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Todos los datos corresponden a la sede activa validada por el servidor.</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <TabButton active={tab === "ventas"} onClick={() => setTab("ventas")}>Facturación</TabButton>
            <TabButton active={tab === "retencion"} onClick={() => setTab("retencion")}>Hábitos</TabButton>
            <TabButton active={tab === "riesgo"} onClick={() => setTab("riesgo")}>CRM riesgo</TabButton>
          </div>
        </div>
      </header>

      {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><span>{error}</span><button onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}
      {loading && <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-cyan-700" />Actualizando datos…</div>}

      {tab === "ventas" && (
        <div className="space-y-5">
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              <Preset active={preset === "hoy"} onClick={() => applyPreset("hoy")}>Hoy</Preset>
              <Preset active={preset === "semana"} onClick={() => applyPreset("semana")}>7 días</Preset>
              <Preset active={preset === "mes"} onClick={() => applyPreset("mes")}>Este mes</Preset>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <Calendar className="h-4 w-4" />
              <input type="date" value={desde} onChange={(event) => { setPreset("mes"); setDesde(event.target.value); }} className="h-9 rounded-lg border border-slate-200 px-2 text-slate-700" />
              <span>a</span>
              <input type="date" value={hasta} onChange={(event) => { setPreset("mes"); setHasta(event.target.value); }} className="h-9 rounded-lg border border-slate-200 px-2 text-slate-700" />
              <button onClick={() => void loadSales()} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white" title="Actualizar"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </section>

          {stats && <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi icon={DollarSign} label="Recaudación total" value={formatMoney(stats.totalRecaudacion)} detail="Membresías + ventas" />
              <Kpi icon={Receipt} label="Ingresos membresías" value={formatMoney(stats.totalIngresosMembresías)} detail={`${stats.totalPagos} pagos`} tone="good" />
              <Kpi icon={Package} label="Ventas kiosco" value={formatMoney(stats.totalVendido)} detail={`${stats.totalVentas} tickets`} tone="info" />
              <Kpi icon={Users} label="Socios al día" value={`${stats.clientesActivos}/${stats.totalClientes}`} detail={`${stats.totalClientes ? Math.round(stats.clientesActivos / stats.totalClientes * 100) : 0}% de la sede`} />
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <Card title="Membresías más contratadas" icon={Receipt}>
                <Rows empty="Sin pagos en el período">{stats.membresiasVendidas?.map((item: any, index: number) => <Row key={`${item.nombre}-${index}`} title={item.nombre} meta={`${item.cantidad} cuotas`} value={formatMoney(item.total)} />)}</Rows>
              </Card>
              <Card title="Productos más vendidos" icon={Package}>
                <Rows empty="Sin ventas en el período">{stats.topProductos?.map((item: any) => <Row key={item.productoId} title={`#${item.posicion} ${item.nombre}`} meta={`${item.unidadesVendidas} unidades · ${item.categoria}`} value={formatMoney(item.recaudacionTotal)} />)}</Rows>
              </Card>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <Card title="Medios de pago · membresías" icon={BarChart3}>
                <Rows empty="Sin datos">{stats.pagosPorMetodo?.map((item: any) => <Row key={item.metodo} title={item.metodo} meta={`${item.cantidad} operaciones`} value={formatMoney(item.total)} />)}</Rows>
              </Card>
              <Card title="Medios de pago · ventas" icon={TrendingUp}>
                <Rows empty="Sin datos">{stats.ventasPorTipoPago?.map((item: any) => <Row key={item.tipo} title={item.tipo} meta={`${item.cantidad} operaciones`} value={formatMoney(item.total)} />)}</Rows>
              </Card>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <Card title="Afluencia por hora" icon={Clock}>
                <div className="space-y-2">{stats.histogramaHorarios?.map((item: any) => { const max = Math.max(...stats.histogramaHorarios.map((row: any) => row.cantidad), 1); const width = Math.round(item.cantidad / max * 100); return <div key={item.hora} className="grid grid-cols-[52px_1fr_40px] items-center gap-2 text-xs"><span className="font-bold text-slate-500">{item.hora}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${width}%` }} /></div><span className="text-right font-black">{item.cantidad}</span></div>; })}</div>
              </Card>
              <Card title="Accesos" icon={ShieldAlert}>
                <div className="grid grid-cols-2 gap-3"><Mini label="Permitidos" value={stats.ingresosPermitidos} good /><Mini label="Denegados" value={stats.ingresosDenegados} /></div>
                {stats.ultimosDenegados?.length > 0 && <div className="mt-4 space-y-2">{stats.ultimosDenegados.map((item: any) => <div key={item.id} className="rounded-xl bg-rose-50 p-3 text-xs"><p className="font-black text-rose-900">{item.nombre}</p><p className="mt-1 text-rose-700">{item.motivo}</p><p className="mt-1 text-[10px] text-rose-500">{new Date(item.fechaHora).toLocaleString("es-AR")}</p></div>)}</div>}
              </Card>
            </section>
          </>}
        </div>
      )}

      {tab === "retencion" && (
        <div className="space-y-5">
          <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <Preset active={retentionPeriod === "mes_actual"} onClick={() => setRetentionPeriod("mes_actual")}>Mes actual</Preset>
            <Preset active={retentionPeriod === "mes_anterior"} onClick={() => setRetentionPeriod("mes_anterior")}>Mes anterior</Preset>
            <Preset active={retentionPeriod === "ultimos_90d"} onClick={() => setRetentionPeriod("ultimos_90d")}>Últimos 90 días</Preset>
          </section>
          {retention && <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi icon={TrendingUp} label="Tasa de asistencia" value={`${retention.tasaRetencionEstimada}%`} detail="Socios que asistieron" tone="info" />
              <Kpi icon={Users} label="Frecuencia promedio" value={`${retention.frecuenciaPromedioVisitas}`} detail="Visitas por socio" tone="good" />
              <Kpi icon={CheckCircle2} label="Check-ins" value={String(retention.totalAsistencias)} detail="Ingresos permitidos" />
              <Kpi icon={Flame} label="Socios únicos" value={String(retention.clientesConAsistencia)} detail={`De ${retention.totalClientesActivos} activos`} />
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <Card title="Horarios pico" icon={Clock}><Rows empty="Sin asistencias">{retention.topHorarios?.map((item: any, index: number) => <Row key={item.hora} title={`#${index + 1} · ${item.hora}`} meta="Concurrencia" value={`${item.cantidad} ingresos`} />)}</Rows></Card>
              <Card title="Clases con mayor ocupación" icon={Flame}><Rows empty="Sin clases en el período">{retention.topClases?.map((item: any, index: number) => <Row key={`${item.nombre}-${index}`} title={item.nombre} meta={`${item.profesor} · ${item.reservas}/${item.cupoMaximo} cupos`} value={`${item.ocupacionPromedio}%`} />)}</Rows></Card>
            </section>
          </>}
        </div>
      )}

      {tab === "riesgo" && (
        <div className="space-y-5">
          {risk && <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi icon={Users} label="Socios sede" value={String(risk.totalSocios)} detail="Base activa" />
              <Kpi icon={AlertTriangle} label="Críticos" value={String(risk.criticos)} detail="Prioridad inmediata" tone="bad" />
              <Kpi icon={ShieldAlert} label="Riesgo alto" value={String(risk.altos)} detail="Inactividad / caída" tone="warn" />
              <Kpi icon={TrendingUp} label="Riesgo medio" value={String(risk.medios)} detail="Seguimiento preventivo" tone="info" />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-black text-slate-950">Socios prioritarios</h2><p className="text-xs text-slate-500">Ordenados por nivel de riesgo en la sede activa.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{risk.sociosEnRiesgo.length}</span></div>
              <div className="divide-y divide-slate-100">{risk.sociosEnRiesgo.length ? risk.sociosEnRiesgo.map((member: any) => {
                const phone = String(member.telefono || "").replace(/\D/g, "");
                const message = encodeURIComponent(`¡Hola ${String(member.nombre).split(" ")[0]}! 💪 Te extrañamos en el gimnasio. ¿Cómo podemos ayudarte a retomar tus entrenamientos?`);
                return <article key={member.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_.8fr_.8fr_auto] lg:items-center"><div><p className="font-black text-slate-900">{member.nombre}</p><p className="text-xs text-slate-500">DNI {member.documento} · {member.telefono || "Sin teléfono"}</p></div><div><RiskBadge level={member.nivelRiesgo} /><p className="mt-1 text-[10px] text-slate-500">{member.motivoRiesgo}</p></div><div className="text-xs"><p className="font-bold">{member.diasInactivo >= 99 ? "Nunca asistió" : `${member.diasInactivo} días sin venir`}</p><p className="text-slate-500">{member.membresiaNombre} · {member.fechaVencimiento ? `vence ${formatDate(member.fechaVencimiento)}` : "sin cuota"}</p></div><div className="flex flex-wrap justify-end gap-2">{phone && <a href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-black text-white"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}<button onClick={() => setContacting(member)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white"><Phone className="h-3.5 w-3.5" />Registrar</button></div></article>;
              }) : <p className="p-8 text-center text-sm text-slate-500">No hay socios clasificados en riesgo.</p>}</div>
            </section>
          </>}
        </div>
      )}

      {contacting && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={saveContact} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Seguimiento CRM</p><h2 className="text-lg font-black">{contacting.nombre}</h2></div><button type="button" onClick={() => setContacting(null)}><X className="h-5 w-5 text-slate-400" /></button></div><label className="block text-xs font-bold text-slate-600">Canal<select value={contactType} onChange={(event) => setContactType(event.target.value as ContactType)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3"><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="email">Email</option><option value="nota">Nota interna</option><option value="oferta">Oferta</option></select></label><label className="block text-xs font-bold text-slate-600">Resultado<textarea value={contactNotes} onChange={(event) => setContactNotes(event.target.value)} rows={4} maxLength={1000} className="mt-1 w-full rounded-xl border border-slate-200 p-3" placeholder="Qué se habló y próximo paso" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setContacting(null)} className="h-10 rounded-xl bg-slate-100 px-4 text-xs font-bold">Cancelar</button><button disabled={savingContact} className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50">{savingContact ? "Guardando…" : "Guardar gestión"}</button></div></form></div>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-black ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>{children}</button>; }
function Preset({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-black ${active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{children}</button>; }
function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string; tone?: "default" | "good" | "info" | "warn" | "bad" }) { const toneClass = tone === "good" ? "text-emerald-700" : tone === "info" ? "text-cyan-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-700" : "text-slate-950"; return <div className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className={`h-5 w-5 ${toneClass}`} /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>; }
function Card({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Icon className="h-4 w-4 text-cyan-700" />{title}</h2><div className="mt-4">{children}</div></section>; }
function Rows({ children, empty }: { children: React.ReactNode; empty: string }) { const list = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []; return list.length ? <div className="space-y-2">{list}</div> : <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-400">{empty}</p>; }
function Row({ title, meta, value }: { title: string; meta: string; value: string }) { return <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div className="min-w-0"><p className="truncate font-black text-slate-800">{title}</p><p className="mt-1 truncate text-[10px] text-slate-500">{meta}</p></div><span className="shrink-0 font-black text-slate-900">{value}</span></div>; }
function Mini({ label, value, good }: { label: string; value: number; good?: boolean }) { return <div className={`rounded-xl p-4 ${good ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}><p className="text-xs font-bold">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function RiskBadge({ level }: { level: string }) { const cls = level === "Crítico" ? "bg-rose-100 text-rose-800" : level === "Alto" ? "bg-amber-100 text-amber-800" : "bg-cyan-100 text-cyan-800"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${cls}`}>{level}</span>; }
