"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Clipboard,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Receipt,
  Save,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { getCliente, resetPasswordCliente, updateCliente } from "@/app/actions/clientes";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";
import MemberOperationsNav from "@/components/MemberOperationsNav";
import {
  buildMemberTemporaryPasswordMessage,
  buildMembershipReminderMessage,
  buildWhatsAppUrl,
} from "@/lib/whatsapp";

type Tab = "resumen" | "membresias" | "cuenta" | "actividad" | "datos";
type Notice = { type: "success" | "error"; text: string } | null;

type TemporaryCredential = {
  password: string;
  message: string;
  whatsappUrl: string | null;
} | null;

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR");
}

function dateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function membershipStatus(lastPayment: any) {
  if (!lastPayment?.fechaVencimiento) return { active: false, label: "Sin membresía", days: 0 };
  const expiration = new Date(lastPayment.fechaVencimiento);
  expiration.setHours(23, 59, 59, 999);
  const diff = expiration.getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  return {
    active: diff >= 0,
    label: diff >= 0 ? (days <= 7 ? `Vence en ${Math.max(days, 0)} días` : "Al día") : "Vencida",
    days,
  };
}

export default function ClienteDetailPage() {
  const params = useParams();
  const clienteId = Number(params.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [notice, setNotice] = useState<Notice>(null);
  const [role, setRole] = useState("RECEPCION");
  const [form, setForm] = useState<any>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [temporaryCredential, setTemporaryCredential] = useState<TemporaryCredential>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const result = await getCliente(clienteId);
    if (result.success && result.data) {
      const data = result.data as any;
      setCliente(data);
      setPhoto(data.foto || null);
      setForm({
        nombre: data.nombre || "",
        apellido: data.apellido || "",
        documento: data.documento || "",
        telefono: data.telefono || "",
        email: data.email || "",
        direccion: data.direccion || "",
        estado: data.estado || "activo",
      });
    } else {
      setCliente(null);
      setNotice({ type: "error", text: result.error || "No se pudo cargar el socio" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      setLoading(false);
      return;
    }
    void load();
    void getStaffNavigationContext().then((result) => {
      if (result.success && result.data) setRole(result.data.role);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const lastPayment = cliente?.pagos?.[0] || null;
  const status = membershipStatus(lastPayment);
  const account = cliente?.cuentaCorriente || null;
  const balance = Number(account?.saldo || 0);
  const creditLimit = Number(account?.limiteCredito || 0);
  const availableCredit = Math.max(0, creditLimit - balance);
  const lastAccess = cliente?.ingresos?.[0] || null;
  const canResetPassword = ["OWNER", "ADMIN"].includes(role);

  const reminderUrl = useMemo(() => {
    if (!cliente?.telefono) return null;
    const reminder = buildMembershipReminderMessage({
      name: cliente.nombre,
      gymName: cliente.sucursales?.[0]?.nombre || "tu gimnasio",
      membershipName: lastPayment?.membresia?.nombre || null,
      expirationDate: lastPayment?.fechaVencimiento ? date(lastPayment.fechaVencimiento) : null,
      expired: Boolean(lastPayment?.fechaVencimiento && new Date(lastPayment.fechaVencimiento).getTime() < Date.now()),
    });
    return buildWhatsAppUrl(cliente.telefono, reminder);
  }, [cliente, lastPayment]);

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setNotice({ type: "error", text: "La imagen no debe superar los 3 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    const result = await updateCliente(clienteId, { ...form, foto: photo || null });
    if (result.success) {
      setNotice({ type: "success", text: "Datos del socio actualizados." });
      await load();
    } else {
      setNotice({ type: "error", text: result.error || "No se pudieron guardar los cambios" });
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!window.confirm("¿Generar una nueva contraseña temporal y cerrar las sesiones actuales del socio?")) return;
    setResetting(true);
    setNotice(null);
    setTemporaryCredential(null);
    const result = await resetPasswordCliente(clienteId);
    if (result.success && result.temporaryPassword) {
      const portalUrl = `${window.location.origin}/portal/login`;
      const message = buildMemberTemporaryPasswordMessage({
        name: `${cliente.nombre} ${cliente.apellido}`,
        document: cliente.documento,
        temporaryPassword: result.temporaryPassword,
        portalUrl,
      });
      setTemporaryCredential({
        password: result.temporaryPassword,
        message,
        whatsappUrl: buildWhatsAppUrl(cliente.telefono, message),
      });
      setNotice({ type: "success", text: "Nueva contraseña temporal generada. Guardala o enviala ahora; no se volverá a mostrar." });
      await load();
    } else {
      setNotice({ type: "error", text: result.error || "No se pudo generar la contraseña temporal" });
    }
    setResetting(false);
  };

  const copyCredential = async () => {
    if (!temporaryCredential) return;
    await navigator.clipboard.writeText(temporaryCredential.message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (loading) return <div className="py-24 text-center text-sm font-bold text-slate-500">Cargando ficha del socio…</div>;
  if (!cliente) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-800">Socio no encontrado.</div>;

  const tabs: Array<{ key: Tab; label: string; icon: typeof UserRound }> = [
    { key: "resumen", label: "Resumen", icon: UserRound },
    { key: "membresias", label: "Membresías", icon: CreditCard },
    { key: "cuenta", label: "Cuenta", icon: WalletCards },
    { key: "actividad", label: "Actividad", icon: Activity },
    { key: "datos", label: "Datos", icon: Pencil },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <MemberOperationsNav />

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard/clientes" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100" title="Volver a socios"><ArrowLeft className="h-4 w-4" /></Link>
            {photo ? <img src={photo} alt={cliente.nombre} className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-lg font-black text-cyan-800">{cliente.nombre?.charAt(0)}{cliente.apellido?.charAt(0)}</div>}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-black text-slate-950">{cliente.nombre} {cliente.apellido}</h1><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${status.active ? status.days <= 7 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"}`}>{status.label}</span>{cliente.estado !== "activo" && <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">SOCIO INACTIVO</span>}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500"><span>DNI {cliente.documento}</span>{cliente.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{cliente.telefono}</span>}{cliente.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{cliente.email}</span>}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/pagos?clienteId=${clienteId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-sm"><CreditCard className="h-3.5 w-3.5" />Cobrar / renovar</Link>
            <Link href={`/dashboard/cuentas?clienteId=${clienteId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"><Receipt className="h-3.5 w-3.5" />Cuenta corriente</Link>
            {reminderUrl && <a href={reminderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
          </div>
        </div>
      </header>

      {notice && <button onClick={() => setNotice(null)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold ${notice.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>{notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{notice.text}</button>}

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1" aria-label="Ficha del socio">
        {tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </nav>

      {tab === "resumen" && (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Membresía" value={lastPayment?.membresia?.nombre || "Sin plan"} detail={lastPayment?.fechaVencimiento ? `Vence ${date(lastPayment.fechaVencimiento)}` : "Todavía no tiene un plan registrado"} tone={status.active ? "good" : "bad"} />
              <SummaryCard label="Cuenta corriente" value={money(balance)} detail={balance > 0 ? `Disponible ${money(availableCredit)}` : "Sin deuda pendiente"} tone={balance > 0 ? "warn" : "good"} />
              <SummaryCard label="Último ingreso" value={lastAccess ? date(lastAccess.fechaHora) : "Sin ingresos"} detail={lastAccess ? dateTime(lastAccess.fechaHora) : "No hay actividad registrada"} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Acciones recomendadas</p><h2 className="mt-1 text-lg font-black text-slate-950">Qué podés hacer con este socio</h2></div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ActionLink href={`/dashboard/pagos?clienteId=${clienteId}`} icon={CreditCard} title="Cobrar membresía" description="Renovar o asignar un plan desde el circuito único de cobros." />
                <ActionLink href={`/dashboard/cuentas?clienteId=${clienteId}`} icon={WalletCards} title="Gestionar cuenta" description="Ver deuda, registrar abono o revisar movimientos." />
                <button onClick={() => setTab("actividad")} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-300 hover:bg-cyan-50"><span className="flex items-center gap-2 text-sm font-black"><Activity className="h-4 w-4 text-cyan-700" />Revisar actividad</span><span className="mt-1 block text-xs font-medium text-slate-500">Ingresos recientes y permanencia en la sede.</span></button>
                <button onClick={() => setTab("datos")} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-300 hover:bg-cyan-50"><span className="flex items-center gap-2 text-sm font-black"><Pencil className="h-4 w-4 text-cyan-700" />Editar datos</span><span className="mt-1 block text-xs font-medium text-slate-500">Contacto, documento, foto y estado del socio.</span></button>
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-cyan-700" /><h2 className="text-sm font-black text-slate-950">Acceso al portal</h2></div>
              <dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Usuario</dt><dd className="font-mono font-black text-slate-900">{cliente.usuarioCliente?.usuario || cliente.documento}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Clave</dt><dd className="font-bold text-slate-900">{cliente.usuarioCliente?.debeCambiarPassword ? "Temporal · debe cambiarla" : "Configurada"}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Último acceso</dt><dd className="font-bold text-slate-900">{dateTime(cliente.usuarioCliente?.ultimoAcceso)}</dd></div></dl>
              {canResetPassword ? <button onClick={handleResetPassword} disabled={resetting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-50 disabled:opacity-50"><KeyRound className="h-3.5 w-3.5" />{resetting ? "Generando…" : "Generar nueva clave temporal"}</button> : <p className="mt-4 rounded-lg bg-slate-50 p-2 text-[11px] font-medium text-slate-500">La regeneración de contraseña está reservada a administradores.</p>}
            </div>

            {temporaryCredential && (
              <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 shadow-2xs">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Mostrar una sola vez</p><h3 className="mt-1 text-sm font-black text-cyan-950">Nueva contraseña temporal</h3><div className="mt-3 rounded-xl border border-cyan-200 bg-white p-3 font-mono text-lg font-black tracking-wide text-slate-950">{temporaryCredential.password}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyCredential} className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-black text-cyan-900">{copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied ? "Copiado" : "Copiar mensaje"}</button>{temporaryCredential.whatsappUrl ? <a href={temporaryCredential.whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><MessageCircle className="h-3.5 w-3.5" />Enviar WhatsApp</a> : <span className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-center text-[10px] font-bold text-slate-500">Sin teléfono</span>}</div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "membresias" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-950">Historial de membresías</h2><p className="text-xs font-medium text-slate-500">El cobro y la renovación se hacen desde el circuito único de Cobros.</p></div><Link href={`/dashboard/pagos?clienteId=${clienteId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white"><CreditCard className="h-3.5 w-3.5" />Cobrar / renovar</Link></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Cobro</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Medio</th><th className="px-4 py-3 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{cliente.pagos?.map((payment: any) => <tr key={payment.id}><td className="px-4 py-3 font-bold text-slate-950">{payment.membresia?.nombre || "Membresía"}</td><td className="px-4 py-3 text-slate-600">{date(payment.fechaPago)}</td><td className="px-4 py-3 font-bold text-slate-800">{date(payment.fechaVencimiento)}</td><td className="px-4 py-3 capitalize text-slate-600">{payment.metodoPago || "—"}</td><td className="px-4 py-3 text-right font-mono font-black">{money(payment.monto)}</td></tr>)}{!cliente.pagos?.length && <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-500">Todavía no hay membresías registradas.</td></tr>}</tbody></table></div>
        </section>
      )}

      {tab === "cuenta" && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Saldo" value={money(balance)} detail={balance > 0 ? "Deuda pendiente" : "Cuenta al día"} tone={balance > 0 ? "warn" : "good"} /><SummaryCard label="Límite" value={money(creditLimit)} detail="Crédito configurado" /><SummaryCard label="Disponible" value={money(availableCredit)} detail="Crédito restante" /></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-950">Movimientos de cuenta</h2><p className="text-xs font-medium text-slate-500">Los abonos, cargos y límites se gestionan en Cuentas corrientes.</p></div><Link href={`/dashboard/cuentas?clienteId=${clienteId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800"><Receipt className="h-3.5 w-3.5" />Abrir cuenta</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{account?.movimientos?.map((movement: any) => <tr key={movement.id}><td className="px-4 py-3 text-slate-600">{dateTime(movement.fecha)}</td><td className="px-4 py-3 font-semibold text-slate-900">{movement.concepto || "Movimiento"}</td><td className="px-4 py-3 capitalize text-slate-600">{movement.tipo}</td><td className={`px-4 py-3 text-right font-mono font-black ${movement.tipo === "cargo" ? "text-rose-700" : "text-emerald-700"}`}>{movement.tipo === "cargo" ? "+" : "-"} {money(movement.monto)}</td></tr>)}{!account?.movimientos?.length && <tr><td colSpan={4} className="px-4 py-10 text-center font-semibold text-slate-500">Sin movimientos registrados.</td></tr>}</tbody></table></div></div>
        </section>
      )}

      {tab === "actividad" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"><div className="border-b border-slate-100 p-4"><h2 className="font-black text-slate-950">Ingresos recientes</h2><p className="text-xs font-medium text-slate-500">Últimas marcaciones registradas para el socio.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Ingreso</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{cliente.ingresos?.map((entry: any) => <tr key={entry.id}><td className="px-4 py-3 font-bold text-slate-900">{dateTime(entry.fechaHora)}</td><td className="px-4 py-3 text-slate-600">{dateTime(entry.horaSalida)}</td><td className="px-4 py-3 font-mono text-slate-600">{entry.documento || cliente.documento}</td><td className="px-4 py-3 capitalize text-slate-600">{entry.estado || "registrado"}</td></tr>)}{!cliente.ingresos?.length && <tr><td colSpan={4} className="px-4 py-10 text-center font-semibold text-slate-500">Sin ingresos registrados.</td></tr>}</tbody></table></div></section>
      )}

      {tab === "datos" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="w-full lg:w-48"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Foto</p><button onClick={() => fileInputRef.current?.click()} className="mt-2 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600 hover:border-cyan-400 hover:bg-cyan-50">{photo ? <img src={photo} alt={cliente.nombre} className="h-24 w-24 rounded-2xl object-cover" /> : <Camera className="h-8 w-8" />}<span className="mt-2 text-xs font-bold">Cambiar foto</span></button><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} /></div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2"><Field label="Nombre" value={form.nombre} onChange={(value) => setForm({ ...form, nombre: value })} /><Field label="Apellido" value={form.apellido} onChange={(value) => setForm({ ...form, apellido: value })} /><Field label="Documento" value={form.documento} onChange={(value) => setForm({ ...form, documento: value })} /><Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} /><Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" /><Field label="Dirección" value={form.direccion} onChange={(value) => setForm({ ...form, direccion: value })} /><label className="text-xs font-bold text-slate-700">Estado<select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-500"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label></div>
          </div>
          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4"><button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? "Guardando…" : "Guardar cambios"}</button></div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-700" : "text-slate-950";
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-lg font-black ${toneClass}`}>{value}</p><p className="mt-1 text-[11px] font-medium text-slate-500">{detail}</p></article>;
}

function ActionLink({ href, icon: Icon, title, description }: { href: string; icon: typeof CreditCard; title: string; description: string }) {
  return <Link href={href} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-cyan-300 hover:bg-cyan-50"><span className="flex items-center gap-2 text-sm font-black text-slate-950"><Icon className="h-4 w-4 text-cyan-700" />{title}</span><span className="mt-1 block text-xs font-medium text-slate-500">{description}</span></Link>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-xs font-bold text-slate-700">{label}<input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" /></label>;
}
