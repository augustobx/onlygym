"use client";
/* eslint-disable @next/next/no-img-element -- las fotos privadas requieren cookies y no deben pasar por el optimizador público */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Camera, Dumbbell, ImageIcon, Ruler, Search, TrendingUp, Upload } from "lucide-react";
import { getProgresoSocio, registrarMedicion } from "@/app/actions/gestion-fitness";
import { getSociosParaProgreso } from "@/app/actions/progreso-workspace";
import { memberWorkspaceHref, parseMemberWorkspaceId } from "@/lib/member-workspace";

type Measurement = {
  id: number;
  fecha: string;
  peso?: string | number | null;
  altura?: string | number | null;
  imc?: string | number | null;
  grasa?: string | number | null;
  masaMuscular?: string | number | null;
  cintura?: string | number | null;
  pecho?: string | number | null;
  brazoIzquierdo?: string | number | null;
  brazoDerecho?: string | number | null;
  piernaIzquierda?: string | number | null;
  piernaDerecha?: string | number | null;
  cadera?: string | number | null;
  observaciones?: string | null;
};
type Photo = { id: number; fecha: string; tipo: string; mimeType: string };
type Member = { id: number; nombre: string; apellido: string; documento: string; mediciones: Measurement[] };
type Progress = {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  entrenador?: { user: { name: string } } | null;
  mediciones: Measurement[];
  fotosProgreso: Photo[];
};

const fields = [
  ["peso", "Peso", "kg"],
  ["altura", "Altura", "cm"],
  ["grasa", "Grasa", "%"],
  ["masaMuscular", "Masa muscular", "%"],
  ["cintura", "Cintura", "cm"],
  ["pecho", "Pecho", "cm"],
  ["cadera", "Cadera", "cm"],
  ["brazoIzquierdo", "Brazo izquierdo", "cm"],
  ["brazoDerecho", "Brazo derecho", "cm"],
  ["piernaIzquierda", "Pierna izquierda", "cm"],
  ["piernaDerecha", "Pierna derecha", "cm"],
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function Trend({ title, values, color = "bg-cyan-500" }: { title: string; values: Array<{ fecha: string; value: number }>; color?: string }) {
  const recent = [...values].reverse().slice(-10);
  if (!recent.length) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="font-black">{title}</p>
        <p className="mt-5 text-sm text-slate-400">Sin datos todavía</p>
      </div>
    );
  }

  const min = Math.min(...recent.map((item) => item.value));
  const max = Math.max(...recent.map((item) => item.value));
  const range = Math.max(max - min, max * 0.08, 1);

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex justify-between gap-3">
        <p className="font-black">{title}</p>
        <p className="text-sm font-black text-cyan-700">{recent[0].value} → {recent.at(-1)?.value}</p>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {recent.map((item, index) => (
          <div key={`${item.fecha}-${index}`} className="flex h-full flex-1 items-end" title={`${date(item.fecha)}: ${item.value}`}>
            <div className={`w-full rounded-t-md ${color}`} style={{ height: `${Math.max(12, 15 + ((item.value - min) / range) * 85)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MeasurementsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const loadMembers = async (search = "") => {
    const result = await getSociosParaProgreso(search);
    if (result.success) {
      setMembers(result.data as unknown as Member[]);
    } else {
      setMembers([]);
      setMessage(result.error || "No se pudieron cargar los socios habilitados para seguimiento");
    }
  };

  const loadProgress = async (id: number) => {
    setLoadingProgress(true);
    const result = await getProgresoSocio(id);
    if (result.success) {
      setProgress(result.data as unknown as Progress);
      setSelectedId(id);
    } else {
      setProgress(null);
      setSelectedId(null);
      setMessage(result.error || "No se pudo cargar el progreso");
    }
    setLoadingProgress(false);
  };

  const selectMember = async (id: number) => {
    window.history.replaceState(null, "", memberWorkspaceHref("progress", id));
    await loadProgress(id);
  };

  useEffect(() => {
    const initialMemberId = parseMemberWorkspaceId(new URLSearchParams(window.location.search).get("cliente"));
    void (async () => {
      await loadMembers();
      if (initialMemberId) await loadProgress(initialMemberId);
    })();
  }, []);

  const latest = progress?.mediciones[0];
  const trends = useMemo(
    () =>
      progress
        ? {
            peso: progress.mediciones.filter((item) => item.peso != null).map((item) => ({ fecha: item.fecha, value: Number(item.peso) })),
            grasa: progress.mediciones.filter((item) => item.grasa != null).map((item) => ({ fecha: item.fecha, value: Number(item.grasa) })),
            musculo: progress.mediciones.filter((item) => item.masaMuscular != null).map((item) => ({ fecha: item.fecha, value: Number(item.masaMuscular) })),
          }
        : { peso: [], grasa: [], musculo: [] },
    [progress],
  );

  const submitMeasurement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!progress) return;
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const number = (name: string) => (form.get(name) ? Number(form.get(name)) : undefined);
    const result = await registrarMedicion({
      clienteId: progress.id,
      fecha: String(form.get("fecha")),
      ...Object.fromEntries(fields.map(([name]) => [name, number(name)])),
      observaciones: String(form.get("observaciones") || ""),
    });
    setMessage(result.success ? "Medición registrada y socio notificado" : result.error || "No se pudo guardar");
    if (result.success) {
      formElement.reset();
      await Promise.all([loadProgress(progress.id), loadMembers(query)]);
    }
    setSaving(false);
  };

  const submitPhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!progress) return;
    setUploading(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("clienteId", String(progress.id));
    const response = await fetch("/api/progreso/fotos", { method: "POST", body: form });
    const result = await response.json();
    setMessage(result.success ? "Foto privada guardada" : result.error || "No se pudo guardar la foto");
    if (result.success) {
      formElement.reset();
      await loadProgress(progress.id);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Seguimiento privado</p>
          <h1 className="mt-1 text-2xl font-black">Progreso del socio</h1>
          <p className="mt-1 text-sm text-slate-500">Mediciones, evolución y fotos privadas dentro del mismo circuito de entrenamiento.</p>
        </div>
        {progress && (
          <Link href={memberWorkspaceHref("training", progress.id)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Dumbbell className="h-4 w-4" /> Planificar entrenamiento
          </Link>
        )}
      </header>

      {message && (
        <button onClick={() => setMessage(null)} className="w-full rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-left text-sm font-bold text-cyan-800">
          {message}
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadMembers(query);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"
          >
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido o DNI" className="h-11 flex-1 outline-none" />
          </form>
          <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => void selectMember(member.id)}
                className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition ${selectedId === member.id ? "bg-cyan-50 ring-1 ring-cyan-200" : "bg-slate-50 hover:bg-slate-100"}`}
              >
                <div>
                  <p className="font-bold">{member.nombre} {member.apellido}</p>
                  <p className="text-xs text-slate-500">DNI {member.documento}</p>
                </div>
                <p className="text-xs font-black text-slate-600">{member.mediciones[0]?.peso ? `${Number(member.mediciones[0].peso)} kg` : "Sin datos"}</p>
              </button>
            ))}
            {!members.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">No hay socios para mostrar con este criterio.</p>}
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          {loadingProgress ? (
            <div className="grid min-h-96 place-items-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">Cargando seguimiento…</div>
          ) : progress ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-cyan-700">DNI {progress.documento}</p>
                    <h2 className="text-xl font-black">{progress.nombre} {progress.apellido}</h2>
                    <p className="text-sm text-slate-500">Entrenador: {progress.entrenador?.user.name || "Sin asignar"}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black">{latest?.peso ? `${Number(latest.peso)} kg` : "Sin peso"}</span>
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black">IMC {latest?.imc ? Number(latest.imc).toFixed(1) : "—"}</span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Trend title="Peso (kg)" values={trends.peso} />
                  <Trend title="Grasa (%)" values={trends.grasa} color="bg-orange-400" />
                  <Trend title="Masa muscular (%)" values={trends.musculo} color="bg-lime-500" />
                </div>
              </div>

              <details open className="rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-cyan-700"><Ruler className="h-5 w-5" /></span>
                    <div>
                      <h2 className="font-black">Registrar nueva medición</h2>
                      <p className="text-xs text-slate-500">Podés completar sólo los valores medidos hoy. El IMC se calcula automáticamente.</p>
                    </div>
                  </div>
                </summary>
                <form onSubmit={submitMeasurement} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-bold text-slate-600">Fecha<input name="fecha" type="date" defaultValue={today()} required className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" /></label>
                  {fields.map(([name, label, unit]) => (
                    <label key={name} className="text-xs font-bold text-slate-600">
                      {label} ({unit})
                      <input name={name} type="number" min="0" step="0.01" defaultValue={latest?.[name] == null ? "" : Number(latest[name])} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
                    </label>
                  ))}
                  <label className="text-xs font-bold text-slate-600 sm:col-span-2 xl:col-span-3">Observaciones<textarea name="observaciones" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
                  <button disabled={saving} className="h-11 rounded-xl bg-slate-950 text-sm font-bold text-white sm:col-span-2 xl:col-span-3 disabled:opacity-50">{saving ? "Guardando…" : "Guardar medición"}</button>
                </form>
              </details>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-700" /><h2 className="font-black">Historial de mediciones</h2></div>
                  {progress.mediciones.length ? (
                    <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">
                      {progress.mediciones.map((item) => (
                        <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex justify-between"><p className="font-black">{date(item.fecha)}</p><p className="font-black text-cyan-700">{item.peso ? `${Number(item.peso)} kg` : "—"}</p></div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {fields.slice(2).map(([name, label, unit]) => item[name] != null && <span key={name} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600">{label}: {Number(item[name])} {unit}</span>)}
                            {item.imc != null && <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600">IMC: {Number(item.imc).toFixed(1)}</span>}
                          </div>
                          {item.observaciones && <p className="mt-3 text-xs text-slate-500">{item.observaciones}</p>}
                        </article>
                      ))}
                    </div>
                  ) : <p className="mt-5 text-sm text-slate-500">Todavía no hay mediciones. Cargá la primera para iniciar el seguimiento.</p>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-cyan-700" /><h2 className="font-black">Fotos de progreso</h2></div>
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG o WEBP · máximo 8 MB · acceso privado.</p>
                  <form onSubmit={submitPhoto} className="mt-4 grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input name="fecha" type="date" defaultValue={today()} required className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                      <select name="tipo" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="frente">Frente</option><option value="perfil">Perfil</option><option value="espalda">Espalda</option></select>
                    </div>
                    <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm font-bold text-slate-600">
                      <Upload className="mb-2 h-5 w-5" />Elegir imagen
                      <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only" />
                    </label>
                    <button disabled={uploading} className="h-11 rounded-xl bg-cyan-700 text-sm font-bold text-white disabled:opacity-50">{uploading ? "Subiendo…" : "Guardar foto privada"}</button>
                  </form>
                  {progress.fotosProgreso.length ? (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {progress.fotosProgreso.map((photo) => (
                        <figure key={photo.id} className="overflow-hidden rounded-xl bg-slate-100">
                          <img src={`/api/progreso/fotos/${photo.id}`} alt={`Progreso ${photo.tipo}`} className="aspect-[3/4] w-full object-cover" />
                          <figcaption className="p-2 text-[10px] font-bold uppercase text-slate-500">{photo.tipo} · {date(photo.fecha)}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center"><ImageIcon className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-xs text-slate-500">Sin fotos registradas</p></div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="grid min-h-96 place-items-center rounded-2xl border border-slate-200 bg-white text-center">
              <div><TrendingUp className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-black">Seleccioná un socio</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Elegí una persona de la lista para ver su evolución, registrar una medición o cargar fotos privadas.</p></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
