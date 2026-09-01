"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { loginSuperAdmin } from "@/app/actions/superadmin";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await loginSuperAdmin(formData);

    if (result.success) {
      router.replace("/superadmin");
    } else {
      setError(result.error || "Error al iniciar sesión");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-cyan-500 selection:text-black">
      {/* Background glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 shadow-xl shadow-cyan-500/20 mb-4 ring-8 ring-white/5">
            <Shield className="w-8 h-8 text-black stroke-[2.5]" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">NanoLabs Platform</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Control Plane</h1>
          <p className="text-xs text-slate-400 mt-2">Acceso exclusivo para SuperAdministradores de OnlyGym</p>
        </div>

        <div className="bg-[#121824]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/60">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="superadmin@nanolabs.ar"
                  className="w-full h-12 bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full h-12 bg-slate-950/70 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  Ingresar al Plano de Control <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Infraestructura dedicada NanoLabs · v4</span>
          </div>
        </div>
      </div>
    </main>
  );
}
