"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, Clock3, CreditCard, Edit2, MapPin, Plus, Save, Settings, X } from "lucide-react";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";
import { createMembresiaFull, getAllMembresias, toggleMembresiaEstado, updateMembresia } from "@/app/actions/configuracion";
import { getHorariosSemana, guardarHorariosSemana, type HorarioDiaInput } from "@/app/actions/horarios";
import { createSucursal, getAllSucursalesAdmin, toggleSucursalEstado, updateSucursal } from "@/app/actions/sucursales";

type Membership = { id: number; nombre: string; diasDuracion: number; precio: number; descripcion: string | null; estado: string };
type Branch = { id: number; nombre: string; direccion: string; estado: string; totalClientes: number; totalIngresos: number; totalUsuarios: number; capacidadMaxima: number };
type ScheduleRow = HorarioDiaInput & { id?: number };
type Notice = { type: "success" | "error"; text: string } | null;
type Tab = "membresias" | "horarios" | "sucursales";

const DAY_NAMES: Record<number, string> = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" };

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("membresias");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scheduleBranchId, setScheduleBranchId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [membershipModal, setMembershipModal] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [membershipForm, setMembershipForm] = useState({ nombre: "", diasDuracion: "30", precio: "", descripcion: "" });

  const [branchModal, setBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ nombre: "", direccion: "", capacidadMaxima: "50" });
  const [savingBranch, setSavingBranch] = useState(false);

  const activeBranches = useMemo(() => branches.filter((branch) => branch.estado === "activo"), [branches]);
  const selectedBranch = branches.find((branch) => branch.id === scheduleBranchId) || null;

  const loadMemberships = useCallback(async () => {
    const result = await getAllMembresias();
    if (result.success && result.data) setMemberships(result.data as unknown as Membership[]);
    else setNotice({ type: "error", text: result.error || "No se pudieron cargar los planes" });
  }, []);

  const loadBranches = useCallback(async () => {
    const result = await getAllSucursalesAdmin();
    if (result.success && result.data) {
      const data = result.data as unknown as Branch[];
      setBranches(data);
      return data;
    }
    setNotice({ type: "error", text: result.error || "No se pudieron cargar las sedes" });
    return [] as Branch[];
  }, []);

  const loadSchedules = useCallback(async (branchId: number) => {
    setLoadingSchedules(true);
    const result = await getHorariosSemana(branchId);
    if (result.success && result.data) setSchedules(result.data as unknown as ScheduleRow[]);
    else {
      setSchedules([]);
      setNotice({ type: "error", text: result.error || "No se pudieron cargar los horarios" });
    }
    setLoadingSchedules(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const [contextResult, , branchData] = await Promise.all([getStaffNavigationContext(), loadMemberships(), loadBranches()]);
      const activeServerBranch = contextResult.success ? contextResult.data?.branchId ?? null : null;
      const preferred = branchData.find((branch) => branch.id === activeServerBranch && branch.estado === "activo") || branchData.find((branch) => branch.estado === "activo") || branchData[0] || null;
      if (preferred) {
        setScheduleBranchId(preferred.id);
        await loadSchedules(preferred.id);
      }
      setLoading(false);
    })();
  }, [loadBranches, loadMemberships, loadSchedules]);

  async function changeScheduleBranch(branchId: number) {
    setScheduleBranchId(branchId);
    await loadSchedules(branchId);
  }

  function openNewMembership() {
    setEditingMembership(null);
    setMembershipForm({ nombre: "", diasDuracion: "30", precio: "", descripcion: "" });
    setMembershipModal(true);
  }

  function openEditMembership(item: Membership) {
    setEditingMembership(item);
    setMembershipForm({ nombre: item.nombre, diasDuracion: String(item.diasDuracion), precio: String(item.precio), descripcion: item.descripcion || "" });
    setMembershipModal(true);
  }

  async function submitMembership(event: React.FormEvent) {
    event.preventDefault();
    const payload = { nombre: membershipForm.nombre, diasDuracion: Number(membershipForm.diasDuracion), precio: Number(membershipForm.precio), descripcion: membershipForm.descripcion || null };
    const result = editingMembership ? await updateMembresia(editingMembership.id, payload) : await createMembresiaFull(payload);
    if (!result.success) {
      setNotice({ type: "error", text: result.error || "No se pudo guardar el plan" });
      return;
    }
    setMembershipModal(false);
    setNotice({ type: "success", text: editingMembership ? "Plan actualizado" : "Plan creado" });
    await loadMemberships();
  }

  async function toggleMembership(item: Membership) {
    const result = await toggleMembresiaEstado(item.id);
    setNotice(result.success ? { type: "success", text: `Plan ${result.nuevoEstado === "activo" ? "activado" : "desactivado"}` } : { type: "error", text: result.error || "No se pudo cambiar el estado" });
    if (result.success) await loadMemberships();
  }

  function updateSchedule(index: number, field: keyof ScheduleRow, value: string | number | boolean | null) {
    setSchedules((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function saveSchedules() {
    if (!scheduleBranchId) return;
    setSavingSchedules(true);
    const payload: HorarioDiaInput[] = schedules.map((row) => ({
      diaSemana: row.diaSemana,
      tipoApertura: row.tipoApertura,
      horaApertura1: row.horaApertura1 || null,
      horaCierre1: row.horaCierre1 || null,
      horaApertura2: row.horaApertura2 || null,
      horaCierre2: row.horaCierre2 || null,
      capacidadMaxima: Number(row.capacidadMaxima ?? 50),
      activo: row.tipoApertura !== "cerrado",
    }));
    const result = await guardarHorariosSemana(scheduleBranchId, payload);
    setNotice(result.success ? { type: "success", text: `Horarios de ${selectedBranch?.nombre || "la sede"} guardados` } : { type: "error", text: result.error || "No se pudieron guardar los horarios" });
    if (result.success) await loadSchedules(scheduleBranchId);
    setSavingSchedules(false);
  }

  function openNewBranch() {
    setEditingBranch(null);
    setBranchForm({ nombre: "", direccion: "", capacidadMaxima: "50" });
    setBranchModal(true);
  }

  function openEditBranch(branch: Branch) {
    setEditingBranch(branch);
    setBranchForm({ nombre: branch.nombre, direccion: branch.direccion || "", capacidadMaxima: String(branch.capacidadMaxima || 50) });
    setBranchModal(true);
  }

  async function submitBranch(event: React.FormEvent) {
    event.preventDefault();
    setSavingBranch(true);
    const payload = { nombre: branchForm.nombre, direccion: branchForm.direccion, capacidadMaxima: Number(branchForm.capacidadMaxima) };
    const result = editingBranch ? await updateSucursal(editingBranch.id, payload) : await createSucursal(payload);
    if (result.success) {
      setBranchModal(false);
      setNotice({ type: "success", text: editingBranch ? "Sede actualizada" : "Sede creada" });
      const data = await loadBranches();
      if (!scheduleBranchId && data.length) setScheduleBranchId(data.find((branch) => branch.estado === "activo")?.id || data[0].id);
    } else setNotice({ type: "error", text: result.error || "No se pudo guardar la sede" });
    setSavingBranch(false);
  }

  async function toggleBranch(branch: Branch) {
    const result = await toggleSucursalEstado(branch.id);
    setNotice(result.success ? { type: "success", text: `Sede ${result.nuevoEstado === "activo" ? "activada" : "desactivada"}` } : { type: "error", text: result.error || "No se pudo cambiar el estado de la sede" });
    if (result.success) await loadBranches();
  }

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-slate-500">Preparando configuración…</div>;

  return <div className="mx-auto max-w-7xl space-y-5 font-sans">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Gestión</p><h1 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><Settings className="h-5 w-5 text-cyan-600" />Configuración del gimnasio</h1><p className="mt-1 text-xs font-medium text-slate-500">Planes, horarios, aforo y sedes administrados desde el contexto real del tenant.</p></div><div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">{([['membresias','Membresías',CreditCard],['horarios','Horarios y aforo',Clock3],['sucursales',`Sedes (${branches.length})`,Building2]] as const).map(([key,label,Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${tab === key ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"}`}><Icon className="h-3.5 w-3.5 text-cyan-600" />{label}</button>)}</div></div></section>

    {notice && <button onClick={() => setNotice(null)} className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-xs font-bold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>{notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{notice.text}</button>}

    {tab === "membresias" && <section className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><div><h2 className="text-sm font-black">Planes de membresía</h2><p className="text-xs text-slate-500">Duración y precio usados al cobrar renovaciones.</p></div><button onClick={openNewMembership} className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />Nuevo plan</button></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-xs"><thead className="border-b bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 text-left">Plan</th><th className="px-4 py-3 text-left">Duración</th><th className="px-4 py-3 text-right">Precio</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{memberships.map((item) => <tr key={item.id}><td className="px-4 py-3"><strong className="block text-slate-950">{item.nombre}</strong><span className="text-[11px] text-slate-500">{item.descripcion || "Sin descripción"}</span></td><td className="px-4 py-3 font-mono font-bold">{item.diasDuracion} días</td><td className="px-4 py-3 text-right font-mono font-black">{money(item.precio)}</td><td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.estado === "activo" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.estado}</span></td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditMembership(item)} className="rounded-lg border px-2.5 py-1.5 font-bold"><Edit2 className="inline h-3 w-3" /> Editar</button><button onClick={() => void toggleMembership(item)} className="rounded-lg border px-2.5 py-1.5 font-bold">{item.estado === "activo" ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div></div></section>}

    {tab === "horarios" && <section className="space-y-4"><div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between"><div><label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Sede a configurar</label><select value={scheduleBranchId ?? ""} onChange={(event) => void changeScheduleBranch(Number(event.target.value))} className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-950">{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}</select><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="h-3 w-3" />La sede se selecciona desde datos del servidor; no desde localStorage.</p></div><button onClick={() => void saveSchedules()} disabled={!scheduleBranchId || savingSchedules || loadingSchedules} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{savingSchedules ? "Guardando…" : "Guardar semana"}</button></div>{loadingSchedules ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Cargando horarios…</div> : schedules.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">No hay horarios disponibles.</div> : <div className="space-y-2">{schedules.map((row,index) => { const closed = row.tipoApertura === "cerrado"; return <article key={row.diaSemana} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[130px_150px_1fr_120px] lg:items-center"><strong className="text-sm">{DAY_NAMES[row.diaSemana]}</strong><select value={row.tipoApertura} onChange={(event) => updateSchedule(index,"tipoApertura",event.target.value)} className="rounded-lg border px-2 py-2 text-xs font-bold"><option value="completo">Completo</option><option value="mañana">Mañana</option><option value="tarde">Tarde</option><option value="doble">Doble turno</option><option value="cerrado">Cerrado</option></select><div className="flex flex-wrap items-center gap-2">{!closed && <><input type="time" value={row.horaApertura1 || ""} onChange={(event) => updateSchedule(index,"horaApertura1",event.target.value)} className="rounded-lg border px-2 py-2 text-xs" /><span className="text-xs text-slate-400">a</span><input type="time" value={row.horaCierre1 || ""} onChange={(event) => updateSchedule(index,"horaCierre1",event.target.value)} className="rounded-lg border px-2 py-2 text-xs" />{row.tipoApertura === "doble" && <><span className="text-xs text-slate-400">y</span><input type="time" value={row.horaApertura2 || ""} onChange={(event) => updateSchedule(index,"horaApertura2",event.target.value)} className="rounded-lg border px-2 py-2 text-xs" /><span className="text-xs text-slate-400">a</span><input type="time" value={row.horaCierre2 || ""} onChange={(event) => updateSchedule(index,"horaCierre2",event.target.value)} className="rounded-lg border px-2 py-2 text-xs" /></>}</>}</div><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Aforo<input type="number" min={closed ? 0 : 1} max={100000} disabled={closed} value={closed ? 0 : Number(row.capacidadMaxima ?? 50)} onChange={(event) => updateSchedule(index,"capacidadMaxima",Number(event.target.value))} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs font-bold disabled:bg-slate-100" /></label></article>; })}</div>}</section>}

    {tab === "sucursales" && <section className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><div><h2 className="text-sm font-black">Sedes</h2><p className="text-xs text-slate-500">Estructura, capacidad y estado operativo.</p></div><button onClick={openNewBranch} className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />Nueva sede</button></div><div className="grid gap-3 md:grid-cols-2">{branches.map((branch) => <article key={branch.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-cyan-600" /><h3 className="font-black">{branch.nombre}</h3></div><p className="mt-1 text-xs text-slate-500">{branch.direccion || "Sin dirección cargada"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${branch.estado === "activo" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{branch.estado}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-950">{branch.totalClientes}</strong>socios</div><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-950">{branch.totalUsuarios}</strong>staff</div><div className="rounded-lg bg-slate-50 p-2"><strong className="block text-sm text-slate-950">{branch.capacidadMaxima}</strong>aforo</div></div><div className="mt-4 flex justify-end gap-2"><button onClick={() => openEditBranch(branch)} className="rounded-lg border px-3 py-2 text-xs font-bold">Editar</button><button onClick={() => void toggleBranch(branch)} className="rounded-lg border px-3 py-2 text-xs font-bold">{branch.estado === "activo" ? "Desactivar" : "Activar"}</button></div></article>)}</div></section>}

    {membershipModal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={submitMembership} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 className="font-black">{editingMembership ? "Editar plan" : "Nuevo plan"}</h3><button type="button" onClick={() => setMembershipModal(false)}><X className="h-4 w-4" /></button></div><label className="block text-xs font-bold">Nombre<input required value={membershipForm.nombre} onChange={(event) => setMembershipForm({ ...membershipForm, nombre: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold">Duración<input required type="number" min="1" max="3650" value={membershipForm.diasDuracion} onChange={(event) => setMembershipForm({ ...membershipForm, diasDuracion: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-xs font-bold">Precio<input required type="number" min="0" step="0.01" value={membershipForm.precio} onChange={(event) => setMembershipForm({ ...membershipForm, precio: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><label className="block text-xs font-bold">Descripción<textarea value={membershipForm.descripcion} onChange={(event) => setMembershipForm({ ...membershipForm, descripcion: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" /></label><button type="submit" className="w-full rounded-lg bg-slate-950 py-2.5 text-xs font-bold text-white">Guardar plan</button></form></div>}

    {branchModal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={submitBranch} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 className="font-black">{editingBranch ? "Editar sede" : "Nueva sede"}</h3><button type="button" onClick={() => setBranchModal(false)}><X className="h-4 w-4" /></button></div><label className="block text-xs font-bold">Nombre<input required value={branchForm.nombre} onChange={(event) => setBranchForm({ ...branchForm, nombre: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-xs font-bold">Dirección<input value={branchForm.direccion} onChange={(event) => setBranchForm({ ...branchForm, direccion: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-xs font-bold">Capacidad máxima<input required type="number" min="1" max="100000" value={branchForm.capacidadMaxima} onChange={(event) => setBranchForm({ ...branchForm, capacidadMaxima: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><button type="submit" disabled={savingBranch} className="w-full rounded-lg bg-slate-950 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingBranch ? "Guardando…" : "Guardar sede"}</button></form></div>}
  </div>;
}
