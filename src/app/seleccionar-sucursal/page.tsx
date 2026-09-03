"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LogOut, MapPin } from "lucide-react";
import { getMisSucursales, seleccionarSucursalActiva } from "@/app/actions/auth-actions";
import { signOut } from "@/lib/auth-client";

type Branch = { id: number; nombre: string; direccion?: string | null };

export default function SeleccionarSucursalPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [tenantName, setTenantName] = useState("OnlyGym");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getMisSucursales();
      if (!result.success || !result.data) {
        setError(result.error || "No se pudieron cargar las sedes");
        setLoading(false);
        return;
      }

      const available = result.data as unknown as Branch[];
      setBranches(available);
      setUserName(result.userName || "Usuario");
      setTenantName(result.tenantName || "OnlyGym");

      if (available.length === 1) {
        setSelectingId(available[0].id);
        const selection = await seleccionarSucursalActiva(available[0].id);
        if (selection.success) {
          router.replace("/dashboard");
          return;
        }
        setError(selection.error || "No se pudo activar la sede");
        setSelectingId(null);
      }
      setLoading(false);
    })();
  }, [router]);

  async function selectBranch(branch: Branch) {
    setSelectingId(branch.id);
    setError(null);
    const result = await seleccionarSucursalActiva(branch.id);
    if (!result.success) {
      setError(result.error || "No se pudo activar la sede");
      setSelectingId(null);
      return;
    }
    router.replace("/dashboard");
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-b-cyan-500" /><p className="text-xs font-semibold text-slate-400">Verificando sedes asignadas…</p></div>;
  }

  return <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4 py-12 font-sans text-slate-100">
    <div className="mx-auto w-full max-w-md space-y-5">
      <header className="space-y-3 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-950/50"><Building2 className="h-6 w-6" /></div>
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">{tenantName}</p><h1 className="mt-1 text-2xl font-black text-white">Hola, {userName}</h1><p className="mt-1 text-xs font-medium text-slate-400">Elegí la sede donde vas a trabajar. La selección queda validada y guardada en el servidor.</p></div>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs font-bold text-rose-200">{error}</div>}
        {branches.length === 0 ? <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-center text-xs font-bold text-amber-100">No tenés ninguna sede activa asignada. Pedile a un administrador que revise tu acceso.</div> : <div className="space-y-2">{branches.map((branch) => <button key={branch.id} onClick={() => void selectBranch(branch)} disabled={selectingId !== null} className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-left transition hover:border-cyan-500/50 hover:bg-slate-900 disabled:opacity-60"><span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-slate-400 group-hover:bg-cyan-600 group-hover:text-white"><MapPin className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate text-xs text-white">{branch.nombre}</strong><small className="mt-0.5 block truncate text-[10px] text-slate-500">{branch.direccion || "Sede habilitada"}</small></span></span><span className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-cyan-400">{selectingId === branch.id ? "Ingresando…" : "Ingresar"}<ChevronRight className="h-3.5 w-3.5" /></span></button>)}</div>}
        <div className="border-t border-slate-800 pt-3 text-center"><button onClick={() => void logout()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400"><LogOut className="h-3.5 w-3.5" />Cerrar sesión</button></div>
      </section>
    </div>
  </div>;
}
