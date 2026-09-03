"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { cambiarPasswordPortalConActual, cerrarOtrasSesionesPortal } from "@/app/actions/portal-settings";

export default function PortalSecurityControl() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setMessage("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    const result = await cambiarPasswordPortalConActual(currentPassword, nextPassword);
    setMessage(result.success ? result.mensaje || "Contraseña actualizada" : result.error || "No se pudo actualizar");
    if (result.success) {
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    }
    setBusy(false);
  }

  async function closeOtherSessions() {
    setBusy(true);
    const result = await cerrarOtrasSesionesPortal();
    setMessage(result.success ? `${result.cantidad} sesiones cerradas` : result.error || "No se pudieron cerrar");
    setBusy(false);
  }

  return (
    <section className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Seguridad de tu cuenta</h2></div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">Podés cambiar tu contraseña y cerrar sesiones abiertas en otros dispositivos.</p>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required placeholder="Contraseña actual" className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" />
        <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required placeholder="Nueva contraseña" className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" />
        <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required placeholder="Repetir nueva contraseña" className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" />
        <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 text-xs font-black text-slate-950 disabled:opacity-50">
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Cambiar contraseña
        </button>
      </form>

      <button onClick={() => void closeOtherSessions()} disabled={busy} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-black text-slate-300 disabled:opacity-50">
        <LogOut className="h-4 w-4" /> Cerrar otras sesiones
      </button>
      {message && <button type="button" onClick={() => setMessage(null)} className="mt-3 w-full rounded-2xl bg-white/5 p-3 text-left text-xs font-semibold text-slate-300">{message}</button>}
    </section>
  );
}
