"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/tenant-auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } finally {
      // Siempre devolvemos el mismo resultado para no revelar cuentas registradas.
      setSent(true);
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
    <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-600"><ShieldCheck className="h-6 w-6" /></div>
      <h1 className="mt-5 text-2xl font-black">Recuperar acceso</h1>
      {sent ? <div className="mt-5 space-y-4"><p className="rounded-2xl bg-emerald-950/50 p-4 text-sm text-emerald-200">Si el correo está registrado para este gimnasio, vas a recibir un enlace válido durante una hora.</p><Link href="/login" className="block text-center text-sm font-bold text-cyan-400">Volver al ingreso</Link></div> : <form onSubmit={submit} className="mt-5 space-y-4">
        <p className="text-sm text-slate-400">Ingresá el correo asociado a tu usuario administrativo de este gimnasio.</p>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Correo<div className="mt-2 flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3"><Mail className="h-4 w-4 text-cyan-400" /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 flex-1 bg-transparent px-3 text-sm outline-none" autoComplete="email" /></div></label>
        <button disabled={loading} className="h-12 w-full rounded-xl bg-cyan-600 text-sm font-black disabled:opacity-50">{loading ? "Enviando…" : "Enviar enlace seguro"}</button>
        <Link href="/login" className="block text-center text-sm font-bold text-slate-400">Volver</Link>
      </form>}
    </section>
  </main>;
}
