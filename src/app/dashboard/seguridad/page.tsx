"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, History, Laptop, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSeguridadAdmin, revocarSesionEmpleado, revocarTodasLasSesionesEmpleado } from "@/app/actions/seguridad";

type SessionItem = { id: string; createdAt: string; updatedAt: string; expiresAt: string; ipAddress?: string | null; userAgent?: string | null };
type StaffSecurity = {
  id: number;
  rol: string;
  estado: string;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    estado: string;
    sharedIdentity: boolean;
    sessions: SessionItem[];
  };
};
type AuditItem = { id: number; accion: string; entidad?: string | null; entidadId?: string | null; resultado: string; actorUserId?: string | null; creadaEn: string };
type SecurityData = {
  currentUserId: string;
  memberships: StaffSecurity[];
  audits: AuditItem[];
  summary: { staff: number; activeStaff: number; visibleSessions: number; sharedIdentities: number };
};

export default function SeguridadPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const result = await getSeguridadAdmin();
    if (result.success && result.data) {
      setData(result.data as unknown as SecurityData);
      setMessage(null);
    } else setMessage(result.error || "No autorizado");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function revoke(sessionId: string) {
    const result = await revocarSesionEmpleado(sessionId);
    setMessage(result.success ? "Sesión cerrada" : result.error || "No se pudo cerrar la sesión");
    await load();
  }

  async function revokeAll(userId: string) {
    const result = await revocarTodasLasSesionesEmpleado(userId);
    setMessage(result.success ? `${result.cantidad} sesiones cerradas` : result.error || "No se pudieron cerrar las sesiones");
    if (userId === data?.currentUserId && result.success) {
      router.replace("/login");
      return;
    }
    await load();
  }

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-slate-500">Cargando seguridad…</div>;
  if (!data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{message || "No autorizado"}</div>;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Gestión</p><h1 className="mt-1 text-2xl font-black text-slate-950">Seguridad y auditoría</h1><p className="mt-1 text-sm text-slate-500">Sesiones activas, identidades compartidas y acciones sensibles del tenant.</p></header>

    {message && <button onClick={() => setMessage(null)} className="w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-left text-sm font-bold text-cyan-950">{message}</button>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <article className="rounded-xl border bg-white p-4"><Users className="h-4 w-4 text-cyan-600" /><strong className="mt-2 block text-2xl">{data.summary.activeStaff}</strong><span className="text-xs text-slate-500">staff activo / {data.summary.staff} total</span></article>
      <article className="rounded-xl border bg-white p-4"><Laptop className="h-4 w-4 text-cyan-600" /><strong className="mt-2 block text-2xl">{data.summary.visibleSessions}</strong><span className="text-xs text-slate-500">sesiones administrables</span></article>
      <article className="rounded-xl border bg-white p-4"><ShieldCheck className="h-4 w-4 text-cyan-600" /><strong className="mt-2 block text-2xl">{data.audits.length}</strong><span className="text-xs text-slate-500">eventos recientes visibles</span></article>
      <article className="rounded-xl border bg-white p-4"><AlertTriangle className="h-4 w-4 text-amber-600" /><strong className="mt-2 block text-2xl">{data.summary.sharedIdentities}</strong><span className="text-xs text-slate-500">identidades multi-tenant</span></article>
    </section>

    <section className="space-y-3">
      <div><h2 className="flex items-center gap-2 font-black"><Laptop className="h-5 w-5 text-cyan-600" />Sesiones del personal</h2><p className="text-xs text-slate-500">Las sesiones de identidades usadas en más de un tenant no se pueden cerrar desde un gimnasio individual.</p></div>
      {data.memberships.map(({ user, rol, estado }) => <article key={user.id} className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-black text-slate-950">{user.name} <span className="text-xs text-slate-400">{user.id === data.currentUserId ? "(vos)" : ""}</span></p><p className="text-xs text-slate-500">{user.email} · {rol} · {estado}</p>{user.sharedIdentity && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Identidad compartida: sesiones administrables sólo desde SuperAdmin.</p>}</div>
          <button onClick={() => void revokeAll(user.id)} disabled={user.sharedIdentity || !user.sessions.length} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className="h-4 w-4" />Cerrar todas</button>
        </div>
        {!user.sharedIdentity && <div className="mt-3 space-y-2">{user.sessions.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Sin sesiones activas.</p> : user.sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-bold text-slate-800">{session.userAgent?.slice(0, 90) || "Dispositivo desconocido"}</p><p className="mt-1 text-[11px] text-slate-500">IP {session.ipAddress || "no disponible"} · vence {new Date(session.expiresAt).toLocaleString("es-AR")}</p></div><button onClick={() => void revoke(session.id)} className="text-xs font-black text-red-600">Cerrar</button></div>)}</div>}
      </article>)}
    </section>

    <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center gap-2 border-b p-4"><History className="h-5 w-5 text-cyan-600" /><div><h2 className="font-black">Actividad sensible reciente</h2><p className="text-xs text-slate-500">Últimos 100 eventos registrados para este tenant.</p></div></div><div className="divide-y">{data.audits.length === 0 ? <p className="p-6 text-sm text-slate-500">Todavía no hay eventos auditados.</p> : data.audits.map((audit) => <div key={audit.id} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-bold text-slate-900">{audit.accion}</p><p className="text-xs text-slate-500">{audit.entidad || "Sistema"}{audit.entidadId ? ` · ${audit.entidadId}` : ""} · <span className={audit.resultado === "rechazado" ? "font-bold text-rose-600" : ""}>{audit.resultado}</span>{audit.actorUserId ? ` · actor ${audit.actorUserId}` : ""}</p></div><p className="flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" />{new Date(audit.creadaEn).toLocaleString("es-AR")}</p></div>)}</div></section>

    <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Los tokens, hashes y contraseñas nunca se muestran en este panel.</div>
  </div>;
}
