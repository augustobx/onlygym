"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tenant-auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Correo o contraseña incorrectos");
        setLoading(false);
        return;
      }

      router.push("/seleccionar-gimnasio");
    } catch {
      setError("Error de conexión con el servidor");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 items-center justify-center text-white font-bold shadow-lg shadow-cyan-950/50">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">OnlyGym</h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">Acceso Administrativo & Personal de Sede</p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        <div className="bg-slate-900/90 backdrop-blur-md py-6 px-6 sm:px-8 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
          <form className="space-y-4" method="post" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 px-3 py-2 rounded-lg text-xs text-center font-bold">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Correo de acceso
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  placeholder="admin@tugimnasio.com"
                  autoFocus
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/40 transition active:scale-98 disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Ingresar al Panel"}
            </button>
            <Link href="/recuperar-password" className="block text-center text-xs font-bold text-cyan-400 hover:text-cyan-300">
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </div>

        <PWAInstallPrompt variant="card" appName="OnlyGym Admin" />
      </div>
    </div>
  );
}
