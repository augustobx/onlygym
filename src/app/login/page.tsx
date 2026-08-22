"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ShieldCheck } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }

      router.push("/seleccionar-sucursal");
    } catch (err) {
      setError("Error de conexión con el servidor");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="inline-flex h-10 w-10 rounded-xl bg-indigo-600 items-center justify-center text-white font-bold shadow-xs">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            GymLink Enterprise
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Acceso Administrativo & Personal de Sede
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        <div className="bg-slate-900 py-6 px-6 sm:px-8 rounded-xl border border-slate-800 shadow-xl space-y-4">
          <form className="space-y-3.5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 px-3 py-2 rounded-lg text-xs text-center font-medium">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Usuario del Sistema
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                  placeholder="admin"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Ingresar al Panel"}
            </button>
          </form>
        </div>

        <PWAInstallPrompt variant="card" appName="GymLink Admin" />
      </div>
    </div>
  );
}
