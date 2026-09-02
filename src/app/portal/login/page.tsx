"use client";

import { useState } from "react";
import { loginCliente } from "@/app/actions/portalAuth";
import { useRouter } from "next/navigation";
import { User, Lock, QrCode, AlertCircle } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function PortalLoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await loginCliente(usuario, password);
    if (result.success) {
      router.push("/portal/dashboard");
    } else {
      setError(result.error || "Credenciales incorrectas");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 items-center justify-center text-white font-bold shadow-lg shadow-cyan-950/50">
          <QrCode className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Portal del Socio
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Accede a tu carnet QR digital, estado de cuenta y asistencias
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        <div className="bg-slate-900/90 backdrop-blur-md py-6 px-6 sm:px-8 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
          <form className="space-y-4" method="post" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 px-3 py-2 rounded-xl text-xs text-center font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                DNI o Usuario
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono font-bold"
                  placeholder="Tu número de documento"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                En tu primer ingreso usá la <strong className="text-cyan-400">contraseña temporal entregada por el gimnasio</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/40 transition active:scale-98 disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Ingresar a mi Cuenta"}
            </button>
          </form>
        </div>

        <PWAInstallPrompt variant="card" appName="OnlyGym Socio" />
      </div>
    </div>
  );
}
