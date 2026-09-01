"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { getMisGimnasios, seleccionarGimnasioActivo } from "@/app/actions/auth-actions";

type Gym = { id: number; nombre: string; slug: string; plan: string; rol: string };

export default function SeleccionarGimnasioPage() {
  const router = useRouter();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [userName, setUserName] = useState("Usuario");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const select = useCallback(async (gym: Gym) => {
    setLoading(true);
    setError(null);
    const result = await seleccionarGimnasioActivo(gym.id);
    if (!result.success) {
      setError(result.error || "No pudimos seleccionar el gimnasio");
      setLoading(false);
      return;
    }
    localStorage.setItem("activeTenantId", String(gym.id));
    localStorage.setItem("activeTenantName", gym.nombre);
    localStorage.removeItem("activeSucursalId");
    localStorage.removeItem("activeSucursalName");
    router.replace("/seleccionar-sucursal");
  }, [router]);

  useEffect(() => {
    void getMisGimnasios().then(async (result) => {
      if (!result.success || !result.data) {
        router.replace("/login");
        return;
      }
      setGyms(result.data);
      setUserName(result.userName || "Usuario");
      if (result.data.length === 1) await select(result.data[0]);
      else setLoading(false);
    });
  }, [router, select]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-bold text-slate-400">Preparando tu acceso seguro…</div>;

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-white">
    <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-600"><ShieldCheck className="h-6 w-6" /></div>
      <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-cyan-400">Acceso multi-gimnasio</p>
      <h1 className="mt-1 text-2xl font-black">Hola, {userName}</h1>
      <p className="mt-2 text-sm text-slate-400">Elegí el gimnasio con el que querés trabajar. Esta selección se valida en el servidor.</p>
      {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-6 space-y-3">
        {gyms.map((gym) => <button key={gym.id} onClick={() => void select(gym)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-cyan-500">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400"><Building2 className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate font-black">{gym.nombre}</span><span className="text-xs text-slate-500">{gym.rol} · Plan {gym.plan}</span></span>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </button>)}
        {!gyms.length && <p className="rounded-2xl bg-red-950/40 p-4 text-sm text-red-200">No tenés acceso a ningún gimnasio activo.</p>}
      </div>
      <button onClick={async () => { await signOut(); router.replace("/login"); }} className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-300"><LogOut className="h-4 w-4" />Cerrar sesión</button>
    </section>
  </main>;
}
