"use client";
/* eslint-disable @next/next/no-img-element -- las fotos privadas requieren cookies y no deben pasar por el optimizador público */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Dumbbell,
  Flame,
  Gift,
  Home,
  LogOut,
  Medal,
  Play,
  RefreshCw,
  Sparkles,
  Store,
  Tag,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  X,
  CheckCheck,
} from "lucide-react";
import { cambiarPasswordPortal, getPortalData, logoutCliente } from "@/app/actions/portalAuth";
import { finalizarEntrenamiento, getEntrenamientoHoy, iniciarEntrenamiento, registrarSerie } from "@/app/actions/entrenamiento";
import { cancelarReserva, getClasesDisponibles, reservarClase } from "@/app/actions/clases";
import { getFidelizacionSocio, solicitarCanjeSocio } from "@/app/actions/fidelizacion";
import { marcarNotificacionLeida, marcarTodasNotificacionesLeidas } from "@/app/actions/notificaciones";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

type Tab = "inicio" | "entrenamiento" | "reservas" | "beneficios" | "progreso" | "perfil";

type PortalData = {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  foto?: string | null;
  fechaRegistro: string;
  fechaNacimiento?: string | null;
  contactoEmergencia?: string | null;
  visitasMes: number;
  puntos: number;
  debeCambiarPassword: boolean;
  sucursalHabitual?: { nombre: string } | null;
  tenant: { nombre: string };
  entrenador?: { user: { name: string; image?: string | null } } | null;
  objetivos: Array<{ id: number; tipo: string; principal: boolean }>;
  pagos: Array<{ id: number; fechaPago: string; fechaVencimiento: string; monto: number; estado: string; membresia: { nombre: string } }>;
  ingresos: Array<{ id: number; fechaHora: string; estado: string }>;
  mediciones: Array<{ id: number; fecha: string; peso?: string | number | null; altura?: string | number | null; imc?: string | number | null; grasa?: string | number | null; masaMuscular?: string | number | null; cintura?: string | number | null; pecho?: string | number | null; brazoIzquierdo?: string | number | null; brazoDerecho?: string | number | null; piernaIzquierda?: string | number | null; piernaDerecha?: string | number | null; cadera?: string | number | null; observaciones?: string | null }>;
  fotosProgreso: Array<{ id: number; fecha: string; tipo: string; mimeType: string }>;
  reservas: Array<{ id: number; estado: string; clase: { inicio: string; tipoClase: { nombre: string }; sucursal: { nombre: string } } }>;
  historialReservas: Array<{ id: number; estado: string; posicionEspera?: number | null; canceladaEn?: string | null; asistenciaEn?: string | null; creadaEn: string; clase: { inicio: string; duracionMinutos: number; sala?: string | null; tipoClase: { nombre: string }; sucursal: { nombre: string }; entrenador?: { user: { name: string } } | null } }>;
  notificaciones: Array<{ id: number; titulo: string; mensaje: string; leidaEn?: string | null }>;
  sesionesEntrenamiento: Array<{ id: number; iniciadaEn: string; duracionMinutos?: number | null; cumplimiento?: string | number | null; comentario?: string | null; diaRutina?: number | null; rutina?: { nombre: string } | null; ejercicios: Array<{ id: number; seriesObjetivo?: number | null; repeticionesObjetivo?: string | null; ejercicio: { nombre: string; grupoMuscular: string }; series: Array<{ numero: number; peso?: string | number | null; repeticiones?: number | null; esfuerzoPercibido?: number | null; comentario?: string | null; completada: boolean }> }> }>;
};

type WorkoutSet = { numero: number; peso?: string | number | null; repeticiones?: number | null; esfuerzoPercibido?: number | null; comentario?: string | null; completada: boolean };
type SessionExercise = { id: number; orden: number; seriesObjetivo?: number | null; repeticionesObjetivo?: string | null; pesoSugerido?: string | number | null; descansoSegundos?: number | null; tiempoSegundos?: number | null; observaciones?: string | null; ejercicio: { nombre: string; grupoMuscular: string; instrucciones?: string | null; imagenUrl?: string | null; videoUrl?: string | null }; series: WorkoutSet[] };
type WorkoutPayload = {
  status: "pendiente" | "en_curso";
  assignment?: { id: number };
  routineDay?: number;
  currentPhase?: { orden: number; semanaInicio: number; semanaFin: number; rutina: { nombre: string } } | null;
  routine?: { id: number; nombre: string; descripcion?: string | null; recomendaciones?: string | null; ejercicios: Array<{ id: number; dia: number; series?: number | null; repeticiones?: string | null; pesoSugerido?: string | number | null; descansoSegundos?: number | null; tiempoSegundos?: number | null; observaciones?: string | null; ejercicio: { nombre: string; grupoMuscular: string; instrucciones?: string | null; imagenUrl?: string | null; videoUrl?: string | null } }> };
  session?: { id: number; iniciadaEn: string; diaRutina?: number | null; ejercicios: SessionExercise[] };
};
type GymClass = { id: number; inicio: string; duracionMinutos: number; cupoMaximo: number; disponibles: number; reservados: number; sala?: string | null; tipoClase: { nombre: string }; sucursal: { nombre: string }; entrenador?: { user: { name: string } } | null; miReserva?: { estado: string; posicionEspera?: number | null } | null };

const nav: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "entrenamiento", label: "Entrenar", icon: Dumbbell },
  { id: "reservas", label: "Reservas", icon: CalendarDays },
  { id: "beneficios", label: "Premios", icon: Gift },
  { id: "progreso", label: "Progreso", icon: TrendingUp },
  { id: "perfil", label: "Perfil", icon: CircleUserRound },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(value));
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function SetRow({
  exerciseSessionId,
  set,
  onSaved,
}: {
  exerciseSessionId: number;
  set: WorkoutSet;
  onSaved: (numero: number, completed: boolean) => void;
}) {
  const [weight, setWeight] = useState(String(set.peso ?? ""));
  const [reps, setReps] = useState(String(set.repeticiones ?? ""));
  const [effort, setEffort] = useState(String(set.esfuerzoPercibido ?? ""));
  const [comment, setComment] = useState(set.comentario || "");
  const [done, setDone] = useState(set.completada);
  const [saving, setSaving] = useState(false);

  const save = async (next: boolean) => {
    setSaving(true);
    const result = await registrarSerie({
      ejercicioSesionId: exerciseSessionId,
      numero: set.numero,
      peso: weight ? Number(weight) : null,
      repeticiones: reps ? Number(reps) : null,
      esfuerzoPercibido: effort ? Number(effort) : null,
      comentario: comment,
      completada: next,
    });
    if (result.success) {
      setDone(next);
      onSaved(set.numero, next);
    }
    setSaving(false);
  };

  return (
    <div className={`rounded-2xl border p-2 ${done ? "border-lime-300/40 bg-lime-300/10" : "border-white/8 bg-white/[0.035]"}`}>
      <div className="grid grid-cols-[32px_1fr_1fr_48px] items-center gap-2">
        <span className="text-center text-sm font-black text-slate-400">{set.numero}</span>
        <label className="relative">
          <input
            aria-label={`Peso serie ${set.numero}`}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-2 pr-7 text-center text-lg font-black text-white outline-none focus:border-lime-300"
          />
          <span className="absolute right-2 top-4 text-[9px] font-bold text-slate-500">KG</span>
        </label>
        <label className="relative">
          <input
            aria-label={`Repeticiones serie ${set.numero}`}
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-2 pr-9 text-center text-lg font-black text-white outline-none focus:border-lime-300"
          />
          <span className="absolute right-1.5 top-4 text-[9px] font-bold text-slate-500">REPS</span>
        </label>
        <button
          onClick={() => save(!done)}
          disabled={saving}
          aria-label={`Marcar serie ${set.numero}`}
          className={`grid h-12 w-12 place-items-center rounded-xl transition ${done ? "bg-lime-300 text-slate-950" : "bg-white/8 text-slate-400"}`}
        >
          {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
        </button>
      </div>
      <details className="mt-2 px-1">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Esfuerzo y comentario opcional
        </summary>
        <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
          <label className="text-[9px] font-bold uppercase text-slate-500">
            Esfuerzo 1–10
            <input
              aria-label={`Esfuerzo serie ${set.numero}`}
              type="number"
              min="1"
              max="10"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-center text-sm text-white"
            />
          </label>
          <label className="text-[9px] font-bold uppercase text-slate-500">
            Comentario
            <input
              aria-label={`Comentario serie ${set.numero}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-sm text-white"
            />
          </label>
        </div>
        <button type="button" onClick={() => save(done)} disabled={saving} className="mt-2 h-9 w-full rounded-xl bg-white/8 text-xs font-black text-slate-300">
          Guardar detalles
        </button>
      </details>
    </div>
  );
}

function WorkoutSession({
  session,
  onFinish,
}: {
  session: NonNullable<WorkoutPayload["session"]>;
  onFinish: (comment?: string) => Promise<void>;
}) {
  const firstPending = session.ejercicios.findIndex((item) => item.series.some((set) => !set.completada));
  const [exerciseIndex, setExerciseIndex] = useState(Math.max(0, firstPending));
  const [completed, setCompleted] = useState(
    () => new Set(session.ejercicios.flatMap((item) => item.series.filter((set) => set.completada).map((set) => `${item.id}:${set.numero}`)))
  );
  const [restRemaining, setRestRemaining] = useState(0);
  const [sessionComment, setSessionComment] = useState("");
  const [finishing, setFinishing] = useState(false);
  const exercise = session.ejercicios[exerciseIndex];
  const totalSets = session.ejercicios.reduce((sum, item) => sum + item.series.length, 0);
  const progress = totalSets ? Math.round((completed.size / totalSets) * 100) : 0;

  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = window.setInterval(() => setRestRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [restRemaining]);

  const saved = (exerciseId: number, setNumber: number, isCompleted: boolean) => {
    setCompleted((current) => {
      const next = new Set(current);
      const key = `${exerciseId}:${setNumber}`;
      if (isCompleted) next.add(key);
      else next.delete(key);
      return next;
    });
    if (isCompleted && exercise.descansoSegundos) setRestRemaining(exercise.descansoSegundos);
  };
  const finish = async () => {
    setFinishing(true);
    await onFinish(sessionComment);
    setFinishing(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400">
            Día {session.diaRutina || 1} · Ejercicio {exerciseIndex + 1}/{session.ejercicios.length}
          </span>
          <span className="text-lime-300">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {restRemaining > 0 && (
        <button
          onClick={() => setRestRemaining(0)}
          className="flex w-full items-center justify-between rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-orange-200"
        >
          <span className="flex items-center gap-2 text-xs font-black uppercase">
            <Timer className="h-4 w-4" />
            Descanso
          </span>
          <strong className="text-2xl tabular-nums">
            {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, "0")}
          </strong>
          <span className="text-[10px] font-bold">OMITIR</span>
        </button>
      )}
      <article className="overflow-hidden rounded-[28px] border border-white/8 bg-[#11151c]">
        {exercise.ejercicio.imagenUrl && (
          <div
            className="h-40 bg-cover bg-center"
            role="img"
            aria-label={exercise.ejercicio.nombre}
            style={{ backgroundImage: `linear-gradient(to top, #11151c, transparent), url(${exercise.ejercicio.imagenUrl})` }}
          />
        )}
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime-300">{exercise.ejercicio.grupoMuscular}</p>
          <h2 className="mt-1 text-2xl font-black">{exercise.ejercicio.nombre}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <WorkoutChip label={`${exercise.seriesObjetivo || exercise.series.length} series`} />
            <WorkoutChip label={`${exercise.repeticionesObjetivo || "libre"} reps`} />
            {exercise.pesoSugerido != null && <WorkoutChip label={`${Number(exercise.pesoSugerido)} kg sugeridos`} />}
            {exercise.descansoSegundos != null && <WorkoutChip label={`${exercise.descansoSegundos}s descanso`} />}
            {exercise.tiempoSegundos != null && <WorkoutChip label={`${exercise.tiempoSegundos}s trabajo`} />}
          </div>
          {exercise.ejercicio.instrucciones && <p className="mt-4 text-sm leading-relaxed text-slate-400">{exercise.ejercicio.instrucciones}</p>}
          {exercise.observaciones && <div className="mt-3 rounded-2xl bg-cyan-400/10 p-3 text-sm text-cyan-100"><b>Nota del entrenador:</b> {exercise.observaciones}</div>}
          {exercise.ejercicio.videoUrl && (
            <a href={exercise.ejercicio.videoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-lime-300">
              <Play className="h-4 w-4" />
              Ver demostración
            </a>
          )}
          <div className="mt-5 grid grid-cols-[32px_1fr_1fr_48px] gap-2 px-2 text-center text-[9px] font-black uppercase tracking-wide text-slate-600">
            <span>Serie</span>
            <span>Peso</span>
            <span>Reps</span>
            <span>Hecho</span>
          </div>
          <div className="mt-2 space-y-2">
            {exercise.series.map((set) => (
              <SetRow key={set.numero} exerciseSessionId={exercise.id} set={set} onSaved={(number, value) => saved(exercise.id, number, value)} />
            ))}
          </div>
        </div>
      </article>
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={exerciseIndex === 0}
          onClick={() => setExerciseIndex((value) => Math.max(0, value - 1))}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/7 text-sm font-black disabled:opacity-25"
        >
          <ChevronLeft className="h-5 w-5" />
          Anterior
        </button>
        <button
          disabled={exerciseIndex === session.ejercicios.length - 1}
          onClick={() => setExerciseIndex((value) => Math.min(session.ejercicios.length - 1, value + 1))}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/7 text-sm font-black disabled:opacity-25"
        >
          Siguiente
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {exerciseIndex === session.ejercicios.length - 1 && (
        <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-4">
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Comentario general opcional
            <textarea
              value={sessionComment}
              onChange={(event) => setSessionComment(event.target.value)}
              rows={2}
              placeholder="¿Cómo te sentiste hoy?"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 p-3 text-sm normal-case text-white outline-none focus:border-lime-300"
            />
          </label>
          <button
            onClick={finish}
            disabled={finishing}
            className="mt-3 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 text-base font-black text-slate-950 disabled:opacity-50"
          >
            {finishing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
            Finalizar entrenamiento
          </button>
        </div>
      )}
    </div>
  );
}

function WorkoutChip({ label }: { label: string }) {
  return <span className="rounded-full bg-white/7 px-3 py-1.5 text-[10px] font-black text-slate-300">{label}</span>;
}

export default function MemberDashboard() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [workout, setWorkout] = useState<WorkoutPayload | null>(null);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [fidelizacion, setFidelizacion] = useState<any>(null);

  const [tab, setTab] = useState<Tab>("inicio");
  const [classRange, setClassRange] = useState<"hoy" | "semana" | "todas">("semana");
  const [bookingView, setBookingView] = useState<"agenda" | "historial">("agenda");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canjeando, setCanjeando] = useState(false);

  const load = useCallback(async () => {
    const [resultData, resultWorkout, resultClasses, resultFid] = await Promise.all([
      getPortalData(),
      getEntrenamientoHoy(),
      getClasesDisponibles(),
      getFidelizacionSocio(),
    ]);

    if (!resultData.success || !resultData.data) {
      router.replace("/");
      return;
    }

    setData(resultData.data as unknown as PortalData);
    if (resultWorkout.success) setWorkout(resultWorkout.data as unknown as WorkoutPayload);
    if (resultClasses.success) setClasses(resultClasses.data as unknown as GymClass[]);
    if (resultFid.success) setFidelizacion(resultFid.data);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#080b10] text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-lime-300" />
          <span className="text-sm font-bold">Cargando OnlyGym...</span>
        </div>
      </main>
    );
  }

  const latestPayment = data.pagos[0];
  const activeMembership = latestPayment && new Date(latestPayment.fechaVencimiento) >= new Date();
  const nextBooking = data.reservas[0];
  const lastWeight = data.mediciones.find((item) => item.peso != null)?.peso;

  const exerciseProgress = new Map<string, Array<{ date: string; weight: number }>>();
  data.sesionesEntrenamiento.forEach((session) => {
    session.ejercicios.forEach((item) => {
      const topSet = item.series.filter((set) => set.completada && set.peso != null).sort((a, b) => Number(b.peso) - Number(a.peso))[0];
      if (topSet?.peso != null) {
        const history = exerciseProgress.get(item.ejercicio.nombre) || [];
        history.push({ date: session.iniciadaEn, weight: Number(topSet.peso) });
        exerciseProgress.set(item.ejercicio.nombre, history);
      }
    });
  });

  const now = new Date();
  const classLimit = new Date(now);
  if (classRange === "hoy") classLimit.setDate(classLimit.getDate() + 1);
  if (classRange === "semana") classLimit.setDate(classLimit.getDate() + 7);
  const visibleClasses = classRange === "todas" ? classes : classes.filter((item) => new Date(item.inicio) <= classLimit);

  const startWorkout = async () => {
    if (!workout?.assignment || !workout.routine) return;
    const result = await iniciarEntrenamiento(workout.assignment.id, workout.routine.id);
    if (result.success) {
      setMessage("Entrenamiento iniciado");
      await load();
    }
  };

  const finishWorkout = async (comment?: string) => {
    if (!workout?.session) return;
    const result = await finalizarEntrenamiento(workout.session.id, comment);
    if (result.success) {
      setMessage(`¡Listo! Sumaste ${result.data?.puntosGanados || 0} puntos`);
      await load();
      setTab("progreso");
    }
  };

  const book = async (classId: number, cancel = false) => {
    const result = cancel ? await cancelarReserva(classId) : await reservarClase(classId);
    setMessage(result.success ? "Reserva actualizada" : String(result.error || "No se pudo actualizar"));
    await load();
  };

  const handleCanjear = async (premioId: number) => {
    if (!window.confirm("¿Confirmar canje de este premio con tus puntos?")) return;
    setCanjeando(true);
    const result = await solicitarCanjeSocio(premioId);
    setMessage(result.success ? result.mensaje || "¡Canje exitoso!" : result.error || "Error al canjear");
    if (result.success) await load();
    setCanjeando(false);
  };

  const handleMarcarLeida = async (notifId: number) => {
    await marcarNotificacionLeida(notifId);
    await load();
  };

  const handleMarcarTodasLeidas = async () => {
    await marcarTodasNotificacionesLeidas();
    await load();
  };

  const logout = async () => {
    await logoutCliente();
    router.replace("/");
  };

  const unreadNotifs = data.notificaciones.filter((item) => !item.leidaEn);

  return (
    <main className="min-h-dvh bg-[#080b10] pb-28 text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/7 bg-[#080b10]/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-300 text-slate-950">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight">OnlyGym</p>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{data.tenant.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallPrompt variant="button" appName="OnlyGym" />
            <button
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="Notificaciones"
              className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-slate-300"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifs.length > 0 && (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-orange-400 ring-2 ring-[#080b10]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Modal */}
      {notificationsOpen && (
        <aside className="fixed inset-x-4 top-20 z-40 mx-auto max-w-lg rounded-3xl border border-white/10 bg-[#151a22] p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-lime-300" />
              <h2 className="font-black text-sm">Notificaciones ({unreadNotifs.length})</h2>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotifs.length > 0 && (
                <button
                  onClick={handleMarcarTodasLeidas}
                  className="text-[10px] font-bold text-lime-300 hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Marcar leídas
                </button>
              )}
              <button onClick={() => setNotificationsOpen(false)} aria-label="Cerrar notificaciones" className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {data.notificaciones.length ? (
              data.notificaciones.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.leidaEn && handleMarcarLeida(item.id)}
                  className={`rounded-2xl p-3 text-xs transition cursor-pointer ${
                    item.leidaEn ? "bg-white/[0.02] opacity-60" : "bg-white/10 border border-lime-300/20"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-white">{item.titulo}</p>
                    {!item.leidaEn && <span className="w-2 h-2 rounded-full bg-lime-300 shrink-0" />}
                  </div>
                  <p className="mt-1 text-slate-300">{item.mensaje}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">No hay notificaciones.</p>
            )}
          </div>
        </aside>
      )}

      {message && (
        <button
          onClick={() => setMessage(null)}
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-lime-300 px-4 py-2 text-xs font-black text-slate-950 shadow-xl"
        >
          {message}
        </button>
      )}

      {/* Main Container */}
      <div className="mx-auto max-w-lg px-4 py-5">
        {/* TAB: INICIO */}
        {tab === "inicio" && (
          <section className="space-y-5">
            <div>
              <p className="text-sm font-bold text-lime-300">Hola, {data.nombre} 👋</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Tu próxima mejor versión empieza hoy.</h1>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#182118] via-[#111820] to-[#11131a] p-5">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime-300/10 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Membresía</p>
                  <p className="mt-2 text-xl font-black">{latestPayment?.membresia.nombre || "Sin membresía"}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {latestPayment ? `Vence ${formatDate(latestPayment.fechaVencimiento)}` : "Consultá en recepción"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                    activeMembership ? "bg-lime-300 text-slate-950" : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {activeMembership ? "Habilitado" : "Revisar"}
                </span>
              </div>
              <button
                onClick={() => setTab("entrenamiento")}
                className="relative mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 text-sm font-black text-slate-950"
              >
                <Play className="h-5 w-5 fill-current" />
                Entrenar ahora
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric icon={Users} value={String(data.visitasMes)} label="Visitas mes" />
              <Metric icon={Flame} value={String(Math.min(data.visitasMes, 7))} label="Racha" />
              <Metric icon={Trophy} value={String(data.puntos)} label="Puntos" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Quick icon={Dumbbell} label="Mi rutina" action={() => setTab("entrenamiento")} />
              <Quick icon={CalendarDays} label="Reservar clase" action={() => setTab("reservas")} />
              <Quick icon={Gift} label="Mis puntos y premios" action={() => setTab("beneficios")} />
              <Quick icon={TrendingUp} label="Ver progreso" action={() => setTab("progreso")} />
            </div>

            {nextBooking && (
              <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Próxima clase</p>
                    <p className="mt-1 font-black">{nextBooking.clase.tipoClase.nombre}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(nextBooking.clase.inicio)} · {formatTime(nextBooking.clase.inicio)} · {nextBooking.clase.sucursal.nombre}
                    </p>
                  </div>
                  <CalendarDays className="h-8 w-8 text-orange-400" />
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB: ENTRENAMIENTO */}
        {tab === "entrenamiento" && (
          <section className="space-y-4">
            <SectionTitle
              eyebrow="Entrenamiento de hoy"
              title={workout?.session ? "Ya estás en movimiento" : workout?.routine?.nombre || "Día de recuperación"}
            />
            {!workout && <Empty icon={Dumbbell} title="No tenés una rutina activa" text="Tu entrenador puede asignarte un plan desde su panel." />}
            {workout?.status === "pendiente" && workout.routine && (
              <>
                <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      {workout.currentPhase && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-lime-300">
                          Fase {workout.currentPhase.orden} · semanas {workout.currentPhase.semanaInicio}–{workout.currentPhase.semanaFin}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-black">Día {workout.routineDay || 1}</p>
                    </div>
                    <span className="rounded-full bg-white/7 px-3 py-1 text-xs font-bold text-slate-300">
                      {workout.routine.ejercicios.length} ejercicios
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{workout.routine.descripcion || "Tu sesión está lista."}</p>
                  {workout.routine.recomendaciones && (
                    <p className="mt-2 rounded-2xl bg-cyan-400/10 p-3 text-xs text-cyan-100">{workout.routine.recomendaciones}</p>
                  )}
                  <div className="mt-4 space-y-2">
                    {workout.routine.ejercicios.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-950/60 p-3">
                        {item.ejercicio.imagenUrl ? (
                          <div className="h-10 w-10 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${item.ejercicio.imagenUrl})` }} />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300/10 text-sm font-black text-lime-300">
                            {index + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{item.ejercicio.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {item.series} series · {item.repeticiones} reps
                            {item.pesoSugerido != null ? ` · ${Number(item.pesoSugerido)} kg` : ""}
                          </p>
                        </div>
                        {item.descansoSegundos != null && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Clock className="h-3 w-3" />
                            {item.descansoSegundos}s
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={startWorkout}
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 text-base font-black text-slate-950"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Comenzar entrenamiento
                </button>
              </>
            )}
            {workout?.session && <WorkoutSession session={workout.session} onFinish={finishWorkout} />}
          </section>
        )}

        {/* TAB: RESERVAS */}
        {tab === "reservas" && (
          <section className="space-y-4">
            <SectionTitle eyebrow="Agenda" title="Tus clases, sin vueltas" />
            <div className="grid grid-cols-2 rounded-2xl bg-white/5 p-1">
              <button
                onClick={() => setBookingView("agenda")}
                className={`h-11 rounded-xl text-xs font-black ${bookingView === "agenda" ? "bg-lime-300 text-slate-950" : "text-slate-500"}`}
              >
                Buscar clases
              </button>
              <button
                onClick={() => setBookingView("historial")}
                className={`h-11 rounded-xl text-xs font-black ${bookingView === "historial" ? "bg-lime-300 text-slate-950" : "text-slate-500"}`}
              >
                Mi historial
              </button>
            </div>
            {bookingView === "agenda" ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    ["hoy", "Hoy"],
                    ["semana", "Próximos 7 días"],
                    ["todas", "Todas"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setClassRange(id as typeof classRange)}
                      className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wide ${
                        classRange === id ? "bg-white text-slate-950" : "bg-white/6 text-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {visibleClasses.length === 0 ? (
                  <Empty icon={CalendarDays} title="No hay clases en este período" text="Probá ampliando el rango de fechas." />
                ) : (
                  visibleClasses.map((item) => (
                    <article key={item.id} className="rounded-[26px] border border-white/8 bg-[#11151c] p-4">
                      <div className="flex items-start gap-4">
                        <div className="min-w-14 rounded-2xl bg-orange-400/10 p-2 text-center text-orange-300">
                          <p className="text-[10px] font-black uppercase">{formatDate(item.inicio).split(" ")[1]}</p>
                          <p className="text-2xl font-black">{new Date(item.inicio).getDate()}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-black">{item.tipoClase.nombre}</h2>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatTime(item.inicio)} · {item.duracionMinutos} min · {item.sucursal.nombre}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.entrenador?.user.name || "Equipo OnlyGym"}
                            {item.sala ? ` · ${item.sala}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/7 pt-3">
                        <div>
                          <p className="text-xs font-bold text-slate-300">
                            {item.disponibles} de {item.cupoMaximo} lugares
                          </p>
                          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-lime-300"
                              style={{ width: `${Math.min(100, (item.reservados / item.cupoMaximo) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => book(item.id, Boolean(item.miReserva && item.miReserva.estado !== "cancelada"))}
                          className={`rounded-xl px-4 py-2 text-xs font-black ${
                            item.miReserva && item.miReserva.estado !== "cancelada" ? "bg-white/8 text-slate-300" : "bg-lime-300 text-slate-950"
                          }`}
                        >
                          {item.miReserva?.estado === "espera"
                            ? `Espera #${item.miReserva.posicionEspera}`
                            : item.miReserva && item.miReserva.estado !== "cancelada"
                            ? "Cancelar"
                            : item.disponibles
                            ? "Reservar"
                            : "Lista de espera"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </>
            ) : data.historialReservas.length ? (
              <div className="space-y-3">
                {data.historialReservas.map((booking) => (
                  <article key={booking.id} className="rounded-2xl border border-white/8 bg-[#11151c] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black">{booking.clase.tipoClase.nombre}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(booking.clase.inicio)} · {formatTime(booking.clase.inicio)} · {booking.clase.sucursal.nombre}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{booking.clase.entrenador?.user.name || "Equipo OnlyGym"}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                          booking.estado === "asistio"
                            ? "bg-lime-300/10 text-lime-300"
                            : booking.estado === "cancelada"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-white/7 text-slate-400"
                        }`}
                      >
                        {booking.estado === "asistio" ? "Asististe" : booking.estado === "cancelada" ? "Cancelada" : booking.estado}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty icon={CalendarDays} title="Todavía no hay historial" text="Tus clases realizadas y canceladas aparecerán acá." />
            )}
          </section>
        )}

        {/* TAB: PREMIOS & BENEFICIOS (FASE 9) */}
        {tab === "beneficios" && (
          <section className="space-y-5">
            <SectionTitle eyebrow="Fidelización" title="Premios, Retos y Beneficios" />

            {/* Points Summary Header */}
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-amber-500/20 via-[#111820] to-[#11131a] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Tus Puntos Acumulados</p>
                  <p className="text-3xl font-black text-white mt-1">{data.puntos} pts</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ganás puntos por entrenar, asistir a clases y completar retos.</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-300 grid place-items-center">
                  <Trophy className="w-8 h-8" />
                </div>
              </div>
            </div>

            {/* Active Challenges */}
            {fidelizacion?.desafios?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-lime-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400" /> Desafíos Activos
                </h3>
                <div className="space-y-2">
                  {fidelizacion.desafios.map((d: any) => (
                    <div key={d.id} className="p-4 rounded-2xl bg-[#11151c] border border-white/8">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-white">{d.titulo}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{d.descripcion}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/20">
                          +{d.puntosRecompensa} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rewards Catalog */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-lime-300 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-lime-300" /> Catálogo de Premios Canjeables
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fidelizacion?.premios?.map((premio: any) => {
                  const canAfford = data.puntos >= premio.puntos;
                  const hasStock = premio.stock == null || premio.stock > 0;

                  return (
                    <div key={premio.id} className="p-4 rounded-2xl bg-[#11151c] border border-white/8 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400/10 text-amber-300">
                            {premio.puntos} pts
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {premio.stock == null ? "Disponible" : `${premio.stock} en stock`}
                          </span>
                        </div>
                        <h4 className="font-black text-base text-white mt-2">{premio.nombre}</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{premio.descripcion}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                        <button
                          onClick={() => handleCanjear(premio.id)}
                          disabled={!canAfford || !hasStock || canjeando}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                            canAfford && hasStock
                              ? "bg-lime-300 text-slate-950 hover:bg-lime-400 shadow-md"
                              : "bg-white/5 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {!hasStock ? "Sin stock" : !canAfford ? `Faltan ${premio.puntos - data.puntos} pts` : "Canjear Premio"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Commercial Benefits */}
            {fidelizacion?.beneficios?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-lime-300 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-cyan-400" /> Beneficios en Comercios Amigos
                </h3>
                <div className="space-y-2">
                  {fidelizacion.beneficios.map((b: any) => (
                    <div key={b.id} className="p-4 rounded-2xl bg-[#11151c] border border-white/8 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-sm text-white">{b.titulo}</h4>
                        <span className="text-[10px] font-bold text-cyan-300 uppercase">{b.comercio}</span>
                      </div>
                      <p className="text-xs text-slate-400">{b.descripcion}</p>
                      {b.condiciones && (
                        <p className="text-[10px] text-lime-300 font-mono mt-1 pt-1 border-t border-white/5">
                          {b.condiciones}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB: PROGRESO */}
        {tab === "progreso" && (
          <section className="space-y-4">
            <SectionTitle eyebrow="Tu evolución" title="Lo que se mide, mejora" />
            <div className="grid grid-cols-2 gap-3">
              <ProgressCard icon={Activity} value={lastWeight ? `${lastWeight} kg` : "—"} label="Peso actual" />
              <ProgressCard icon={Users} value={String(data.visitasMes)} label="Visitas este mes" />
              <ProgressCard icon={Dumbbell} value={String(data.sesionesEntrenamiento.length)} label="Entrenamientos" />
              <ProgressCard icon={Target} value={data.objetivos.find((item) => item.principal)?.tipo || "Definir"} label="Objetivo principal" />
            </div>
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <h2 className="font-black">Evolución corporal</h2>
              {data.mediciones.length ? (
                <div className="mt-4 space-y-5">
                  <BodyChart
                    label="Peso"
                    unit="kg"
                    color="bg-lime-300"
                    values={data.mediciones.filter((item) => item.peso != null).map((item) => ({ date: item.fecha, value: Number(item.peso) }))}
                  />
                  <BodyChart
                    label="Grasa corporal"
                    unit="%"
                    color="bg-orange-400"
                    values={data.mediciones.filter((item) => item.grasa != null).map((item) => ({ date: item.fecha, value: Number(item.grasa) }))}
                  />
                  <BodyChart
                    label="Masa muscular"
                    unit="%"
                    color="bg-cyan-400"
                    values={data.mediciones.filter((item) => item.masaMuscular != null).map((item) => ({ date: item.fecha, value: Number(item.masaMuscular) }))}
                  />
                  <BodyChart
                    label="Cintura"
                    unit="cm"
                    color="bg-fuchsia-400"
                    values={data.mediciones.filter((item) => item.cintura != null).map((item) => ({ date: item.fecha, value: Number(item.cintura) }))}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Todavía no hay mediciones.</p>
              )}
            </div>
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <h2 className="font-black">Progresión de cargas</h2>
              {exerciseProgress.size ? (
                <div className="mt-4 space-y-5">
                  {[...exerciseProgress.entries()].slice(0, 5).map(([name, values]) => (
                    <LoadChart key={name} name={name} values={values} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Completá entrenamientos para ver tu evolución por ejercicio.</p>
              )}
            </div>
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <h2 className="font-black">Historial de entrenamientos</h2>
              <div className="mt-4 space-y-3">
                {data.sesionesEntrenamiento.filter((item) => item.duracionMinutos).map((item) => (
                  <WorkoutHistory key={item.id} session={item} />
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <h2 className="font-black">Historial de mediciones</h2>
              {data.mediciones.length ? (
                <div className="mt-4 space-y-3">
                  {data.mediciones.slice(0, 12).map((item) => (
                    <details key={item.id} className="border-b border-white/6 pb-3">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold">{formatDate(item.fecha)}</p>
                            <p className="text-xs text-slate-500">
                              Grasa {item.grasa ? `${Number(item.grasa)}%` : "—"} · Músculo {item.masaMuscular ? `${Number(item.masaMuscular)}%` : "—"} · IMC {item.imc ? Number(item.imc).toFixed(1) : "—"}
                            </p>
                          </div>
                          <p className="text-lg font-black text-lime-300">{item.peso ? `${Number(item.peso)} kg` : "—"}</p>
                        </div>
                      </summary>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {[
                          ["Cintura", item.cintura],
                          ["Pecho", item.pecho],
                          ["Cadera", item.cadera],
                          ["Brazo izq.", item.brazoIzquierdo],
                          ["Brazo der.", item.brazoDerecho],
                          ["Pierna izq.", item.piernaIzquierda],
                          ["Pierna der.", item.piernaDerecha],
                        ]
                          .filter(([, value]) => value != null)
                          .map(([label, value]) => (
                            <span key={String(label)} className="rounded-lg bg-white/6 px-2 py-1 text-[10px] font-bold text-slate-400">
                              {label}: {Number(value)} cm
                            </span>
                          ))}
                      </div>
                      {item.observaciones && <p className="mt-2 text-xs text-slate-500">{item.observaciones}</p>}
                    </details>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Todavía no hay mediciones. Pedile una a tu entrenador.</p>
              )}
            </div>
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-lime-300" />
                <h2 className="font-black">Fotos privadas de progreso</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">Sólo vos, tu entrenador y administradores autorizados pueden verlas.</p>
              <MemberPhotoUploader onUploaded={load} setMessage={setMessage} />
              {data.fotosProgreso.length ? (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {data.fotosProgreso.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-2xl bg-slate-950">
                      <img src={`/api/progreso/fotos/${photo.id}`} alt={`Progreso ${photo.tipo}`} className="aspect-[3/4] w-full object-cover" />
                      <figcaption className="p-2 text-[9px] font-black uppercase tracking-wide text-slate-500">
                        {photo.tipo} · {formatDate(photo.fecha)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white/[0.03] p-4 text-center text-sm text-slate-500">Todavía no subiste fotos.</p>
              )}
            </div>
          </section>
        )}

        {/* TAB: PERFIL */}
        {tab === "perfil" && (
          <section className="space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-lime-300 text-2xl font-black text-slate-950">
                {data.nombre[0]}
                {data.apellido[0]}
              </div>
              <div>
                <h1 className="text-xl font-black">
                  {data.nombre} {data.apellido}
                </h1>
                <p className="text-sm text-slate-500">
                  Socio #{data.id} · DNI {data.documento}
                </p>
              </div>
            </div>
            <Info label="Email" value={data.email || "Sin registrar"} />
            <Info label="Teléfono" value={data.telefono || "Sin registrar"} />
            <Info label="Nacimiento" value={data.fechaNacimiento ? formatDate(data.fechaNacimiento) : "Sin registrar"} />
            <Info label="Contacto de emergencia" value={data.contactoEmergencia || "Sin registrar"} />
            <Info label="Sucursal habitual" value={data.sucursalHabitual?.nombre || "Sin asignar"} />
            <Info label="Entrenador" value={data.entrenador?.user.name || "Sin asignar"} />
            <Info label="Alta" value={formatDate(data.fechaRegistro)} />
            <Info label="Asistencias registradas" value={String(data.ingresos.length)} />
            <Info label="Reservas próximas" value={String(data.reservas.length)} />
            <div className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
              <h2 className="font-black">Historial de membresías</h2>
              <div className="mt-3 space-y-3">
                {data.pagos.slice(0, 6).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between border-b border-white/6 pb-3">
                    <div>
                      <p className="font-bold">{payment.membresia.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(payment.fechaPago)} → {formatDate(payment.fechaVencimiento)}
                      </p>
                    </div>
                    <p className="text-sm font-black">${payment.monto.toLocaleString("es-AR")}</p>
                  </div>
                ))}
              </div>
            </div>
            {data.debeCambiarPassword && (
              <button
                onClick={() => {
                  const value = window.prompt("Nueva contraseña (mínimo 8 caracteres)");
                  if (value) void cambiarPasswordPortal(value).then((result) => setMessage(result.success ? "Contraseña actualizada" : result.error || "Error"));
                }}
                className="h-12 w-full rounded-2xl bg-white/7 text-sm font-bold"
              >
                Cambiar contraseña inicial
              </button>
            )}
            <button
              onClick={logout}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 text-sm font-bold text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </section>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0b0e13]/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-black transition ${
                  active ? "text-lime-300" : "text-slate-600"
                }`}
              >
                <span className={`grid h-8 w-11 place-items-center rounded-xl ${active ? "bg-lime-300/10" : ""}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function LoadChart({ name, values }: { name: string; values: Array<{ date: string; weight: number }> }) {
  const recent = values.slice(-8);
  const max = Math.max(...recent.map((item) => item.weight), 1);
  const first = values[0]?.weight || 0;
  const latest = values.at(-1)?.weight || 0;
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="truncate font-bold">{name}</span>
        <span className="shrink-0 font-black text-lime-300">
          {first} → {latest} kg
        </span>
      </div>
      <div className="mt-3 flex h-20 items-end gap-1.5">
        {recent.map((item, index) => (
          <div key={`${item.date}-${index}`} className="flex h-full flex-1 flex-col justify-end" title={`${formatDate(item.date)} · ${item.weight} kg`}>
            <div className="min-h-2 rounded-t-md bg-lime-300/80" style={{ height: `${Math.max(10, (item.weight / max) * 100)}%` }} />
            <span className="mt-1 text-center text-[8px] text-slate-600">{new Date(item.date).getUTCDate()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BodyChart({ label, unit, values, color }: { label: string; unit: string; values: Array<{ date: string; value: number }>; color: string }) {
  const recent = [...values].reverse().slice(-10);
  if (!recent.length) return null;
  const min = Math.min(...recent.map((item) => item.value));
  const max = Math.max(...recent.map((item) => item.value));
  const range = Math.max(max - min, max * 0.08, 1);
  const first = recent[0].value;
  const latest = recent.at(-1)?.value || first;
  const delta = latest - first;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-[10px] text-slate-500">
            {formatDate(recent[0].date)} → {formatDate(recent.at(-1)?.date || recent[0].date)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-black">
            {latest} {unit}
          </p>
          <p className={`text-[10px] font-black ${delta > 0 ? "text-cyan-300" : delta < 0 ? "text-orange-300" : "text-slate-500"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} {unit}
          </p>
        </div>
      </div>
      <div className="mt-2 flex h-16 items-end gap-1">
        {recent.map((item, index) => (
          <div key={`${item.date}-${index}`} className="flex h-full flex-1 items-end" title={`${formatDate(item.date)} · ${item.value} ${unit}`}>
            <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(12, 15 + ((item.value - min) / range) * 85)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberPhotoUploader({ onUploaded, setMessage }: { onUploaded: () => Promise<void>; setMessage: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploading(true);
    const formElement = event.currentTarget;
    const response = await fetch("/api/progreso/fotos", { method: "POST", body: new FormData(formElement) });
    const result = await response.json();
    setMessage(result.success ? "Foto privada guardada" : result.error || "No se pudo guardar");
    if (result.success) {
      formElement.reset();
      await onUploaded();
    }
    setUploading(false);
  };
  return (
    <form onSubmit={submit} className="mt-4 grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          name="fecha"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"
        />
        <select name="tipo" className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white">
          <option value="frente">Frente</option>
          <option value="perfil">Perfil</option>
          <option value="espalda">Espalda</option>
        </select>
      </div>
      <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.025] text-xs font-black text-slate-400">
        <Upload className="h-4 w-4" />
        Elegir JPG, PNG o WEBP
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only" />
      </label>
      <button disabled={uploading} className="h-11 rounded-xl bg-lime-300 text-xs font-black text-slate-950 disabled:opacity-50">
        {uploading ? "Subiendo…" : "Guardar foto privada"}
      </button>
    </form>
  );
}

function WorkoutHistory({ session }: { session: PortalData["sesionesEntrenamiento"][number] }) {
  return (
    <details className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">
              {session.rutina?.nombre || "Entrenamiento"}
              {session.diaRutina ? ` · Día ${session.diaRutina}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {formatDate(session.iniciadaEn)} · {session.ejercicios.length} ejercicios · {Math.round(Number(session.cumplimiento || 0))}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black">{session.duracionMinutos} min</span>
            <ChevronDown className="h-4 w-4 text-slate-600" />
          </div>
        </div>
      </summary>
      <div className="mt-3 space-y-3 border-t border-white/7 pt-3">
        {session.ejercicios.map((item) => (
          <div key={item.id}>
            <p className="text-sm font-bold">{item.ejercicio.nombre}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.series.map((set) => (
                <span
                  key={set.numero}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    set.completada ? "bg-lime-300/10 text-lime-200" : "bg-white/5 text-slate-600"
                  }`}
                >
                  S{set.numero}: {set.peso == null ? "—" : `${Number(set.peso)}kg`} × {set.repeticiones ?? "—"}
                  {set.esfuerzoPercibido ? ` · RPE ${set.esfuerzoPercibido}` : ""}
                </span>
              ))}
            </div>
            {item.series.some((set) => set.comentario) && (
              <p className="mt-1 text-xs italic text-slate-500">
                {item.series
                  .filter((set) => set.comentario)
                  .map((set) => `S${set.numero}: ${set.comentario}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
        {session.comentario && <p className="rounded-xl bg-cyan-400/10 p-3 text-xs text-cyan-100">{session.comentario}</p>}
      </div>
    </details>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Home; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.035] p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-lime-300" />
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function Quick({ icon: Icon, label, action }: { icon: typeof Home; label: string; action: () => void }) {
  return (
    <button onClick={action} className="flex items-center gap-3 rounded-2xl border border-white/7 bg-white/[0.035] p-4 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300/10 text-lime-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-black">{label}</span>
    </button>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight">{title}</h1>
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
      <Icon className="mx-auto h-10 w-10 text-slate-700" />
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ProgressCard({ icon: Icon, value, label }: { icon: typeof Home; value: string; label: string }) {
  return (
    <div className="min-h-36 rounded-3xl border border-white/8 bg-[#11151c] p-4">
      <Icon className="h-5 w-5 text-lime-300" />
      <p className="mt-5 break-words text-xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/7 bg-white/[0.035] px-4 py-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate text-sm font-bold">{value}</span>
    </div>
  );
}
