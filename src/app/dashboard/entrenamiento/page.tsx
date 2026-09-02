"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronUp, Copy, Dumbbell, Edit3, Layers3, Library, Pause, Play, Plus, Search, Target, UserRoundCheck, X } from "lucide-react";
import { activarRutina, archivarRutina, cambiarEstadoEjercicio, crearEjercicio, crearRutina, duplicarRutina, editarEjercicio, editarRutina, getEjerciciosAdmin, getRutinasAdmin } from "@/app/actions/entrenamiento";
import { cambiarEstadoAsignacion, cambiarEstadoObjetivo, cambiarEstadoPlan, crearAsignacion, getPlanificacionAdmin, guardarObjetivo, guardarPlan } from "@/app/actions/planificacion";
import { memberWorkspaceHref, parseMemberWorkspaceId } from "@/lib/member-workspace";

type Exercise = { id: number; nombre: string; descripcion?: string | null; grupoMuscular: string; categoria?: string | null; equipamiento?: string | null; dificultad?: string | null; instrucciones?: string | null; observaciones?: string | null; videoUrl?: string | null; imagenUrl?: string | null; activo: boolean };
type RoutineItem = { id?: number; ejercicioId: number; dia: number; orden: number; series: number; repeticiones: string; pesoSugerido?: string | number | null; descansoSegundos?: number | null; tiempoSegundos?: number | null; observaciones?: string | null; ejercicio?: Exercise };
type Routine = { id: number; nombre: string; descripcion?: string | null; objetivo?: string | null; nivel?: string | null; duracionMinutos?: number | null; recomendaciones?: string | null; estado: string; ejercicios: RoutineItem[]; _count: { asignaciones: number } };
type Phase = { id?: number; rutinaId: number; orden: number; semanaInicio: number; semanaFin: number; rutina?: Pick<Routine, "id" | "nombre" | "estado"> };
type Plan = { id: number; nombre: string; descripcion?: string | null; objetivo?: string | null; duracionSemanas: number; estado: string; fases: Phase[]; _count: { asignaciones: number } };
type Member = { id: number; nombre: string; apellido: string; documento: string };
type Objective = { id: number; clienteId: number; tipo: string; principal: boolean; observaciones?: string | null; estado: string; fechaInicio: string; cliente: Pick<Member, "id" | "nombre" | "apellido"> };
type Assignment = { id: number; estado: string; fechaInicio: string; semanaActual?: number | null; cliente: Pick<Member, "id" | "nombre" | "apellido">; plan?: Plan | null; rutina?: Pick<Routine, "id" | "nombre"> | null; faseActual?: Phase | null };
type Tab = "objetivos" | "ejercicios" | "rutinas" | "planes" | "asignaciones";
type Modal = "ejercicio" | "rutina" | "plan" | "objetivo" | "asignacion" | null;
type PlanningData = { planes: Plan[]; asignaciones: Assignment[]; socios: Member[]; objetivos: Objective[] };

const emptyRoutineItem = (orden: number): RoutineItem => ({ ejercicioId: 0, dia: 1, orden, series: 4, repeticiones: "8-12", descansoSegundos: 90 });
const emptyPhase = (orden: number, start = orden): Phase => ({ rutinaId: 0, orden, semanaInicio: start, semanaFin: start });
const createLabels: Record<Tab, string> = {
  objetivos: "Nuevo objetivo",
  ejercicios: "Nuevo ejercicio",
  rutinas: "Nueva rutina",
  planes: "Nuevo plan",
  asignaciones: "Asignar entrenamiento",
};

export default function TrainingAdminPage() {
  const [tab, setTab] = useState<Tab>("rutinas");
  const [modal, setModal] = useState<Modal>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([emptyRoutineItem(1)]);
  const [phases, setPhases] = useState<Phase[]>([emptyPhase(1)]);
  const [assignmentType, setAssignmentType] = useState<"plan" | "rutina">("plan");
  const [focusedMemberId, setFocusedMemberId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (): Promise<PlanningData | null> => {
    const [exerciseResult, routineResult, planningResult] = await Promise.all([getEjerciciosAdmin(), getRutinasAdmin(), getPlanificacionAdmin()]);
    if (exerciseResult.success) setExercises(exerciseResult.data as unknown as Exercise[]);
    if (routineResult.success) setRoutines(routineResult.data as unknown as Routine[]);
    if (planningResult.success && planningResult.data) {
      const data = planningResult.data as unknown as PlanningData;
      setPlans(data.planes);
      setAssignments(data.asignaciones);
      setMembers(data.socios);
      setObjectives(data.objetivos);
      return data;
    }
    setMessage(planningResult.error || "No se pudo cargar la planificación");
    return null;
  };

  useEffect(() => {
    const initialMemberId = parseMemberWorkspaceId(new URLSearchParams(window.location.search).get("cliente"));
    void load().then((data) => {
      if (!initialMemberId) return;
      const memberExists = data?.socios.some((member) => member.id === initialMemberId);
      if (!memberExists) {
        setMessage("El socio indicado no está disponible en tu cartera de entrenamiento.");
        return;
      }
      setFocusedMemberId(initialMemberId);
      setTab("asignaciones");
      setModal("asignacion");
    });
  }, []);

  const activeRoutines = routines.filter((item) => item.estado === "activo");
  const activePlans = plans.filter((item) => item.estado === "activo");
  const focusedMember = members.find((member) => member.id === focusedMemberId) || null;
  const activeAssignments = assignments.filter((item) => item.estado === "activa");
  const assignedMemberIds = new Set(activeAssignments.map((item) => item.cliente.id));

  const visibleExercises = useMemo(
    () => exercises.filter((item) => `${item.nombre} ${item.grupoMuscular} ${item.categoria || ""}`.toLowerCase().includes(search.toLowerCase())),
    [exercises, search],
  );
  const visibleObjectives = useMemo(
    () => objectives.filter((item) => (!focusedMemberId || item.clienteId === focusedMemberId) && `${item.cliente.nombre} ${item.cliente.apellido} ${item.tipo}`.toLowerCase().includes(search.toLowerCase())),
    [objectives, search, focusedMemberId],
  );
  const visibleAssignments = useMemo(
    () => assignments.filter((item) => !focusedMemberId || item.cliente.id === focusedMemberId),
    [assignments, focusedMemberId],
  );

  const run = async (operation: () => Promise<{ success: boolean; error?: string }>, successMessage: string) => {
    setBusy(true);
    const result = await operation();
    setMessage(result.success ? successMessage : result.error || "No se pudo completar la operación");
    if (result.success) {
      setModal(null);
      await load();
    }
    setBusy(false);
  };

  const openNew = (targetTab = tab) => {
    if (targetTab === "planes" && !activeRoutines.length) {
      setTab("rutinas");
      setMessage("Primero creá al menos una rutina activa. Después vas a poder armar un plan por etapas.");
      return;
    }
    if (targetTab === "asignaciones" && !activePlans.length && !activeRoutines.length) {
      setTab("rutinas");
      setMessage("Primero necesitás una rutina o un plan activo para poder asignar entrenamiento.");
      return;
    }
    setEditingExercise(null);
    setEditingRoutine(null);
    setEditingPlan(null);
    setEditingObjective(null);
    setRoutineItems([emptyRoutineItem(1)]);
    setPhases([emptyPhase(1)]);
    const target: Record<Tab, Modal> = { objetivos: "objetivo", ejercicios: "ejercicio", rutinas: "rutina", planes: "plan", asignaciones: "asignacion" };
    setModal(target[targetTab]);
  };

  const focusMember = (memberId: number) => {
    setFocusedMemberId(memberId);
    window.history.replaceState(null, "", memberWorkspaceHref("training", memberId));
  };

  const clearMemberFocus = () => {
    setFocusedMemberId(null);
    setModal(null);
    window.history.replaceState(null, "", "/dashboard/entrenamiento");
  };

  const move = <T,>(values: T[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= values.length) return values;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const submitExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nombre: text(form, "nombre"),
      grupoMuscular: text(form, "grupoMuscular"),
      categoria: text(form, "categoria"),
      equipamiento: text(form, "equipamiento"),
      dificultad: text(form, "dificultad"),
      descripcion: text(form, "descripcion"),
      instrucciones: text(form, "instrucciones"),
      observaciones: text(form, "observaciones"),
      videoUrl: text(form, "videoUrl"),
      imagenUrl: text(form, "imagenUrl"),
    };
    await run(() => editingExercise ? editarEjercicio(editingExercise.id, payload) : crearEjercicio(payload), editingExercise ? "Ejercicio actualizado" : "Ejercicio creado");
  };

  const submitRoutine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      id: editingRoutine?.id,
      nombre: text(form, "nombre"),
      objetivo: text(form, "objetivo"),
      nivel: text(form, "nivel"),
      descripcion: text(form, "descripcion"),
      recomendaciones: text(form, "recomendaciones"),
      duracionMinutos: number(form, "duracionMinutos"),
      ejercicios: routineItems.map(({ ejercicioId, dia, orden, series, repeticiones, pesoSugerido, descansoSegundos, tiempoSegundos, observaciones }) => ({
        ejercicioId,
        dia,
        orden,
        series,
        repeticiones,
        pesoSugerido: pesoSugerido == null ? undefined : Number(pesoSugerido),
        descansoSegundos: descansoSegundos ?? undefined,
        tiempoSegundos: tiempoSegundos ?? undefined,
        observaciones: observaciones ?? undefined,
      })),
    };
    await run(() => editingRoutine ? editarRutina(payload) : crearRutina(payload), editingRoutine ? "Rutina actualizada" : "Rutina creada");
  };

  const submitPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () => guardarPlan({
        id: editingPlan?.id,
        nombre: text(form, "nombre"),
        objetivo: text(form, "objetivo"),
        descripcion: text(form, "descripcion"),
        duracionSemanas: number(form, "duracionSemanas"),
        fases: phases.map(({ rutinaId, orden, semanaInicio, semanaFin }) => ({ rutinaId, orden, semanaInicio, semanaFin })),
      }),
      editingPlan ? "Plan actualizado" : "Plan creado",
    );
  };

  const submitObjective = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () => guardarObjetivo({
        id: editingObjective?.id,
        clienteId: number(form, "clienteId"),
        tipo: text(form, "tipo"),
        principal: form.get("principal") === "on",
        observaciones: text(form, "observaciones"),
      }),
      editingObjective ? "Objetivo actualizado" : "Objetivo creado",
    );
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = number(form, "clienteId");
    await run(
      () => crearAsignacion({
        clienteId: memberId,
        tipo: assignmentType,
        recursoId: number(form, "recursoId"),
        fechaInicio: text(form, "fechaInicio"),
        fechaFin: text(form, "fechaFin") || null,
        notas: text(form, "notas"),
      }),
      "Entrenamiento asignado",
    );
    if (!focusedMemberId) focusMember(memberId);
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Target }> = [
    { key: "objetivos", label: "Objetivos", icon: Target },
    { key: "ejercicios", label: "Biblioteca", icon: Library },
    { key: "rutinas", label: "Rutinas", icon: Dumbbell },
    { key: "planes", label: "Planes", icon: Layers3 },
    { key: "asignaciones", label: "Socios y asignaciones", icon: UserRoundCheck },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Planificación</p>
          <h1 className="mt-1 text-2xl font-black">Entrenamiento de socios</h1>
          <p className="mt-1 text-sm text-slate-500">Definí objetivos, armá rutinas y planes, y asigná el entrenamiento desde un único circuito.</p>
        </div>
        <button onClick={() => openNew()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> {createLabels[tab]}
        </button>
      </header>

      {focusedMember && (
        <section className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">Trabajando sobre un socio</p>
            <h2 className="font-black text-slate-950">{focusedMember.nombre} {focusedMember.apellido}</h2>
            <p className="text-xs text-slate-600">DNI {focusedMember.documento} · objetivos y asignaciones se filtran para esta persona.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setTab("asignaciones"); openNew("asignaciones"); }} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Asignar entrenamiento</button>
            <button onClick={() => { setTab("objetivos"); openNew("objetivos"); }} className="rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-900">Nuevo objetivo</button>
            <Link href={memberWorkspaceHref("progress", focusedMember.id)} className="rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-900">Ver progreso</Link>
            <button onClick={clearMemberFocus} className="rounded-xl border border-cyan-300 px-3 py-2 text-xs font-bold text-cyan-900">Ver todos</button>
          </div>
        </section>
      )}

      {message && (
        <button onClick={() => setMessage(null)} className="w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-left text-sm font-bold text-cyan-800">
          {message}
        </button>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={activeRoutines.length} label="Rutinas activas" />
        <Stat value={activePlans.length} label="Planes activos" />
        <Stat value={activeAssignments.length} label="Socios con asignación activa" />
        <Stat value={Math.max(0, members.length - assignedMemberIds.size)} label="Socios sin entrenamiento activo" />
      </section>

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(""); }}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tab === key ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {(tab === "objetivos" || tab === "ejercicios") && (
        <SearchBox value={search} onChange={setSearch} placeholder={tab === "objetivos" ? "Buscar socio u objetivo" : "Buscar ejercicio, músculo o categoría"} />
      )}

      {tab === "objetivos" && (
        visibleObjectives.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleObjectives.map((item) => (
              <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <button onClick={() => focusMember(item.clienteId)} className="text-left">
                    <p className="font-black">{item.cliente.nombre} {item.cliente.apellido}</p>
                    <p className="mt-1 text-sm font-bold text-cyan-700">{item.tipo}</p>
                  </button>
                  <Status value={item.estado} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.observaciones || "Sin notas del entrenador"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className={`mr-auto text-xs font-bold ${item.principal ? "text-amber-600" : "text-slate-400"}`}>{item.principal ? "★ Principal" : "Secundario"}</span>
                  {item.estado === "activo" ? (
                    <>
                      <IconButton title="Editar" onClick={() => { setEditingObjective(item); setModal("objetivo"); }} icon={Edit3} />
                      <ActionButton label="Finalizar" onClick={() => void run(() => cambiarEstadoObjetivo(item.id, "finalizado"), "Objetivo finalizado")} />
                      <ActionButton label="Archivar" onClick={() => void run(() => cambiarEstadoObjetivo(item.id, "archivado"), "Objetivo archivado")} />
                    </>
                  ) : <ActionButton label="Reactivar" onClick={() => void run(() => cambiarEstadoObjetivo(item.id, "activo"), "Objetivo reactivado")} />}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No hay objetivos para mostrar" text={focusedMember ? "Todavía no cargaste objetivos para este socio." : "Creá objetivos para orientar y documentar el trabajo del equipo."} action="Nuevo objetivo" onAction={() => openNew("objetivos")} />
      )}

      {tab === "ejercicios" && (
        visibleExercises.length ? (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ejercicio</th><th className="hidden px-4 py-3 sm:table-cell">Grupo / categoría</th><th className="hidden px-4 py-3 md:table-cell">Equipo</th><th className="px-4 py-3">Acciones</th></tr></thead>
              <tbody className="divide-y">
                {visibleExercises.map((item) => (
                  <tr key={item.id} className={!item.activo ? "opacity-55" : ""}>
                    <td className="px-4 py-3 font-bold">{item.nombre}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{item.grupoMuscular}{item.categoria ? ` · ${item.categoria}` : ""}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{item.equipamiento || "Sin equipo"}</td>
                    <td className="px-4 py-3"><div className="flex"><IconButton title="Editar" onClick={() => { setEditingExercise(item); setModal("ejercicio"); }} icon={Edit3} /><IconButton title={item.activo ? "Desactivar" : "Activar"} onClick={() => void run(() => cambiarEstadoEjercicio(item.id, !item.activo), "Estado actualizado")} icon={item.activo ? Pause : Play} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="La biblioteca está vacía" text="Cargá ejercicios reutilizables antes de construir las rutinas." action="Nuevo ejercicio" onAction={() => openNew("ejercicios")} />
      )}

      {tab === "rutinas" && (
        routines.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {routines.map((routine) => (
              <article key={routine.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${routine.estado !== "activo" ? "opacity-65" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h2 className="font-black">{routine.nombre}</h2><Status value={routine.estado} /></div><p className="mt-1 text-xs text-slate-500">{routine.objetivo || "Objetivo general"} · {routine.nivel || "Todos los niveles"}</p></div>
                  <div className="flex"><IconButton title="Editar" onClick={() => { setEditingRoutine(routine); setRoutineItems(routine.ejercicios.map((item, index) => ({ ...item, orden: index + 1, pesoSugerido: item.pesoSugerido == null ? undefined : Number(item.pesoSugerido) }))); setModal("rutina"); }} icon={Edit3} /><IconButton title="Duplicar" onClick={() => void run(() => duplicarRutina(routine.id), "Rutina duplicada")} icon={Copy} /><IconButton title={routine.estado === "activo" ? "Archivar" : "Activar"} onClick={() => void run(() => routine.estado === "activo" ? archivarRutina(routine.id) : activarRutina(routine.id), "Estado actualizado")} icon={routine.estado === "activo" ? Archive : Play} /></div>
                </div>
                <div className="mt-4 space-y-2">{routine.ejercicios.slice(0, 6).map((item) => <div key={`${item.dia}-${item.orden}`} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2"><span className="text-xs font-black text-cyan-700">D{item.dia}</span><span className="flex-1 text-sm font-bold">{item.ejercicio?.nombre}</span><span className="text-xs text-slate-500">{item.series} × {item.repeticiones}</span></div>)}</div>
                <div className="mt-4 flex justify-between border-t pt-3 text-xs text-slate-500"><span>{routine.ejercicios.length} ejercicios</span><span>{routine._count.asignaciones} asignaciones</span></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Todavía no hay rutinas" text="Creá una rutina a partir de la biblioteca de ejercicios. Después podrás usarla sola o dentro de un plan." action="Nueva rutina" onAction={() => openNew("rutinas")} />
      )}

      {tab === "planes" && (
        plans.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${plan.estado !== "activo" ? "opacity-65" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h2 className="font-black">{plan.nombre}</h2><Status value={plan.estado} /></div><p className="mt-1 text-xs text-slate-500">{plan.objetivo || "Objetivo general"} · {plan.duracionSemanas} semanas</p></div>
                  <div className="flex"><IconButton title="Editar" onClick={() => { setEditingPlan(plan); setPhases(plan.fases.map((phase, index) => ({ ...phase, orden: index + 1 }))); setModal("plan"); }} icon={Edit3} /><IconButton title={plan.estado === "activo" ? "Archivar" : "Activar"} onClick={() => void run(() => cambiarEstadoPlan(plan.id, plan.estado === "activo" ? "archivado" : "activo"), "Estado actualizado")} icon={plan.estado === "activo" ? Archive : Play} /></div>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto">{plan.fases.map((phase) => <div key={phase.id || phase.orden} className="min-w-36 rounded-xl border border-cyan-100 bg-cyan-50 p-3"><p className="text-[10px] font-black uppercase text-cyan-700">Etapa {phase.orden}</p><p className="text-sm font-bold">{phase.rutina?.nombre}</p><p className="text-xs text-slate-500">Sem. {phase.semanaInicio}–{phase.semanaFin}</p></div>)}</div>
                <p className="mt-3 text-xs text-slate-500">{plan._count.asignaciones} asignaciones históricas</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Todavía no hay planes" text="Un plan encadena rutinas por semanas. Necesitás al menos una rutina activa para empezar." action="Nuevo plan" onAction={() => openNew("planes")} />
      )}

      {tab === "asignaciones" && (
        visibleAssignments.length ? (
          <div className="space-y-3">
            {visibleAssignments.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center">
                <button onClick={() => focusMember(item.cliente.id)} className="min-w-48 text-left"><p className="font-black">{item.cliente.nombre} {item.cliente.apellido}</p><p className="text-xs text-slate-500">Desde {date(item.fechaInicio)}</p></button>
                <div className="flex-1"><p className="text-sm font-bold text-cyan-800">{item.plan?.nombre || item.rutina?.nombre}</p>{item.faseActual && <p className="text-xs text-slate-500">Semana {item.semanaActual} · Etapa {item.faseActual.orden}: {item.faseActual.rutina?.nombre}</p>}</div>
                <Status value={item.estado} />
                <div className="flex gap-2">{item.estado === "activa" && <><ActionButton label="Pausar" onClick={() => void run(() => cambiarEstadoAsignacion(item.id, "pausada"), "Asignación pausada")} /><ActionButton label="Finalizar" onClick={() => void run(() => cambiarEstadoAsignacion(item.id, "finalizada"), "Asignación finalizada")} /></>}{item.estado === "pausada" && <ActionButton label="Reactivar" onClick={() => void run(() => cambiarEstadoAsignacion(item.id, "activa"), "Asignación reactivada")} />}</div>
              </article>
            ))}
          </div>
        ) : <EmptyState title={focusedMember ? "Este socio todavía no tiene asignaciones" : "Todavía no hay asignaciones"} text="Elegí un socio y asignale una rutina individual o un plan progresivo." action="Asignar entrenamiento" onAction={() => openNew("asignaciones")} />
      )}

      {modal && (
        <ModalShell title={modalTitle(modal, Boolean(editingExercise || editingRoutine || editingPlan || editingObjective))} onClose={() => setModal(null)}>
          {modal === "ejercicio" && <form onSubmit={submitExercise} className="grid gap-4 sm:grid-cols-2"><Field name="nombre" label="Nombre" required defaultValue={editingExercise?.nombre} /><Field name="grupoMuscular" label="Grupo muscular" required defaultValue={editingExercise?.grupoMuscular} /><Field name="categoria" label="Categoría" defaultValue={editingExercise?.categoria} /><Field name="equipamiento" label="Equipamiento" defaultValue={editingExercise?.equipamiento} /><Field name="dificultad" label="Dificultad" defaultValue={editingExercise?.dificultad} /><Field name="videoUrl" label="URL del video" type="url" defaultValue={editingExercise?.videoUrl} /><Field name="imagenUrl" label="URL de imagen" type="url" defaultValue={editingExercise?.imagenUrl} className="sm:col-span-2" /><TextArea name="descripcion" label="Descripción" defaultValue={editingExercise?.descripcion} /><TextArea name="instrucciones" label="Instrucciones" defaultValue={editingExercise?.instrucciones} /><TextArea name="observaciones" label="Notas internas" defaultValue={editingExercise?.observaciones} /><Submit busy={busy} label="Guardar ejercicio" /></form>}
          {modal === "rutina" && <form onSubmit={submitRoutine} className="grid gap-4 sm:grid-cols-2"><Field name="nombre" label="Nombre" required defaultValue={editingRoutine?.nombre} /><Field name="objetivo" label="Objetivo" defaultValue={editingRoutine?.objetivo} /><Field name="nivel" label="Nivel" defaultValue={editingRoutine?.nivel} /><Field name="duracionMinutos" label="Duración (min)" type="number" defaultValue={String(editingRoutine?.duracionMinutos || 60)} /><TextArea name="descripcion" label="Descripción" defaultValue={editingRoutine?.descripcion} /><TextArea name="recomendaciones" label="Recomendaciones" defaultValue={editingRoutine?.recomendaciones} /><BuilderHeader label="Ejercicios y orden" onAdd={() => setRoutineItems((items) => [...items, emptyRoutineItem(items.length + 1)])} />{routineItems.map((item, index) => <RoutineRow key={index} item={item} exercises={exercises.filter((exercise) => exercise.activo || exercise.id === item.ejercicioId)} onChange={(next) => setRoutineItems((items) => items.map((value, i) => i === index ? next : value))} onMove={(direction) => setRoutineItems((items) => move(items, index, direction).map((value, i) => ({ ...value, orden: i + 1 })))} onRemove={() => setRoutineItems((items) => items.filter((_, i) => i !== index).map((value, i) => ({ ...value, orden: i + 1 })))} first={!index} last={index === routineItems.length - 1} />)}<Submit busy={busy} disabled={!routineItems.length || routineItems.some((item) => !item.ejercicioId)} label="Guardar rutina" /></form>}
          {modal === "plan" && <form onSubmit={submitPlan} className="grid gap-4 sm:grid-cols-2"><Field name="nombre" label="Nombre" required defaultValue={editingPlan?.nombre} /><Field name="objetivo" label="Objetivo" defaultValue={editingPlan?.objetivo} /><Field name="duracionSemanas" label="Duración total (semanas)" type="number" required defaultValue={String(editingPlan?.duracionSemanas || 12)} /><TextArea name="descripcion" label="Descripción" defaultValue={editingPlan?.descripcion} /><BuilderHeader label="Etapas del plan" onAdd={() => setPhases((items) => [...items, emptyPhase(items.length + 1, (items.at(-1)?.semanaFin || 0) + 1)])} />{phases.map((phase, index) => <PhaseRow key={index} phase={phase} routines={activeRoutines} onChange={(next) => setPhases((items) => items.map((value, i) => i === index ? next : value))} onMove={(direction) => setPhases((items) => move(items, index, direction).map((value, i) => ({ ...value, orden: i + 1 })))} onRemove={() => setPhases((items) => items.filter((_, i) => i !== index).map((value, i) => ({ ...value, orden: i + 1 })))} first={!index} last={index === phases.length - 1} />)}<Submit busy={busy} disabled={!phases.length || phases.some((phase) => !phase.rutinaId)} label="Guardar plan" /></form>}
          {modal === "objetivo" && <form onSubmit={submitObjective} className="grid gap-4"><Select name="clienteId" label="Socio" required defaultValue={String(editingObjective?.clienteId || focusedMemberId || "")} disabled={Boolean(editingObjective || focusedMemberId)} options={members.map((member) => ({ value: member.id, label: `${member.apellido}, ${member.nombre} · ${member.documento}` }))} /><Field name="tipo" label="Objetivo" required defaultValue={editingObjective?.tipo} /><TextArea name="observaciones" label="Notas del entrenador" defaultValue={editingObjective?.observaciones} /><label className="flex items-center gap-2 text-sm font-bold"><input name="principal" type="checkbox" defaultChecked={editingObjective?.principal} />Marcar como objetivo principal</label><Submit busy={busy} label="Guardar objetivo" /></form>}
          {modal === "asignacion" && <form onSubmit={submitAssignment} className="grid gap-4"><Select name="clienteId" label="Socio" required defaultValue={String(focusedMemberId || "")} disabled={Boolean(focusedMemberId)} options={members.map((member) => ({ value: member.id, label: `${member.apellido}, ${member.nombre} · ${member.documento}` }))} /><label className="text-xs font-bold text-slate-600">Tipo<select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as "plan" | "rutina")} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="plan" disabled={!activePlans.length}>Plan progresivo{!activePlans.length ? " (sin planes activos)" : ""}</option><option value="rutina" disabled={!activeRoutines.length}>Rutina individual{!activeRoutines.length ? " (sin rutinas activas)" : ""}</option></select></label><Select name="recursoId" label={assignmentType === "plan" ? "Plan" : "Rutina"} required options={(assignmentType === "plan" ? activePlans : activeRoutines).map((item) => ({ value: item.id, label: item.nombre }))} /><div className="grid gap-4 sm:grid-cols-2"><Field name="fechaInicio" label="Fecha de inicio" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /><Field name="fechaFin" label="Fecha de fin opcional" type="date" /></div><TextArea name="notas" label="Notas de la asignación" /><Submit busy={busy} label="Asignar entrenamiento" /></form>}
        </ModalShell>
      )}
    </div>
  );
}

function RoutineRow({ item, exercises, onChange, onMove, onRemove, first, last }: { item: RoutineItem; exercises: Exercise[]; onChange: (item: RoutineItem) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean }) {
  return <div className="rounded-2xl border bg-slate-50 p-3 sm:col-span-2"><div className="flex items-center gap-2"><b className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-100 text-xs text-cyan-800">{item.orden}</b><select value={item.ejercicioId} onChange={(event) => onChange({ ...item, ejercicioId: Number(event.target.value) })} className="h-10 min-w-0 flex-1 rounded-lg border bg-white px-2 text-sm"><option value={0}>Elegir ejercicio</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.nombre}</option>)}</select><MoveButtons first={first} last={last} onMove={onMove} onRemove={onRemove} /></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6"><MiniNumber label="Día" value={item.dia} onChange={(value) => onChange({ ...item, dia: value })} /><MiniNumber label="Series" value={item.series} onChange={(value) => onChange({ ...item, series: value })} /><MiniText label="Reps" value={item.repeticiones} onChange={(value) => onChange({ ...item, repeticiones: value })} /><MiniNumber label="Peso kg" value={Number(item.pesoSugerido || 0)} onChange={(value) => onChange({ ...item, pesoSugerido: value || undefined })} /><MiniNumber label="Descanso s" value={item.descansoSegundos || 0} onChange={(value) => onChange({ ...item, descansoSegundos: value })} /><MiniNumber label="Tiempo s" value={item.tiempoSegundos || 0} onChange={(value) => onChange({ ...item, tiempoSegundos: value || undefined })} /></div><input value={item.observaciones || ""} onChange={(event) => onChange({ ...item, observaciones: event.target.value })} placeholder="Notas para este ejercicio" className="mt-2 h-9 w-full rounded-lg border bg-white px-2 text-xs" /></div>;
}

function PhaseRow({ phase, routines, onChange, onMove, onRemove, first, last }: { phase: Phase; routines: Routine[]; onChange: (phase: Phase) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean }) {
  return <div className="flex flex-col gap-2 rounded-2xl border bg-slate-50 p-3 sm:col-span-2 sm:flex-row sm:items-end"><b className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-sm text-cyan-800">{phase.orden}</b><label className="flex-1 text-[10px] font-bold uppercase text-slate-500">Rutina<select value={phase.rutinaId} onChange={(event) => onChange({ ...phase, rutinaId: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-lg border bg-white px-2 text-sm normal-case text-slate-900"><option value={0}>Elegir rutina</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></label><MiniNumber label="Desde sem." value={phase.semanaInicio} onChange={(value) => onChange({ ...phase, semanaInicio: value })} /><MiniNumber label="Hasta sem." value={phase.semanaFin} onChange={(value) => onChange({ ...phase, semanaFin: value })} /><MoveButtons first={first} last={last} onMove={onMove} onRemove={onRemove} /></div>;
}

function MoveButtons({ first, last, onMove, onRemove }: { first: boolean; last: boolean; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="flex"><IconButton title="Subir" disabled={first} onClick={() => onMove(-1)} icon={ChevronUp} /><IconButton title="Bajar" disabled={last} onClick={() => onMove(1)} icon={ChevronDown} /><IconButton title="Quitar" onClick={onRemove} icon={X} /></div>;
}

function BuilderHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return <div className="flex items-center justify-between sm:col-span-2"><p className="text-sm font-black">{label}</p><button type="button" onClick={onAdd} className="text-xs font-bold text-cyan-700">+ Agregar</button></div>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function Field({ name, label, required, type = "text", defaultValue, className = "" }: { name: string; label: string; required?: boolean; type?: string; defaultValue?: string | null; className?: string }) {
  return <label className={`text-xs font-bold text-slate-600 ${className}`}>{label}<input name={name} type={type} required={required} defaultValue={defaultValue || ""} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-cyan-500" /></label>;
}

function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return <label className="text-xs font-bold text-slate-600 sm:col-span-2">{label}<textarea name={name} defaultValue={defaultValue || ""} rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm outline-none focus:border-cyan-500" /></label>;
}

function Select({ name, label, options, defaultValue, required, disabled }: { name: string; label: string; options: Array<{ value: string | number; label: string }>; defaultValue?: string; required?: boolean; disabled?: boolean }) {
  return <label className="text-xs font-bold text-slate-600">{label}<select name={name} required={required} disabled={disabled} defaultValue={defaultValue || ""} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:bg-slate-100"><option value="">Seleccionar</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{disabled && <input type="hidden" name={name} value={defaultValue} />}</label>;
}

function Submit({ label, busy, disabled }: { label: string; busy: boolean; disabled?: boolean }) {
  return <button disabled={busy || disabled} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-40 sm:col-span-2">{busy ? "Guardando…" : label}</button>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex max-w-md items-center gap-2 rounded-xl border bg-white px-3"><Search className="h-4 w-4 text-slate-400" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 flex-1 bg-transparent text-sm outline-none" /></label>;
}

function Status({ value }: { value: string }) {
  const active = value === "activo" || value === "activa";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${active ? "bg-emerald-100 text-emerald-700" : value === "pausada" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{value}</span>;
}

function IconButton({ title, icon: Icon, onClick, disabled }: { title: string; icon: typeof Edit3; onClick: () => void; disabled?: boolean }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><Icon className="h-4 w-4" /></button>;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">{label}</button>;
}

function MiniNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-[10px] font-bold uppercase text-slate-500">{label}<input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm text-slate-900" /></label>;
}

function MiniText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-bold uppercase text-slate-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm normal-case text-slate-900" /></label>;
}

function EmptyState({ title, text: description, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-black">{title}</h2><p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{description}</p><button onClick={onAction} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">{action}</button></div>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></div>;
}

function modalTitle(modal: Exclude<Modal, null>, editing: boolean) {
  const nouns: Record<Exclude<Modal, null>, string> = { ejercicio: "ejercicio", rutina: "rutina", plan: "plan", objetivo: "objetivo", asignacion: "entrenamiento" };
  return `${editing ? "Editar" : modal === "asignacion" ? "Asignar" : "Crear"} ${nouns[modal]}`;
}

function text(form: FormData, key: string) { return String(form.get(key) || "").trim(); }
function number(form: FormData, key: string) { return Number(form.get(key) || 0); }
function date(value: string) { return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(value)); }
