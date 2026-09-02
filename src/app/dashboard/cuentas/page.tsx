"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  History,
  Receipt,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import {
  getAccountOperationsContext,
  getCuentas,
  getMovimientosCuenta,
  registrarCargoCuenta,
  registrarPagoCuenta,
  setLimiteCredito,
} from "@/app/actions/cuentas";
import MemberOperationsNav from "@/components/MemberOperationsNav";

type Modal = "pago" | "cargo" | "limite" | null;
type Notice = { type: "success" | "error"; text: string } | null;

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateTime(value?: string | Date | null) {
  return value ? new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export default function CuentasCorrientesPage() {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("con_deuda");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [canSetCreditLimit, setCanSetCreditLimit] = useState(false);

  const loadMovements = async (clienteId: number) => {
    const result = await getMovimientosCuenta(clienteId);
    if (result.success && result.data) setMovimientos(result.data);
    else setMovimientos([]);
  };

  const loadAccounts = async (preferredClienteId?: number) => {
    setLoading(true);
    const result = await getCuentas();
    if (result.success && result.data) {
      const data = result.data as any[];
      setCuentas(data);
      const targetId = preferredClienteId || selected?.clienteId;
      if (targetId) {
        const account = data.find((item) => item.clienteId === targetId);
        if (account) {
          setSelected(account);
          await loadMovements(account.clienteId);
        } else if (preferredClienteId) {
          setSelected(null);
          setMovimientos([]);
          setNotice({ type: "error", text: "Ese socio no tiene una cuenta accesible desde tu sede activa." });
        }
      }
    } else {
      setNotice({ type: "error", text: result.error || "No se pudieron cargar las cuentas" });
    }
    setLoading(false);
  };

  useEffect(() => {
    const clienteId = Number(new URLSearchParams(window.location.search).get("clienteId") || 0);
    if (Number.isInteger(clienteId) && clienteId > 0) setFilter("todos");
    void getAccountOperationsContext().then((result) => {
      if (result.success && result.data) setCanSetCreditLimit(Boolean(result.data.canSetCreditLimit));
    });
    void loadAccounts(clienteId > 0 ? clienteId : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAccount = async (account: any) => {
    setSelected(account);
    setNotice(null);
    await loadMovements(account.clienteId);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cuentas.filter((account) => {
      const balance = Number(account.saldo || 0);
      const limit = Number(account.limiteCredito || 0);
      if (filter === "con_deuda" && balance <= 0) return false;
      if (filter === "sin_deuda" && balance > 0) return false;
      if (filter === "excedido" && balance <= limit) return false;
      if (!term) return true;
      const text = `${account.cliente?.nombre || ""} ${account.cliente?.apellido || ""} ${account.cliente?.documento || ""}`.toLowerCase();
      return text.includes(term);
    });
  }, [cuentas, filter, search]);

  const openModal = (type: Exclude<Modal, null>) => {
    if (!selected || (type === "limite" && !canSetCreditLimit)) return;
    setModal(type);
    setConcept("");
    setAmount(type === "limite" ? String(Number(selected.limiteCredito || 0)) : "");
    setNotice(null);
  };

  const processOperation = async () => {
    if (!selected || !modal) return;
    if (modal === "limite" && !canSetCreditLimit) {
      setNotice({ type: "error", text: "Tu rol no permite modificar límites de crédito." });
      setModal(null);
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || (modal !== "limite" && numericAmount <= 0)) {
      setNotice({ type: "error", text: "Ingresá un monto válido." });
      return;
    }

    setProcessing(true);
    setNotice(null);
    let result;
    if (modal === "pago") result = await registrarPagoCuenta(selected.clienteId, numericAmount, concept.trim() || "Abono a cuenta corriente");
    else if (modal === "cargo") result = await registrarCargoCuenta(selected.clienteId, numericAmount, concept.trim() || "Cargo manual a cuenta corriente");
    else result = await setLimiteCredito(selected.clienteId, numericAmount);

    if (result?.success) {
      setModal(null);
      setAmount("");
      setConcept("");
      setNotice({ type: "success", text: modal === "pago" ? "Abono registrado." : modal === "cargo" ? "Cargo registrado." : "Límite actualizado." });
      await loadAccounts(selected.clienteId);
    } else {
      setNotice({ type: "error", text: result?.error || "No se pudo completar la operación" });
    }
    setProcessing(false);
  };

  const totalDebt = cuentas.reduce((sum, account) => sum + Math.max(0, Number(account.saldo || 0)), 0);
  const debtors = cuentas.filter((account) => Number(account.saldo || 0) > 0).length;
  const exceeded = cuentas.filter((account) => Number(account.saldo || 0) > Number(account.limiteCredito || 0)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MemberOperationsNav />

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Socios · Finanzas</p><h1 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><Receipt className="h-5 w-5 text-cyan-700" />Cuentas corrientes</h1><p className="mt-1 text-xs font-medium text-slate-500">Deudas de consumos, abonos y límites de crédito. Recepción trabaja sólo con socios de la sede activa.</p></div>
          <Link href="/dashboard/pagos" className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-50"><CreditCard className="h-3.5 w-3.5" />Ir a cobros</Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Deuda total" value={money(totalDebt)} detail={`${debtors} socios con saldo`} />
        <Kpi label="Cuentas activas" value={String(cuentas.length)} detail="Socios visibles en tu alcance" />
        <Kpi label="Límite excedido" value={String(exceeded)} detail={exceeded ? "Requieren revisión" : "Sin alertas"} alert={exceeded > 0} />
      </section>

      {notice && <button onClick={() => setNotice(null)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold ${notice.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>{notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{notice.text}</button>}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-4">
          <div className="space-y-2 border-b border-slate-100 bg-slate-50 p-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="DNI, nombre o apellido" className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs font-medium outline-none focus:border-cyan-500" /></div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none"><option value="todos">Todas las cuentas</option><option value="con_deuda">Con deuda</option><option value="sin_deuda">Sin deuda</option><option value="excedido">Límite excedido</option></select>
          </div>
          <div className="max-h-[590px] divide-y divide-slate-100 overflow-y-auto">
            {loading ? <p className="p-8 text-center text-xs font-semibold text-slate-500">Cargando cuentas…</p> : filtered.length === 0 ? <p className="p-8 text-center text-xs font-semibold text-slate-500">No hay cuentas para este filtro.</p> : filtered.map((account) => {
              const balance = Number(account.saldo || 0);
              const limit = Number(account.limiteCredito || 0);
              const active = selected?.id === account.id;
              return <button key={account.id} onClick={() => void selectAccount(account)} className={`w-full border-l-2 px-4 py-3 text-left transition ${active ? "border-cyan-600 bg-cyan-50" : "border-transparent hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{account.cliente?.nombre} {account.cliente?.apellido}</p><p className="mt-0.5 text-[10px] font-mono font-semibold text-slate-500">DNI {account.cliente?.documento}</p></div><div className="shrink-0 text-right"><p className={`font-mono text-sm font-black ${balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(balance)}</p><p className={`mt-0.5 text-[9px] font-bold ${balance > limit ? "text-rose-600" : "text-slate-400"}`}>{balance > limit ? "LÍMITE EXCEDIDO" : limit > 0 ? `Límite ${money(limit)}` : "Sin crédito"}</p></div></div></button>;
            })}
          </div>
        </section>

        <section className="space-y-4 lg:col-span-8">
          {!selected ? (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xs"><div><UserRound className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-2 text-sm font-black text-slate-800">Elegí un socio</h2><p className="mt-1 text-xs font-medium text-slate-500">Acá vas a ver su saldo, límite y movimientos.</p></div></div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cuenta seleccionada</p><h2 className="mt-1 text-lg font-black text-slate-950">{selected.cliente?.nombre} {selected.cliente?.apellido}</h2><p className="text-xs font-mono font-semibold text-slate-500">DNI {selected.cliente?.documento}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/dashboard/clientes/${selected.clienteId}`} className="text-xs font-black text-cyan-700 hover:underline">Abrir ficha</Link><span className="text-slate-300">·</span><Link href={`/dashboard/pagos?clienteId=${selected.clienteId}`} className="text-xs font-black text-cyan-700 hover:underline">Cobrar membresía</Link></div></div>
                  <div className="min-w-52 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Saldo deudor</p><p className={`mt-1 font-mono text-2xl font-black ${Number(selected.saldo) > 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(selected.saldo)}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{Number(selected.limiteCredito) > 0 ? `Límite ${money(selected.limiteCredito)}` : "Crédito no habilitado"}</p></div>
                </div>
                <div className={`mt-4 grid gap-2 border-t border-slate-100 pt-4 ${canSetCreditLimit ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}><button onClick={() => openModal("pago")} disabled={Number(selected.saldo) <= 0} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowDownRight className="h-3.5 w-3.5" />Registrar abono</button><button onClick={() => openModal("cargo")} disabled={Number(selected.limiteCredito) <= 0} className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUpRight className="h-3.5 w-3.5" />Registrar cargo</button>{canSetCreditLimit && <button onClick={() => openModal("limite")} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-800"><Settings className="h-3.5 w-3.5" />Ajustar límite</button>}</div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="border-b border-slate-100 px-4 py-3"><h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900"><History className="h-3.5 w-3.5 text-cyan-700" />Movimientos</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3 text-right">Movimiento</th></tr></thead><tbody className="divide-y divide-slate-100">{movimientos.map((movement) => <tr key={movement.id}><td className="px-4 py-3 text-slate-500">{dateTime(movement.fecha)}</td><td className="px-4 py-3 font-bold text-slate-900">{movement.concepto || "Movimiento"}</td><td className="px-4 py-3 text-slate-500">{movement.usuario || "Sistema"}</td><td className={`px-4 py-3 text-right font-mono font-black ${movement.tipo === "cargo" ? "text-rose-700" : "text-emerald-700"}`}>{movement.tipo === "cargo" ? "+" : "-"} {money(movement.monto)}</td></tr>)}{movimientos.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center font-semibold text-slate-500">Sin movimientos registrados.</td></tr>}</tbody></table></div>
              </div>
            </>
          )}
        </section>
      </div>

      {modal && selected && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">{selected.cliente?.nombre} {selected.cliente?.apellido}</p><h2 className="mt-1 text-lg font-black text-slate-950">{modal === "pago" ? "Registrar abono" : modal === "cargo" ? "Registrar cargo" : "Ajustar límite"}</h2></div><button onClick={() => setModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 space-y-3"><label className="block text-xs font-black text-slate-700">{modal === "limite" ? "Nuevo límite" : "Monto"}<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-lg font-black outline-none focus:border-cyan-500" /></label>{modal !== "limite" && <label className="block text-xs font-black text-slate-700">Concepto <span className="font-medium text-slate-400">(opcional)</span><input value={concept} onChange={(event) => setConcept(event.target.value)} placeholder={modal === "pago" ? "Ej: abono en efectivo" : "Ej: consumo cargado manualmente"} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-cyan-500" /></label>}{modal === "pago" && <p className="rounded-lg bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-800">Saldo actual: {money(selected.saldo)}. El servidor no permite abonar más que la deuda existente.</p>}{modal === "cargo" && <p className="rounded-lg bg-rose-50 p-2 text-[11px] font-semibold text-rose-800">Disponible antes del cargo: {money(Math.max(0, Number(selected.limiteCredito) - Number(selected.saldo)))}.</p>}</div>
            <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4"><button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-black text-slate-700">Cancelar</button><button onClick={processOperation} disabled={processing} className="flex-1 rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white disabled:opacity-50">{processing ? "Procesando…" : "Confirmar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, detail, alert = false }: { label: string; value: string; detail: string; alert?: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${alert ? "text-rose-700" : "text-slate-950"}`}>{value}</p><p className="mt-0.5 text-[11px] font-medium text-slate-500">{detail}</p></article>;
}
