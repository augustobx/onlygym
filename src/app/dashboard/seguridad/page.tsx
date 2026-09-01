"use client";

import { useEffect, useState } from "react";
import { Clock3, History, Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import { getSeguridadAdmin, revocarSesionEmpleado, revocarTodasLasSesionesEmpleado } from "@/app/actions/seguridad";
import { useRouter } from "next/navigation";

type SecurityData = {
  currentUserId: string;
  memberships: Array<{ id: number; rol: string; estado: string; user: { id: string; name: string; email: string; username?: string | null; estado: string; sessions: Array<{ id: string; createdAt: string; updatedAt: string; expiresAt: string; ipAddress?: string | null; userAgent?: string | null }> } }>;
  audits: Array<{ id: number; accion: string; entidad?: string | null; entidadId?: string | null; resultado: string; actorUserId?: string | null; creadaEn: string }>;
};

export default function SeguridadPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = async () => { const result = await getSeguridadAdmin(); if (result.success) setData(result.data as unknown as SecurityData); else setMessage(result.error || "No autorizado"); };
  useEffect(() => { void getSeguridadAdmin().then((result) => { if (result.success) setData(result.data as unknown as SecurityData); else setMessage(result.error || "No autorizado"); }); }, []);

  async function revoke(sessionId: string) {
    const result = await revocarSesionEmpleado(sessionId);
    setMessage(result.success ? "Sesión cerrada" : result.error || "No se pudo cerrar");
    await load();
  }
  async function revokeAll(userId: string) {
    const result = await revocarTodasLasSesionesEmpleado(userId);
    setMessage(result.success ? `${result.cantidad} sesiones cerradas` : result.error || "No se pudo cerrar");
    if (userId === data?.currentUserId && result.success) router.replace("/login");
    else await load();
  }

  if (!data) return <p className="p-6 text-sm text-slate-500">{message || "Cargando seguridad…"}</p>;
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <div><p className="text-xs font-black uppercase tracking-widest text-cyan-700">Seguridad</p><h1 className="text-2xl font-black">Sesiones y auditoría</h1><p className="text-sm text-slate-500">Controlá dispositivos activos y revisá acciones sensibles del gimnasio.</p></div>
    {message && <button onClick={() => setMessage(null)} className="rounded-xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">{message}</button>}
    <section className="space-y-3"><h2 className="flex items-center gap-2 font-black"><Laptop className="h-5 w-5 text-cyan-600" />Sesiones del personal</h2>{data.memberships.map(({ user, rol }) => <article key={user.id} className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{user.name} <span className="text-xs text-slate-400">{user.id === data.currentUserId ? "(vos)" : ""}</span></p><p className="text-xs text-slate-500">{user.email} · {rol} · {user.sessions.length} sesiones</p></div><button onClick={() => void revokeAll(user.id)} disabled={!user.sessions.length} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40"><RefreshCw className="h-4 w-4" />Cerrar todas</button></div>
      <div className="mt-3 space-y-2">{user.sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-bold">{session.userAgent?.slice(0, 90) || "Dispositivo desconocido"}</p><p className="mt-1 text-[11px] text-slate-500">IP {session.ipAddress || "no disponible"} · vence {new Date(session.expiresAt).toLocaleString("es-AR")}</p></div><button onClick={() => void revoke(session.id)} className="text-xs font-black text-red-600">Cerrar</button></div>)}</div>
    </article>)}</section>
    <section className="rounded-2xl border bg-white"><div className="flex items-center gap-2 border-b p-4"><History className="h-5 w-5 text-cyan-600" /><h2 className="font-black">Actividad sensible reciente</h2></div><div className="divide-y">{data.audits.map((audit) => <div key={audit.id} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-bold">{audit.accion}</p><p className="text-xs text-slate-500">{audit.entidad || "Sistema"}{audit.entidadId ? ` · ${audit.entidadId}` : ""} · {audit.resultado}</p></div><p className="flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" />{new Date(audit.creadaEn).toLocaleString("es-AR")}</p></div>)}</div></section>
    <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Los tokens y contraseñas nunca se muestran en este registro.</div>
  </div>;
}
