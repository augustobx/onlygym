"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10) return setMessage("La contraseña debe tener al menos 10 caracteres.");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setLoading(true);
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) });
    setLoading(false);
    if (!response.ok) return setMessage("El enlace es inválido o venció. Solicitá uno nuevo.");
    setDone(true);
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white"><section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-600"><KeyRound className="h-6 w-6" /></div>
    <h1 className="mt-5 text-2xl font-black">Nueva contraseña</h1>
    {done ? <div className="mt-5 space-y-4"><p className="rounded-2xl bg-emerald-950/50 p-4 text-sm text-emerald-200">La contraseña fue actualizada y las sesiones anteriores quedaron cerradas.</p><Link href="/login" className="block text-center font-bold text-cyan-400">Ingresar</Link></div> : !token ? <div className="mt-5 space-y-4"><p className="rounded-2xl bg-red-950/50 p-4 text-sm text-red-200">El enlace no contiene un token válido.</p><Link href="/recuperar-password" className="block text-center font-bold text-cyan-400">Solicitar otro enlace</Link></div> : <form onSubmit={submit} className="mt-5 space-y-4">
      {message && <p className="rounded-xl bg-red-950/50 p-3 text-sm text-red-200">{message}</p>}
      <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} />
      <PasswordField label="Repetir contraseña" value={confirmation} onChange={setConfirmation} />
      <button disabled={loading} className="h-12 w-full rounded-xl bg-cyan-600 text-sm font-black disabled:opacity-50">{loading ? "Actualizando…" : "Actualizar contraseña"}</button>
    </form>}
  </section></main>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">{label}<input type="password" required minLength={10} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-500" autoComplete="new-password" /></label>;
}
