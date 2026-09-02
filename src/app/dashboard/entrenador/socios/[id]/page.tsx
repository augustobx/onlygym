/* eslint-disable @next/next/no-img-element -- las fotos de progreso son privadas y requieren la sesión actual */
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Dumbbell, HeartPulse, Mail, Phone, Ruler, ShieldCheck, TrendingUp } from "lucide-react";
import { getSocioEntrenadorDetalle } from "@/app/actions/entrenadores";
import { memberWorkspaceHref } from "@/lib/member-workspace";

type Measure = { id: number; fecha: string; peso?: string | number | null; imc?: string | number | null; grasa?: string | number | null; masaMuscular?: string | number | null; observaciones?: string | null };
type Member = {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  foto?: string | null;
  fechaNacimiento?: string | null;
  contactoEmergencia?: string | null;
  fechaRegistro: string;
  sucursalHabitual?: { nombre: string } | null;
  objetivos: Array<{ id: number; tipo: string; principal: boolean; observaciones?: string | null }>;
  mediciones: Measure[];
  ingresos: Array<{ id: number; fechaHora: string; estado: string; motivo?: string | null }>;
  asignacionesEntrenamiento: Array<{ id: number; plan?: { nombre: string; objetivo?: string | null } | null; rutina?: { nombre: string; objetivo?: string | null } | null }>;
  sesionesEntrenamiento: Array<{ id: number; iniciadaEn: string; duracionMinutos?: number | null; cumplimiento?: string | number | null; comentario?: string | null; rutina?: { nombre: string } | null; ejercicios: Array<{ id: number; ejercicio: { nombre: string }; series: Array<{ id: number; peso?: string | number | null; repeticiones?: number | null }> }> }>;
  fotosProgreso: Array<{ id: number; fecha: string; tipo: string }>;
};

export default async function TrainerMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSocioEntrenadorDetalle(Number(id));
  if (!result.success || !result.data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><h1 className="font-black text-rose-900">No se puede abrir esta ficha</h1><p className="mt-1 text-sm text-rose-700">{result.error || "El socio no existe o no está asignado a tu cartera."}</p><Link href="/dashboard/entrenador" className="mt-4 inline-flex text-sm font-bold text-rose-900">Volver a mi panel</Link></div>;
  }

  const member = result.data as unknown as Member;
  const latest = member.mediciones[0];
  const assignment = member.asignacionesEntrenamiento[0];

  return (
    <div className="space-y-5">
      <Link href="/dashboard/entrenador" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-cyan-700"><ArrowLeft className="h-4 w-4" />Volver a mis socios</Link>

      <section className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cyan-600 text-xl font-black">{member.foto ? <img src={member.foto} alt="" className="h-full w-full object-cover" /> : `${member.nombre.charAt(0)}${member.apellido.charAt(0)}`}</div>
        <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Ficha deportiva privada</p><h1 className="text-2xl font-black">{member.nombre} {member.apellido}</h1><p className="text-sm text-slate-300">DNI {member.documento} · {member.sucursalHabitual?.nombre || "Sin sede habitual"}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={memberWorkspaceHref("training", member.id)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Planificar entrenamiento</Link><Link href={memberWorkspaceHref("progress", member.id)} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white">Registrar progreso</Link></div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary icon={Dumbbell} value={assignment?.plan?.nombre || assignment?.rutina?.nombre || "Sin plan"} label="Entrenamiento activo" /><Summary icon={Ruler} value={latest?.peso ? `${Number(latest.peso)} kg` : "Sin datos"} label={latest ? `Medido ${date(latest.fecha)}` : "Última medición"} /><Summary icon={CalendarCheck} value={String(member.ingresos.length)} label="Ingresos recientes" /><Summary icon={TrendingUp} value={String(member.sesionesEntrenamiento.length)} label="Sesiones completadas" /></div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-black">Contacto y cuidado</h2>
          <div className="mt-4 space-y-3 text-sm"><Row icon={Phone} label="Teléfono" value={member.telefono || "No registrado"} /><Row icon={Mail} label="Email" value={member.email || "No registrado"} /><Row icon={HeartPulse} label="Emergencia" value={member.contactoEmergencia || "No registrado"} /><Row icon={ShieldCheck} label="Privacidad" value="Visible sólo para equipo autorizado" /></div>
          <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-black">Objetivos activos</h3><Link href={memberWorkspaceHref("training", member.id)} className="text-xs font-bold text-cyan-700">Gestionar objetivos</Link></div>
          <div className="mt-2 space-y-2">{member.objetivos.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="font-bold">{item.principal ? "★ " : ""}{item.tipo}</p>{item.observaciones && <p className="text-xs text-slate-500">{item.observaciones}</p>}</div>)}{!member.objetivos.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Todavía no tiene objetivos cargados.</p>}</div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black">Evolución corporal</h2><Link href={memberWorkspaceHref("progress", member.id)} className="text-xs font-bold text-cyan-700">Abrir seguimiento</Link></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Peso" value={latest?.peso ? `${Number(latest.peso)} kg` : "—"} /><Metric label="IMC" value={latest?.imc ? Number(latest.imc).toFixed(1) : "—"} /><Metric label="Grasa" value={latest?.grasa ? `${Number(latest.grasa)}%` : "—"} /></div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{member.mediciones.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-bold">{date(item.fecha)}</p><p className="text-xs text-slate-500">{item.observaciones || "Sin observaciones"}</p></div><p className="text-sm font-black text-cyan-700">{item.peso ? `${Number(item.peso)} kg` : "—"}</p></div>)}{!member.mediciones.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay mediciones cargadas todavía.</p>}</div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Historial de entrenamiento</h2><div className="mt-4 space-y-3">{member.sesionesEntrenamiento.map((session) => <details key={session.id} className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer list-none"><div className="flex justify-between gap-3"><div><p className="font-bold">{session.rutina?.nombre || "Entrenamiento libre"}</p><p className="text-xs text-slate-500">{dateTime(session.iniciadaEn)} · {session.duracionMinutos || "—"} min</p></div><p className="text-sm font-black text-cyan-700">{session.cumplimiento ? `${Number(session.cumplimiento)}%` : "Completado"}</p></div></summary><div className="mt-3 space-y-1 border-t pt-3">{session.ejercicios.map((exercise) => <p key={exercise.id} className="text-xs text-slate-600"><b>{exercise.ejercicio.nombre}</b> · {exercise.series.length} series completadas</p>)}</div></details>)}{!member.sesionesEntrenamiento.length && <p className="text-sm text-slate-500">No hay sesiones completadas.</p>}</div></section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Asistencia</h2><div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{member.ingresos.map((entry) => <div key={entry.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">{dateTime(entry.fechaHora)}</p><span className={`text-xs font-black ${entry.estado === "permitido" ? "text-emerald-700" : "text-rose-700"}`}>{entry.estado}</span></div>)}{!member.ingresos.length && <p className="text-sm text-slate-500">Sin ingresos registrados.</p>}</div></section>
      </div>

      {member.fotosProgreso.length > 0 && <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-black">Fotos de progreso privadas</h2><Link href={memberWorkspaceHref("progress", member.id)} className="text-xs font-bold text-cyan-700">Gestionar progreso</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{member.fotosProgreso.map((photo) => <figure key={photo.id} className="overflow-hidden rounded-xl bg-slate-100"><img src={`/api/progreso/fotos/${photo.id}`} alt={`Progreso ${photo.tipo}`} className="aspect-[3/4] w-full object-cover" /><figcaption className="p-2 text-[10px] font-bold uppercase text-slate-500">{photo.tipo} · {date(photo.fecha)}</figcaption></figure>)}</div></section>}
    </div>
  );
}

function Summary({ icon: Icon, value, label }: { icon: typeof Dumbbell; value: string; label: string }) { return <div className="rounded-2xl border bg-white p-4"><Icon className="h-5 w-5 text-cyan-700" /><p className="mt-3 truncate text-lg font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-cyan-50 p-3 text-center"><p className="font-black text-cyan-900">{value}</p><p className="text-[10px] uppercase text-cyan-700">{label}</p></div>; }
function Row({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-cyan-700" /><div><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-medium">{value}</p></div></div>; }
function date(value: string) { return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
