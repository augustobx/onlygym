"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, LogOut, MapPin, RefreshCw, Search, Users } from "lucide-react";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";
import { getAforoEnVivo, marcarSalidaTodos, registrarSalidaPorDocumento, registrarSalidaSocio } from "@/app/actions/horarios";

type OccupancyData = {
  personasAdentro: number;
  capacidadMaxima: number;
  porcentaje: number;
  nivel: "bajo" | "medio" | "alto" | "alerta";
  nivelTexto: string;
  duracionPromedio: number;
  personasPresentes: Array<{
    id: number;
    ingresoId: number;
    clienteId: number;
    nombre: string;
    documento: string;
    horaEntrada: string;
    minutosAdentro: number;
    tiempoFormateado: string;
  }>;
  ultimasSalidas: Array<{
    id: number;
    nombre: string;
    documento: string;
    horaEntrada: string;
    horaSalida: string | null;
    duracionMinutos: number;
  }>;
};

type Notice = { type: "success" | "error"; text: string } | null;

const emptyOccupancy: OccupancyData = {
  personasAdentro: 0,
  capacidadMaxima: 50,
  porcentaje: 0,
  nivel: "bajo",
  nivelTexto: "Sin datos de ocupación",
  duracionPromedio: 0,
  personasPresentes: [],
  ultimasSalidas: [],
};

function time(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function AforoTiempoRealPage() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState("Sucursal activa");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [occupancy, setOccupancy] = useState<OccupancyData>(emptyOccupancy);
  const [search, setSearch] = useState("");
  const [document, setDocument] = useState("");
  const [processingExit, setProcessingExit] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadOccupancy = useCallback(async (activeBranchId: number, showLoading = false) => {
    if (showLoading) setLoading(true);
    const result = await getAforoEnVivo(activeBranchId);
    if (result.success && result.data) setOccupancy(result.data as unknown as OccupancyData);
    else setNotice({ type: "error", text: result.error || "No se pudo cargar el aforo" });
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    void getStaffNavigationContext().then(async (result) => {
      if (!result.success || !result.data?.branchId) {
        setReady(true);
        return;
      }
      setBranchId(result.data.branchId);
      setBranchName(result.data.branchName || "Sucursal activa");
      setReady(true);
      await loadOccupancy(result.data.branchId, true);
      interval = window.setInterval(() => void loadOccupancy(result.data!.branchId!, false), 10000);
    });
    return () => { if (interval) window.clearInterval(interval); };
  }, [loadOccupancy]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return occupancy.personasPresentes;
    return occupancy.personasPresentes.filter((person) => person.nombre.toLowerCase().includes(q) || person.documento.includes(q));
  }, [occupancy.personasPresentes, search]);

  const exitOne = async (ingresoId: number, name: string) => {
    const result = await registrarSalidaSocio(ingresoId);
    setNotice(result.success
      ? { type: "success", text: `Salida registrada para ${name}. Permanencia: ${result.duracionMinutos} min.` }
      : { type: "error", text: result.error || "No se pudo registrar la salida" });
    if (result.success && branchId) await loadOccupancy(branchId);
  };

  const exitByDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchId || !document.trim()) return;
    setProcessingExit(true);
    const result = await registrarSalidaPorDocumento(document.trim(), branchId);
    setNotice(result.success
      ? { type: "success", text: result.mensaje || "Salida registrada" }
      : { type: "error", text: result.error || "No se encontró un ingreso activo" });
    if (result.success) {
      setDocument("");
      await loadOccupancy(branchId);
    }
    setProcessingExit(false);
  };

  const exitAll = async () => {
    if (!branchId || !window.confirm(`¿Marcar la salida de las ${occupancy.personasAdentro} personas presentes en ${branchName}?`)) return;
    const result = await marcarSalidaTodos(branchId);
    setNotice(result.success
      ? { type: "success", text: `Se cerraron ${result.count} ingresos activos.` }
      : { type: "error", text: result.error || "No se pudieron cerrar los ingresos" });
    if (result.success) await loadOccupancy(branchId);
  };

  if (!ready) return <div className="py-20 text-center text-sm font-semibold text-slate-500">Preparando aforo…</div>;

  if (!branchId) {
    return <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><MapPin className="mx-auto h-7 w-7 text-amber-700" /><h1 className="mt-2 text-lg font-black text-amber-950">Seleccioná una sucursal</h1><p className="mt-1 text-sm text-amber-800">El aforo es una operación de sede y necesita un contexto activo validado por el servidor.</p><Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Seleccionar sucursal</Link></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 font-sans">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Operación · {branchName}</p><h1 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><Activity className="h-5 w-5 text-cyan-600" />Aforo en tiempo real</h1><p className="mt-1 text-xs font-medium text-slate-600">Ingresos abiertos, permanencia y salidas de la sede activa.</p></div>
        <div className="flex gap-2"><button onClick={() => void loadOccupancy(branchId, true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800"><RefreshCw className={`h-4 w-4 text-cyan-600 ${loading ? "animate-spin" : ""}`} />Actualizar</button>{occupancy.personasAdentro > 0 && <button onClick={() => void exitAll()} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800"><LogOut className="h-4 w-4" />Salida masiva</button>}</div>
      </header>

      {notice && <button onClick={() => setNotice(null)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold ${notice.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>{notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}</button>}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Personas adentro" value={`${occupancy.personasAdentro} / ${occupancy.capacidadMaxima}`} detail={occupancy.nivelTexto} />
        <Metric label="Ocupación" value={`${occupancy.porcentaje}%`} detail="Actualizado cada 10 segundos" />
        <Metric label="Permanencia promedio" value={`${occupancy.duracionPromedio} min`} detail="Sobre salidas registradas hoy" />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-black text-slate-950"><Users className="h-4 w-4 text-cyan-600" />Socios presentes</h2><p className="text-[11px] font-medium text-slate-500">{occupancy.personasPresentes.length} ingresos abiertos en {branchName}</p></div><label className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o DNI" className="h-9 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-xs font-semibold outline-none focus:border-cyan-500" /></label></div>
          <div className="max-h-[520px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Socio</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Permanencia</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredPeople.map((person) => <tr key={person.ingresoId}><td className="px-4 py-3"><p className="font-black text-slate-950">{person.nombre}</p><p className="font-mono text-[10px] text-slate-500">DNI {person.documento}</p></td><td className="px-4 py-3 font-mono text-slate-600">{time(person.horaEntrada)}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700"><Clock3 className="h-3 w-3 text-cyan-600" />{person.tiempoFormateado}</span></td><td className="px-4 py-3 text-right"><button onClick={() => void exitOne(person.ingresoId, person.nombre)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">Marcar salida</button></td></tr>)}{!filteredPeople.length && <tr><td colSpan={4} className="px-4 py-12 text-center font-semibold text-slate-500">No hay socios presentes que coincidan con la búsqueda.</td></tr>}</tbody></table></div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <form onSubmit={exitByDocument} className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs"><h2 className="font-black text-slate-950">Salida manual por DNI</h2><p className="mt-1 text-xs font-medium text-slate-500">Usalo cuando el socio no haya registrado la salida en el dispositivo.</p><input value={document} onChange={(event) => setDocument(event.target.value)} placeholder="Número de documento" className="mt-4 h-10 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold outline-none focus:border-cyan-500" /><button disabled={processingExit || !document.trim()} className="mt-2 h-10 w-full rounded-xl bg-slate-950 text-xs font-black text-white disabled:opacity-40">{processingExit ? "Procesando…" : "Registrar salida"}</button></form>

          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-black text-slate-950">Últimas salidas</h2></div><div className="divide-y divide-slate-100">{occupancy.ultimasSalidas.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-xs font-black text-slate-900">{entry.nombre}</p><p className="text-[10px] font-medium text-slate-500">{entry.horaSalida ? time(entry.horaSalida) : "—"}</p></div><span className="shrink-0 font-mono text-[10px] font-black text-slate-600">{entry.duracionMinutos} min</span></div>)}{!occupancy.ultimasSalidas.length && <p className="p-6 text-center text-xs font-medium text-slate-500">Todavía no hay salidas hoy.</p>}</div></section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] font-medium text-slate-500">{detail}</p></article>;
}
