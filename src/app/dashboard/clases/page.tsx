"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Edit3,
  Filter,
  Plus,
  Search,
  UserPlus,
  UserRoundCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  actualizarClase,
  administrarReservaManual,
  cancelarClaseAdmin,
  crearClase,
  crearTipoClase,
  getClasesAdmin,
  registrarAsistenciaClase,
} from "@/app/actions/gestion-fitness";
import { buscarSociosParaClase, cancelarReservaClaseOperativa, getClassOperationsContext } from "@/app/actions/clases-context";

type Booking = {
  id: number;
  estado: string;
  posicionEspera?: number | null;
  asistenciaEn?: string | null;
  cliente: { id: number; nombre: string; apellido: string; documento: string };
};

type GymClass = {
  id: number;
  inicio: string;
  duracionMinutos: number;
  cupoMaximo: number;
  estado: string;
  sala?: string | null;
  tipoClase: { id?: number; nombre: string; color?: string | null };
  tipoClaseId?: number;
  sucursal: { id?: number; nombre: string };
  sucursalId?: number;
  entrenador?: { id?: number; user: { name: string } } | null;
  entrenadorId?: number | null;
  reservas: Booking[];
};

type ClassData = {
  classes: GymClass[];
  classTypes: Array<{ id: number; nombre: string }>;
  branches: Array<{ id: number; nombre: string }>;
  trainers: Array<{ id: number; user: { name: string } }>;
};

type ClassContext = {
  role: string;
  branchId: number | null;
  trainerProfileId: number | null;
  canManageActivityTypes: boolean;
};

type EligibleMember = { id: number; nombre: string; apellido: string; documento: string };

function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dateKey(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ClassesPage() {
  const [data, setData] = useState<ClassData>({ classes: [], classTypes: [], branches: [], trainers: [] });
  const [context, setContext] = useState<ClassContext | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [view, setView] = useState<"dia" | "semana">("semana");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [query, setQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [enrollModalClass, setEnrollModalClass] = useState<GymClass | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientsList, setClientsList] = useState<EligibleMember[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [classesResult, contextResult] = await Promise.all([getClasesAdmin(), getClassOperationsContext()]);
    if (classesResult.success) setData(classesResult.data as unknown as ClassData);
    else setMessage(classesResult.error || "No se pudo cargar la agenda");
    if (contextResult.success && contextResult.data) setContext(contextResult.data as ClassContext);
    else if (!classesResult.success) setMessage(contextResult.error || "No se pudo resolver el contexto operativo");
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const from = new Date(`${selectedDate}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + (view === "dia" ? 1 : 7));
    const clean = query.trim().toLocaleLowerCase("es");

    return data.classes.filter((item) => {
      const start = new Date(item.inicio);
      const matchesPeriod = start >= from && start < to;
      const matchesSearch = !clean || [item.tipoClase.nombre, item.sucursal.nombre, item.entrenador?.user.name, item.sala].some((value) => value?.toLocaleLowerCase("es").includes(clean));
      const matchesBranch = !selectedBranch || item.sucursalId === selectedBranch || item.sucursal.id === selectedBranch;
      const matchesType = !selectedType || item.tipoClaseId === selectedType || item.tipoClase.id === selectedType;
      const matchesTrainer = !selectedTrainer || item.entrenadorId === selectedTrainer || item.entrenador?.id === selectedTrainer;
      return matchesPeriod && matchesSearch && matchesBranch && matchesType && matchesTrainer;
    });
  }, [data.classes, query, selectedDate, view, selectedBranch, selectedType, selectedTrainer]);

  const trainerOptions = context?.role === "ENTRENADOR"
    ? data.trainers.filter((trainer) => trainer.id === context.trainerProfileId)
    : data.trainers;

  const openCreate = () => {
    setEditing(null);
    setModal(true);
  };

  const openEdit = (item: GymClass) => {
    setEditing(item);
    setModal(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const input = {
      tipoClaseId: Number(form.get("tipoClaseId")),
      entrenadorId: form.get("entrenadorId") ? Number(form.get("entrenadorId")) : null,
      sucursalId: Number(form.get("sucursalId")),
      sala: String(form.get("sala") || ""),
      inicio: new Date(String(form.get("inicio"))).toISOString(),
      duracionMinutos: Number(form.get("duracionMinutos")),
      cupoMaximo: Number(form.get("cupoMaximo")),
    };
    const result = editing ? await actualizarClase(editing.id, input) : await crearClase(input);
    setMessage(result.success ? (editing ? "Clase actualizada" : "Clase programada") : result.error || "No se pudo guardar");
    if (result.success) {
      setModal(false);
      setEditing(null);
      await load();
    }
    setSaving(false);
  };

  const cancel = async (item: GymClass) => {
    if (!window.confirm(`¿Cancelar ${item.tipoClase.nombre}? Se notificará a las personas con reserva.`)) return;
    const result = await cancelarClaseAdmin(item.id);
    setMessage(result.success ? `Clase cancelada · ${result.data?.reservasCanceladas || 0} reservas notificadas` : result.error || "No se pudo cancelar");
    if (result.success) await load();
  };

  const handleToggleAttendance = async (booking: Booking) => {
    const wasPresent = booking.estado === "asistio";
    if (wasPresent && !window.confirm("¿Quitar la asistencia registrada?")) return;
    const result = await registrarAsistenciaClase(booking.id, !wasPresent);
    setMessage(result.success ? (wasPresent ? "Asistencia corregida" : "Asistencia registrada") : result.error || "No se pudo registrar la asistencia");
    if (result.success) await load();
  };

  const loadEligibleMembers = async (gymClass: GymClass, search = "") => {
    setSearchingMembers(true);
    const result = await buscarSociosParaClase(gymClass.id, search);
    if (result.success && result.data) setClientsList(result.data as EligibleMember[]);
    else {
      setClientsList([]);
      setMessage(result.error || "No se pudieron buscar socios para esta clase");
    }
    setSearchingMembers(false);
  };

  const openEnrollment = async (gymClass: GymClass) => {
    setEnrollModalClass(gymClass);
    setClientSearch("");
    setClientsList([]);
    await loadEligibleMembers(gymClass);
  };

  const handleManualEnroll = async (clienteId: number) => {
    if (!enrollModalClass) return;
    setEnrolling(true);
    const result = await administrarReservaManual(enrollModalClass.id, clienteId, "inscribir");
    setMessage(result.success ? result.mensaje || "Socio inscrito" : result.error || "No se pudo inscribir");
    if (result.success) {
      setEnrollModalClass(null);
      await load();
    }
    setEnrolling(false);
  };

  const handleCancelBooking = async (claseId: number, clienteId: number) => {
    if (!window.confirm("¿Cancelar esta reserva? Si era un cupo confirmado, se promoverá a la primera persona en espera.")) return;
    const result = await cancelarReservaClaseOperativa(claseId, clienteId);
    setMessage(result.success ? "Reserva cancelada" : result.error || "No se pudo cancelar la reserva");
    if (result.success) await load();
  };

  const createType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await crearTipoClase({
      nombre: String(form.get("nombre")),
      descripcion: String(form.get("descripcion") || ""),
      color: String(form.get("color") || "") || undefined,
    });
    setMessage(result.success ? "Tipo de clase creado" : result.error || "No se pudo crear");
    if (result.success) {
      formElement.reset();
      await load();
    }
  };

  const confirmedTotal = visible.reduce((sum, item) => sum + item.reservas.filter((booking) => ["confirmada", "asistio"].includes(booking.estado)).length, 0);
  const waitingTotal = visible.reduce((sum, item) => sum + item.reservas.filter((booking) => booking.estado === "espera").length, 0);
  const attendedTotal = visible.reduce((sum, item) => sum + item.reservas.filter((booking) => booking.estado === "asistio").length, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Agenda operativa</p>
          <h1 className="mt-1 text-2xl font-black">Clases y reservas</h1>
          <p className="mt-1 text-sm text-slate-500">Programación, cupos, inscripción, lista de espera y asistencia desde un mismo lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {context?.role !== "RECEPCION" && (
            <Link href="/dashboard/entrenamiento" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">
              <Dumbbell className="h-4 w-4" /> Rutinas y planes
            </Link>
          )}
          <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Programar clase
          </button>
        </div>
      </header>

      {message && (
        <button onClick={() => setMessage(null)} className="flex w-full items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-left text-sm font-bold text-cyan-900">
          <span>{message}</span><span className="text-xs font-medium underline">Cerrar</span>
        </button>
      )}

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat icon={CalendarDays} value={visible.length} label={view === "dia" ? "Clases del día" : "Clases en 7 días"} />
        <Stat icon={UserRoundCheck} value={confirmedTotal} label="Cupos confirmados" />
        <Stat icon={CheckCircle2} value={attendedTotal} label="Asistencias" />
        <Stat icon={Clock} value={waitingTotal} label="En espera" />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid items-center gap-3 lg:grid-cols-[auto_160px_1fr]">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button onClick={() => setView("dia")} className={`rounded-lg px-4 py-2 text-xs font-black ${view === "dia" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Hoy / día</button>
            <button onClick={() => setView("semana")} className={`rounded-lg px-4 py-2 text-xs font-black ${view === "semana" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>7 días</button>
          </div>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar actividad, entrenador, sede o sala" className="h-10 min-w-0 flex-1 text-sm outline-none" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          <span className="flex items-center gap-1 font-bold text-slate-400"><Filter className="h-3.5 w-3.5" />Filtros</span>
          {data.branches.length > 1 && (
            <select value={selectedBranch || ""} onChange={(event) => setSelectedBranch(event.target.value ? Number(event.target.value) : null)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
              <option value="">Todas las sedes</option>
              {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
            </select>
          )}
          <select value={selectedType || ""} onChange={(event) => setSelectedType(event.target.value ? Number(event.target.value) : null)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
            <option value="">Todas las actividades</option>
            {data.classTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}
          </select>
          <select value={selectedTrainer || ""} onChange={(event) => setSelectedTrainer(event.target.value ? Number(event.target.value) : null)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
            <option value="">Todos los entrenadores</option>
            {trainerOptions.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.user.name}</option>)}
          </select>
          {(selectedBranch || selectedType || selectedTrainer || query) && (
            <button onClick={() => { setSelectedBranch(null); setSelectedType(null); setSelectedTrainer(null); setQuery(""); }} className="ml-auto text-xs font-bold text-rose-600 hover:underline">Limpiar</button>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {visible.length ? visible.map((item) => {
          const confirmed = item.reservas.filter((booking) => ["confirmada", "asistio"].includes(booking.estado));
          const waiting = item.reservas.filter((booking) => booking.estado === "espera");
          const attendance = item.reservas.filter((booking) => booking.estado === "asistio").length;
          const occupancy = Math.min(100, Math.round((confirmed.length / item.cupoMaximo) * 100));
          const canceled = item.estado === "cancelada";
          const finished = new Date(item.inicio).getTime() + item.duracionMinutos * 60000 < Date.now();

          return (
            <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${canceled ? "border-rose-100 opacity-70" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-700">{formatDate(item.inicio)} · {formatTime(item.inicio)}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${canceled ? "bg-rose-100 text-rose-700" : finished ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}>
                      {canceled ? "Cancelada" : finished ? "Finalizada" : "Programada"}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-black">{item.tipoClase.nombre}</h2>
                  <p className="text-sm text-slate-500">{item.duracionMinutos} min · {item.sucursal.nombre}{item.sala ? ` · ${item.sala}` : ""}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Entrenador: <b className="text-slate-700">{item.entrenador?.user.name || "Sin asignar"}</b></p>
                </div>

                {!canceled && !finished && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => void openEnrollment(item)} className="flex h-9 items-center gap-1.5 rounded-xl bg-cyan-50 px-3 text-xs font-bold text-cyan-800 hover:bg-cyan-100">
                      <UserPlus className="h-3.5 w-3.5" /> Inscribir socio
                    </button>
                    <button onClick={() => openEdit(item)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Editar clase"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => void cancel(item)} className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" aria-label="Cancelar clase"><XCircle className="h-4 w-4" /></button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex justify-between text-xs font-bold"><span>{confirmed.length}/{item.cupoMaximo} lugares ocupados</span><span>{occupancy}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${occupancy}%` }} /></div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-3 py-2 font-bold">{Math.max(0, item.cupoMaximo - confirmed.length)} disponibles</span>
                  {waiting.length > 0 && <span className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-700">{waiting.length} en espera</span>}
                  {attendance > 0 && <span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-700">{attendance} presentes</span>}
                  <button onClick={() => setDetails(details === item.id ? null : item.id)} className="rounded-lg bg-slate-950 px-3.5 py-2 font-bold text-white hover:bg-slate-800">{details === item.id ? "Cerrar lista" : `Ver inscriptos (${confirmed.length + waiting.length})`}</button>
                </div>
              </div>

              {details === item.id && (
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                  <section>
                    <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Confirmados y asistencia</h3>
                    <div className="space-y-2">
                      {confirmed.length ? confirmed.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                          <div><p className="text-sm font-bold">{booking.cliente.nombre} {booking.cliente.apellido}</p><p className="text-[10px] text-slate-500">DNI {booking.cliente.documento}</p></div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => void handleToggleAttendance(booking)} className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-black ${booking.estado === "asistio" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700 hover:bg-emerald-100"}`}>
                              <Check className="h-3.5 w-3.5" /> {booking.estado === "asistio" ? "Presente" : "Marcar presente"}
                            </button>
                            {!finished && <button onClick={() => void handleCancelBooking(item.id, booking.cliente.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Cancelar reserva"><X className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                      )) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Sin reservas confirmadas</p>}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-amber-700">Lista de espera</h3>
                    <div className="space-y-2">
                      {waiting.length ? waiting.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                          <div><p className="text-sm font-bold text-slate-900">{booking.cliente.nombre} {booking.cliente.apellido}</p><p className="text-[10px] text-slate-500">Posición #{booking.posicionEspera || 1} · DNI {booking.cliente.documento}</p></div>
                          {!finished && <button onClick={() => void handleCancelBooking(item.id, booking.cliente.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Quitar de espera"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                      )) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Sin personas en espera</p>}
                    </div>
                  </section>
                </div>
              )}
            </article>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-black">No hay clases en este período</h2>
            <p className="mt-1 text-sm text-slate-500">Cambiá la fecha o programá una nueva clase.</p>
          </div>
        )}
      </div>

      {context?.canManageActivityTypes && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-black text-cyan-800">Administrar tipos de clase</summary>
          <p className="mt-2 text-xs text-slate-500">Creá una actividad para que luego pueda programarse en la agenda.</p>
          <form onSubmit={createType} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_90px_auto]">
            <input name="nombre" required minLength={2} placeholder="Ej. Pilates funcional" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
            <input name="descripcion" placeholder="Descripción opcional" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input name="color" type="color" defaultValue="#0891b2" className="h-11 w-full rounded-xl border border-slate-200 p-1" />
            <button className="h-11 rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800">Crear actividad</button>
          </form>
        </details>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4">
          <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div><p className="text-xs font-black uppercase tracking-widest text-cyan-700">Agenda</p><h2 className="text-lg font-black">{editing ? "Editar clase" : "Programar clase"}</h2></div>
              <button type="button" onClick={() => { setModal(false); setEditing(null); }} className="rounded-xl p-2 text-slate-400 hover:text-slate-900"><X /></button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Select name="tipoClaseId" label="Actividad" options={data.classTypes} required value={editing?.tipoClaseId || editing?.tipoClase.id} />
              <Select name="sucursalId" label="Sede" options={data.branches} required value={editing?.sucursalId || editing?.sucursal.id || context?.branchId || undefined} />
              {context?.role === "ENTRENADOR" ? (
                <>
                  <input type="hidden" name="entrenadorId" value={context.trainerProfileId || ""} />
                  <label className="text-xs font-bold text-slate-600">Entrenador a cargo<div className="mt-1 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">{trainerOptions[0]?.user.name || "Tu perfil"}</div></label>
                </>
              ) : (
                <Select name="entrenadorId" label="Entrenador a cargo" options={trainerOptions.map((trainer) => ({ id: trainer.id, nombre: trainer.user.name }))} value={editing?.entrenadorId || editing?.entrenador?.id} />
              )}
              <Field name="sala" label="Sala / área" value={editing?.sala || ""} />
              <Field name="inicio" label="Fecha y hora" type="datetime-local" value={editing ? localInput(editing.inicio) : ""} required />
              <Field name="duracionMinutos" label="Duración (minutos)" type="number" value={String(editing?.duracionMinutos || 60)} required />
              <Field name="cupoMaximo" label="Cupo máximo" type="number" value={String(editing?.cupoMaximo || 15)} required />
              <button disabled={saving} className="h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white sm:col-span-2 disabled:opacity-50">{saving ? "Guardando…" : editing ? "Guardar cambios" : "Programar clase"}</button>
            </div>
          </form>
        </div>
      )}

      {enrollModalClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div><p className="text-xs font-black uppercase text-cyan-700">Inscribir socio</p><h2 className="text-base font-black">{enrollModalClass.tipoClase.nombre}</h2><p className="mt-1 text-xs text-slate-500">Sólo aparecen socios habilitados para la sede de esta clase.</p></div>
              <button onClick={() => setEnrollModalClass(null)} className="rounded-xl p-1.5 text-slate-400 hover:text-slate-900"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void loadEligibleMembers(enrollModalClass, clientSearch); }} className="flex gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nombre, apellido o DNI" className="h-11 min-w-0 flex-1 text-sm outline-none" /></label>
              <button disabled={searchingMembers} className="rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-50">Buscar</button>
            </form>

            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {searchingMembers ? <p className="p-4 text-center text-sm text-slate-400">Buscando…</p> : clientsList.length ? clientsList.map((cliente) => (
                <div key={cliente.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div><p className="text-sm font-bold">{cliente.apellido}, {cliente.nombre}</p><p className="text-[10px] text-slate-500">DNI {cliente.documento}</p></div>
                  <button onClick={() => void handleManualEnroll(cliente.id)} disabled={enrolling} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50">Inscribir</button>
                </div>
              )) : <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">No hay socios disponibles para mostrar.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="h-5 w-5 text-cyan-700" /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>;
}

function Field({ name, label, type = "text", value, required }: { name: string; label: string; type?: string; value?: string; required?: boolean }) {
  return <label className="text-xs font-bold text-slate-600">{label}<input name={name} type={type} defaultValue={value} required={required} min={type === "number" ? 1 : undefined} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>;
}

function Select({ name, label, options, required, value }: { name: string; label: string; options: Array<{ id: number; nombre: string }>; required?: boolean; value?: number | null }) {
  return <label className="text-xs font-bold text-slate-600">{label}<select name={name} required={required} defaultValue={value || ""} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="">Seleccionar</option>{options.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select></label>;
}
