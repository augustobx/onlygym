"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { actualizarAdminTenantSuperAdmin } from "@/app/actions/superadmin-admins";

type TenantAdminMembership = {
  id: number;
  rol: string;
  estado: string;
  user: {
    id: string;
    name: string;
    email: string;
    nivel: string;
  };
};

export default function TenantAdminCredentials({
  tenantId,
  usuarios,
}: {
  tenantId: number;
  usuarios: TenantAdminMembership[];
}) {
  const router = useRouter();
  const admins = useMemo(
    () => usuarios.filter((membership) => membership.rol === "OWNER" || membership.rol === "ADMIN"),
    [usuarios]
  );

  if (admins.length === 0) {
    return (
      <section className="p-6 rounded-3xl bg-[#121824] border border-white/8">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" /> Administradores del gimnasio
        </h2>
        <p className="text-xs text-slate-500 mt-3">Este tenant no tiene un OWNER o ADMIN asociado.</p>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-3xl bg-[#121824] border border-white/8 space-y-5">
      <div>
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" /> Administradores del gimnasio
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Control total de identidad y acceso. Cambiar correo o clave cierra las sesiones activas del administrador.
        </p>
      </div>

      <div className="space-y-4">
        {admins.map((membership) => (
          <AdminEditor key={membership.id} tenantId={tenantId} membership={membership} onSaved={() => router.refresh()} />
        ))}
      </div>
    </section>
  );
}

function AdminEditor({
  tenantId,
  membership,
  onSaved,
}: {
  tenantId: number;
  membership: TenantAdminMembership;
  onSaved: () => void;
}) {
  const [name, setName] = useState(membership.user.name);
  const [email, setEmail] = useState(membership.user.email);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await actualizarAdminTenantSuperAdmin({
      tenantId,
      userId: membership.user.id,
      name,
      email,
      password,
    });

    if (result.success) {
      setPassword("");
      setMessage({ type: "success", text: "Credenciales actualizadas. Las sesiones anteriores fueron cerradas." });
      onSaved();
    } else {
      setMessage({ type: "error", text: result.error || "No se pudieron guardar los cambios" });
    }

    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="p-4 rounded-2xl bg-slate-950/60 border border-white/6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{membership.user.name}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-cyan-400">{membership.rol}</p>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-500">{membership.estado}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <UserRound className="w-3 h-3" /> Nombre
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-11 rounded-xl bg-slate-950 border border-white/10 px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Correo de acceso
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 rounded-xl bg-slate-950 border border-white/10 px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <KeyRound className="w-3 h-3" /> Nueva contraseña
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder="Dejar vacío para conservar la actual"
          className="w-full h-11 rounded-xl bg-slate-950 border border-white/10 px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
        />
      </label>

      {message && (
        <div className={`text-xs font-bold rounded-xl px-3 py-2 ${message.type === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar credenciales
        </button>
      </div>
    </form>
  );
}
