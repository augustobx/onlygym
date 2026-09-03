"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Dumbbell, Lock, User } from "lucide-react";
import { getPortalData, loginCliente } from "@/app/actions/portalAuth";
import { getPublicTenantStatus } from "@/app/actions/tenant-public";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function PortalLoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      const tenant = await getPublicTenantStatus();
      if (tenant.status === "suspended") {
        router.replace("/suspendido");
        return;
      }
      if (tenant.scope === "platform") {
        router.replace("/superadmin/login");
        return;
      }

      const currentSession = await getPortalData();
      if (currentSession.success) {
        router.replace("/portal/dashboard");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const result = await loginCliente(usuario, password);
    if (result.success) {
      router.replace("/portal/dashboard");
      return;
    }
    if ("suspended" in result && result.suspended) {
      router.replace("/suspendido");
      return;
    }
    setError(result.error || "Usuario o contraseña incorrectos");
    setLoading(false);
  }

  if (checking) {
    return <main className="grid min-h-dvh place-items-center bg-[#080b10] text-sm font-bold text-slate-400">Preparando tu portal…</main>;
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-[#080b10] px-4 py-10 font-sans text-slate-100 selection:bg-lime-300 selection:text-slate-950">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="space-y-3 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-lime-300 text-slate-950 shadow-lg shadow-lime-950/20"><Dumbbell className="h-7 w-7" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">OnlyGym Socio</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white">Tu gimnasio en el teléfono</h1><p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">Membresía, entrenamientos, reservas, progreso, puntos y notificaciones en un solo lugar.</p></div>
        </header>

        <section className="rounded-3xl border border-white/8 bg-[#11151c] p-5 shadow-2xl">
          <form className="space-y-4" method="post" onSubmit={submit}>
            {error && <div className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-xs font-bold text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">DNI o usuario
              <span className="relative mt-1.5 block"><User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-lime-300" /><input name="username" type="text" required value={usuario} onChange={(event) => setUsuario(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-slate-950 pl-9 pr-3 text-sm font-bold text-white outline-none focus:border-lime-300" placeholder="Tu documento o usuario" autoComplete="username" autoFocus /></span>
            </label>

            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Contraseña
              <span className="relative mt-1.5 block"><Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-lime-300" /><input name="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-lime-300" placeholder="••••••••" autoComplete="current-password" /></span>
            </label>

            <p className="text-[10px] leading-relaxed text-slate-500">En el primer ingreso usá la contraseña temporal que te entregó el gimnasio. Después podés cambiarla desde tu perfil.</p>
            <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-lime-300 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-50">{loading ? "Ingresando…" : "Entrar a mi portal"}</button>
          </form>
        </section>

        <PWAInstallPrompt variant="card" appName="OnlyGym Socio" />
      </div>
    </main>
  );
}
