import Link from "next/link";
import { AlertOctagon, MessageCircle, Mail, ArrowLeft, ShieldAlert } from "lucide-react";

export default function SuspendidoPage() {
  return (
    <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-red-500 selection:text-white">
      {/* Red ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 ring-8 ring-red-500/5">
          <AlertOctagon className="w-10 h-10" />
        </div>

        <div className="bg-[#121824]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/80">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/15 text-red-300 border border-red-500/30 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Servicio Suspendido
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Membresía SaaS Temporalmente Interrumpida
          </h1>

          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            El acceso a esta plataforma de gestión para socios y administradores se encuentra temporalmente suspendido por regularización de la suscripción.
          </p>

          <div className="my-6 p-4 rounded-2xl bg-slate-950/60 border border-white/5 text-left text-xs space-y-2 text-slate-400">
            <p className="font-bold text-slate-200">¿Eres el titular o administrador del gimnasio?</p>
            <p>
              Tus datos, clientes, rutinas y configuraciones están completamente seguros. Para reactivar el servicio al instante, comunícate con el equipo de soporte de NanoLabs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://wa.me/5491100000000?text=Hola,%20deseo%20regularizar%20la%20suscripci%C3%B3n%20de%20mi%20gimnasio%20en%20OnlyGym"
              target="_blank"
              rel="noreferrer"
              className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
            >
              <MessageCircle className="w-4 h-4" /> Regularizar por WhatsApp
            </a>

            <a
              href="mailto:soporte@nanolabs.ar?subject=Regularización%20Suscripción%20OnlyGym"
              className="h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-2 transition"
            >
              <Mail className="w-4 h-4 text-cyan-400" /> Soporte por Email
            </a>
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Plataforma SaaS OnlyGym · NanoLabs</span>
          </div>
        </div>
      </div>
    </main>
  );
}
