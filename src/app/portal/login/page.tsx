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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="inline-flex h-10 w-10 rounded-xl bg-indigo-600 items-center justify-center text-white font-bold shadow-xs">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Portal del Socio
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Accede a tu carnet QR digital, estado de cuenta y asistencias
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        <div className="bg-slate-900 py-6 px-6 sm:px-8 rounded-xl border border-slate-800 shadow-xl space-y-4">
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 px-3 py-2 rounded-lg text-xs text-center font-medium flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                DNI o Usuario
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono font-medium"
                  placeholder="Tu número de documento"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Si es tu primer ingreso, tu clave por defecto es <strong>123456</strong>.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Ingresar a mi Cuenta"}
            </button>
          </form>
        </div>

        <PWAInstallPrompt variant="card" appName="GymLink Socio" />
      </div>
    </div>
  );
}
