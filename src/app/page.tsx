"use client";

import { useState } from "react";
import { loginCliente } from "@/app/actions/portalAuth";
import { useRouter } from "next/navigation";
import { 
  Dumbbell, 
  User, 
  Lock, 
  QrCode, 
  AlertCircle,
  Sparkles
} from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function Home() {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white px-4 sm:px-6 py-6 sm:py-8">
      
      {/* Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">GymLink Socio</h1>
            <span className="text-[10px] text-slate-400 font-medium">Carnet & Acceso Digital</span>
          </div>
        </div>
        <PWAInstallPrompt variant="button" appName="GymLink Socio" />
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto w-full my-auto py-6 space-y-5">
        
        <div className="text-center space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Portal del Socio
          </h2>
          <p className="text-xs text-slate-400">
            Ingresa tu DNI para ver tu carnet QR de acceso y cuotas.
          </p>
        </div>

        {/* Tarjeta Login */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 text-rose-200 rounded-lg text-xs text-center font-medium flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Número de Documento (DNI)
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
                  placeholder="Tu número de DNI"
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
              <p className="text-[10px] text-slate-500 mt-1">
                Primer ingreso: tu contraseña por defecto es <strong>123456</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>{loading ? "Verificando..." : "Ingresar a mi Carnet Digital"}</span>
            </button>
          </form>
        </div>

        <PWAInstallPrompt variant="card" appName="GymLink Socio" />
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center text-[11px] text-slate-500 pt-3 border-t border-slate-800/60">
        <p>© GymLink Socio App · Tu portal de entrenamiento</p>
      </footer>
    </div>
  );
}
