"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Search,
  UserRoundCheck,
  Users,
  X,
  XCircle,
  UserPlus,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  actualizarClase,
  cancelarClaseAdmin,
  crearClase,
  crearTipoClase,
  getClasesAdmin,
  registrarAsistenciaClase,
  administrarReservaManual,
} from "@/app/actions/gestion-fitness";
import { getClientes } from "@/app/actions/clientes";

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

function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dateKey(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" }).format(
    new Date(value)
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ClassesPage() {
  const [data, setData] = useState<ClassData>({ classes: [], classTypes: [], branches: [], trainers: [] });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [details, setDetails] = useState<number | null>(null);

  // Filters
  const [view, setView] = useState<"dia" | "semana">("semana");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [query, setQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);

  // Manual enrollment modal
  const [enrollModalClass, setEnrollModalClass] = useState<GymClass | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const result = await getClasesAdmin();
    if (result.success) setData(result.data as unknown as ClassData);
    else setMessage(result.error || "No se pudo cargar la agenda");
  };

  useEffect(() => {
    void load();
  }, []);

  // Load clients when manual enrollment opens
  useEffect(() => {
    if (enrollModalClass) {
      void getClientes().then((res) => {
        if (res.success && res.data) setClientsList(res.data as any[]);
      });
    }
  }, [enrollModalClass]);

  const visible = useMemo(() => {
    const from = new Date(`${selectedDate}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + (view === "dia" ? 1 : 7));

    const clean = query.trim().toLocaleLowerCase("es");
    return data.classes.filter((item) => {
      const start = new Date(item.inicio);
      const matchesPeriod = start >= from && start < to;
      const matchesSearch =
        !clean ||
        [item.tipoClase.nombre, item.sucursal.nombre, item.entrenador?.user.name, item.sala].some((value) =>
          value?.toLocaleLowerCase("es").includes(clean)
        );
      const matchesBranch = !selectedBranch || item.sucursalId === selectedBranch || item.sucursal.id === selectedBranch;
      const matchesType = !selectedType || item.tipoClaseId === selectedType || item.tipoClase.id === selectedType;
      const matchesTrainer = !selectedTrainer || item.entrenadorId === selectedTrainer || item.entrenador?.id === selectedTrainer;

      return matchesPeriod && matchesSearch && matchesBranch && matchesType && matchesTrainer;
    });
  }, [data.classes, query, selectedDate, view, selectedBranch, selectedType, selectedTrainer]);

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
    if (!window.confirm(`¿Cancelar ${item.tipoClase.nombre}? Se notificará a quienes tengan reserva.`)) return;
    const result = await cancelarClaseAdmin(item.id);
    setMessage(result.success ? `Clase cancelada · ${result.data?.reservasCanceladas || 0} reservas notificadas` : result.error || "No se pudo cancelar");
    if (result.success) await load();
  };

  const handleToggleAttendance = async (reserva: Booking) => {
    const isPresent = reserva.estado === "asistio";
    const result = await registrarAsistenciaClase(reserva.id, !isPresent);
    if (result.success) {
      await load();
    } else {
      setMessage(result.error || "Error al registrar asistencia");
    }
  };

  const handleManualEnroll = async (clienteId: number) => {
    if (!enrollModalClass) return;
    setEnrolling(true);
    const result = await administrarReservaManual(enrollModalClass.id, clienteId, "inscribir");
    setMessage(result.success ? result.mensaje || "Socio inscrito con éxito" : result.error || "Error al inscribir");
    if (result.success) {
      setEnrollModalClass(null);
      await load();
    }
    setEnrolling(false);
  };

  const handleCancelBooking = async (claseId: number, clienteId: number) => {
    if (!window.confirm("¿Seguro que deseas cancelar esta reserva?")) return;
    const result = await administrarReservaManual(claseId, clienteId, "cancelar");
    setMessage(result.success ? "Reserva cancelada" : result.error || "Error al cancelar");
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
    setMessage(result.success ? "Actividad creada" : result.error || "No se pudo crear");
    if (result.success) {
      formElement.reset();
      await load();
    }
  };

  const confirmedTotal = visible.reduce(
    (sum, item) => sum + item.reservas.filter((booking) => ["confirmada", "asistio"].includes(booking.estado)).length,
    0
  );
  const waitingTotal = visible.reduce(
    (sum, item) => sum + item.reservas.filter((booking) => booking.estado === "espera").length,
    0
  );
  const attendedTotal = visible.reduce(
    (sum, item) => sum + item.reservas.filter((booking) => booking.estado === "asistio").length,
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Fase 7 · Agenda Operativa</p>
          <h1 className="text-2xl font-black">Clases, Calendario y Reservas</h1>
          <p className="text-sm text-slate-500">Cupos en tiempo real, control de asistencia, profesores y lista de espera.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition"
        >
          <Plus className="h-4 w-4" /> Programar clase
        </button>
      </div>

      {message && (
        <button
          onClick={() => setMessage(null)}
          className="w-full rounded-xl bg-cyan-50 p-3 text-left text-sm font-bold text-cyan-800 flex items-center justify-between"
        >
          <span>{message}</span>
          <span className="text-xs font-normal underline">Descartar</span>
        </button>
      )}

      {/* KPI Stats */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat icon={CalendarDays} value={visible.length} label={view === "dia" ? "Clases en el día" : "Clases en 7 días"} />
        <Stat icon={UserRoundCheck} value={confirmedTotal} label="Reservas confirmadas" />
        <Stat icon={CheckCircle2} value={attendedTotal} label="Asistencias registradas" />
        <Stat icon={Clock} value={waitingTotal} label="En lista de espera" />
      </section>

      {/* Filters Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 lg:grid-cols-[auto_160px_1fr] items-center">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setView("dia")}
              className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                view === "dia" ? "bg-white shadow-sm text-slate-950" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Vista Día
            </button>
            <button
              onClick={() => setView("semana")}
              className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                view === "semana" ? "bg-white shadow-sm text-slate-950" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Vista 7 Días
            </button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
          />

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 bg-white">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por actividad, profesor, sede o sala..."
              className="h-10 min-w-0 flex-1 text-sm outline-none"
            />
          </label>
        </div>

        {/* Extended Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          <select
            value={selectedBranch || ""}
            onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="">Todas las Sedes</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedType || ""}
            onChange={(e) => setSelectedType(e.target.value ? Number(e.target.value) : null)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="">Todas las Actividades</option>
            {data.classTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedTrainer || ""}
            onChange={(e) => setSelectedTrainer(e.target.value ? Number(e.target.value) : null)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="">Todos los Profesores</option>
            {data.trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.name}
              </option>
            ))}
          </select>

          {(selectedBranch || selectedType || selectedTrainer || query) && (
            <button
              onClick={() => {
                setSelectedBranch(null);
                setSelectedType(null);
                setSelectedTrainer(null);
                setQuery("");
              }}
              className="text-xs font-bold text-red-600 hover:underline ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {/* Classes List */}
      <div className="space-y-4">
        {visible.length ? (
          visible.map((item) => {
            const confirmed = item.reservas.filter((booking) => ["confirmada", "asistio"].includes(booking.estado));
            const waiting = item.reservas.filter((booking) => booking.estado === "espera");
            const attendance = item.reservas.filter((booking) => booking.estado === "asistio").length;
            const occupancy = Math.min(100, Math.round((confirmed.length / item.cupoMaximo) * 100));
            const canceled = item.estado === "cancelada";

            return (
              <article
                key={item.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                  canceled ? "border-red-100 opacity-70" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-wide text-cyan-700">
                        {formatDate(item.inicio)} · {formatTime(item.inicio)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${
                          canceled
                            ? "bg-red-100 text-red-700"
                            : new Date(item.inicio) < new Date()
                            ? "bg-slate-100 text-slate-500"
                            : "bg-lime-100 text-lime-800"
                        }`}
                      >
                        {canceled ? "Cancelada" : new Date(item.inicio) < new Date() ? "Realizada" : "Programada"}
                      </span>
                    </div>

                    <h2 className="mt-1 text-lg font-black">{item.tipoClase.nombre}</h2>
                    <p className="text-sm text-slate-500">
                      {item.duracionMinutos} min · {item.sucursal.nombre}
                      {item.sala ? ` · ${item.sala}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      Profesor: <b className="text-slate-700">{item.entrenador?.user.name || "Sin asignar"}</b>
                    </p>
                  </div>

                  {!canceled && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEnrollModalClass(item)}
                        className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-cyan-50 text-cyan-800 font-bold text-xs hover:bg-cyan-100 transition"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Inscribir Socio
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                        aria-label="Editar clase"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void cancel(item)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition"
                        aria-label="Cancelar clase"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex justify-between text-xs font-bold">
                      <span>
                        {confirmed.length}/{item.cupoMaximo} lugares ocupados
                      </span>
                      <span>{occupancy}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-cyan-600" style={{ width: `${occupancy}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-slate-100 px-3 py-2 font-bold">
                      {item.cupoMaximo - confirmed.length} disponibles
                    </span>
                    {waiting.length > 0 && (
                      <span className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-700">
                        {waiting.length} en espera
                      </span>
                    )}
                    {attendance > 0 && (
                      <span className="rounded-lg bg-lime-50 px-3 py-2 font-bold text-lime-700">
                        {attendance} asistieron
                      </span>
                    )}
                    <button
                      onClick={() => setDetails(details === item.id ? null : item.id)}
                      className="rounded-lg bg-slate-950 px-3.5 py-2 font-bold text-white hover:bg-slate-800 transition"
                    >
                      {details === item.id ? "Ocultar lista" : `Ver lista (${confirmed.length + waiting.length})`}
                    </button>
                  </div>
                </div>

                {/* Details & Attendance Panel */}
                {details === item.id && (
                  <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                        Confirmados · Marcar Asistencia
                      </h3>
                      <div className="space-y-2">
                        {confirmed.length ? (
                          confirmed.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                            >
                              <div>
                                <p className="text-sm font-bold">
                                  {booking.cliente.nombre} {booking.cliente.apellido}
                                </p>
                                <p className="text-[10px] text-slate-500">DNI {booking.cliente.documento}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleAttendance(booking)}
                                  className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition ${
                                    booking.estado === "asistio"
                                      ? "bg-lime-500 text-slate-950"
                                      : "bg-slate-200 text-slate-600 hover:bg-lime-100 hover:text-lime-800"
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {booking.estado === "asistio" ? "Asistió" : "Presente"}
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(item.id, booking.cliente.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Quitar de la clase"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Sin reservas confirmadas</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2">
                        Lista de Espera
                      </h3>
                      <div className="space-y-2">
                        {waiting.length ? (
                          waiting.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between rounded-xl bg-amber-50/60 p-3 border border-amber-100"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {booking.cliente.nombre} {booking.cliente.apellido}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  Posición #{booking.posicionEspera || 1} · DNI {booking.cliente.documento}
                                </p>
                              </div>

                              <button
                                onClick={() => handleCancelBooking(item.id, booking.cliente.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Quitar de espera"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">Sin socios en espera</p>
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-black">No hay clases en este período</h2>
            <p className="mt-1 text-sm text-slate-500">Cambiá la fecha o programá una nueva clase.</p>
          </div>
        )}
      </div>

      {/* Creación de Actividades */}
      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black text-cyan-800">
          + Crear nueva actividad o tipo de clase
        </summary>
        <form onSubmit={createType} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_90px_auto]">
          <input
            name="nombre"
            required
            minLength={2}
            placeholder="Ej. Pilates Funcional"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
          />
          <input
            name="descripcion"
            placeholder="Descripción opcional"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            name="color"
            type="color"
            defaultValue="#0891b2"
            className="h-11 w-full rounded-xl border border-slate-200 p-1"
          />
          <button className="h-11 rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800 transition">
            Crear
          </button>
        </form>
      </details>

      {/* Modal Programar / Editar Clase */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4">
          <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Agenda</p>
                <h2 className="text-lg font-black">{editing ? "Editar clase" : "Programar clase"}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModal(false);
                  setEditing(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900"
              >
                <X />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Select
                name="tipoClaseId"
                label="Actividad"
                options={data.classTypes}
                required
                value={editing?.tipoClaseId || editing?.tipoClase.id}
              />
              <Select
                name="sucursalId"
                label="Sede / Sucursal"
                options={data.branches}
                required
                value={editing?.sucursalId || editing?.sucursal.id}
              />
              <Select
                name="entrenadorId"
                label="Profesor a cargo"
                options={data.trainers.map((trainer) => ({ id: trainer.id, nombre: trainer.user.name }))}
                value={editing?.entrenadorId || editing?.entrenador?.id}
              />
              <Field name="sala" label="Sala / Área" value={editing?.sala || ""} />
              <Field
                name="inicio"
                label="Fecha y hora"
                type="datetime-local"
                value={editing ? localInput(editing.inicio) : ""}
                required
              />
              <Field
                name="duracionMinutos"
                label="Duración (Minutos)"
                type="number"
                value={String(editing?.duracionMinutos || 60)}
                required
              />
              <Field
                name="cupoMaximo"
                label="Cupo máximo"
                type="number"
                value={String(editing?.cupoMaximo || 15)}
                required
              />

              <div className="sm:col-span-2 pt-2">
                <button
                  disabled={saving}
                  className="h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Programar clase"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Inscribir Socio Manual */}
      {enrollModalClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <p className="text-xs font-black uppercase text-cyan-700">Inscripción Manual</p>
                <h2 className="text-base font-black">{enrollModalClass.tipoClase.nombre}</h2>
              </div>
              <button
                onClick={() => setEnrollModalClass(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-xs font-bold text-slate-600">
              Buscar Socio (Nombre o DNI)
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Escribe para buscar..."
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>

            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {clientsList
                .filter((c) => {
                  if (!clientSearch.trim()) return true;
                  const q = clientSearch.toLowerCase();
                  return (
                    c.nombre.toLowerCase().includes(q) ||
                    c.apellido.toLowerCase().includes(q) ||
                    c.documento.includes(q)
                  );
                })
                .slice(0, 10)
                .map((cliente) => (
                  <div
                    key={cliente.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold">
                        {cliente.nombre} {cliente.apellido}
                      </p>
                      <p className="text-[10px] text-slate-500">DNI {cliente.documento}</p>
                    </div>

                    <button
                      onClick={() => handleManualEnroll(cliente.id)}
                      disabled={enrolling}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-cyan-700 transition disabled:opacity-50"
                    >
                      Inscribir
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Icon className="h-5 w-5 text-cyan-700" />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  value,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={type === "number" ? 1 : undefined}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  required,
  value,
}: {
  name: string;
  label: string;
  options: Array<{ id: number; nombre: string }>;
  required?: boolean;
  value?: number | null;
}) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={value || ""}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
