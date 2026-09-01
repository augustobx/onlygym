"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell, Shield, Sparkles, Building2, User, Lock, Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { registrarNuevoGimnasio } from "@/app/actions/onboarding";

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTenant, setCreatedTenant] = useState<{ slug: string; nombre: string } | null>(null);

  // Form State
  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [slug, setSlug] = useState("");
  const [planCodigo, setPlanCodigo] = useState("PRO");
  const [nombreSede, setNombreSede] = useState("Sede Principal");
  const [direccionSede, setDireccionSede] = useState("");
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [passwordAdmin, setPasswordAdmin] = useState("");

  function handleNameChange(val: string) {
    setNombreGimnasio(val);
    const gen = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(gen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await registrarNuevoGimnasio({
      nombreGimnasio,
      slug,
      planCodigo,
      nombreSede,
      direccionSede,
      nombreAdmin,
      emailAdmin,
      passwordAdmin,
    });

    if (result.success && result.data) {
      setCreatedTenant(result.data);
    } else {
      setError(result.error || "Error al completar el registro");
      setLoading(false);
    }
  }

  if (createdTenant) {
    return (
      <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#121824] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 grid place-items-center mx-auto ring-8 ring-emerald-500/5">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">¡Gimnasio Creado!</span>
            <h1 className="text-3xl font-black text-white mt-1">{createdTenant.nombre}</h1>
            <p className="text-xs text-slate-400 mt-2">
              Tu plataforma SaaS está lista con 14 días de prueba gratis.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Subdominio:</span>
              <span className="text-cyan-300">https://{createdTenant.slug}.nanoapps.ar</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Usuario:</span>
              <span className="text-white">{emailAdmin}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-cyan-500/20"
            >
              Ingresar al Panel de Administración <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-2xl relative z-10 my-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black shadow-lg shadow-cyan-500/20 mb-3 ring-8 ring-white/5">
            <Dumbbell className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">Onboarding Autoservicio</p>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Comienza tu Gimnasio en OnlyGym</h1>
          <p className="text-xs text-slate-400 mt-1">Configura tu centro de entrenamiento en menos de 2 minutos · 14 días gratis</p>
        </div>

        <div className="bg-[#121824]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Gimnasio & Dominio */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 1. Datos de tu Gimnasio
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre del Gimnasio</label>
                  <input
                    value={nombreGimnasio}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Ej. Sparta Fitness Club"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Subdominio Web</label>
                  <div className="relative">
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                      required
                      placeholder="spartafitness"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl pl-3.5 pr-28 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 pointer-events-none">
                      .nanoapps.ar
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Sede Principal</label>
                  <input
                    value={nombreSede}
                    onChange={(e) => setNombreSede(e.target.value)}
                    required
                    placeholder="Sede Central"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Dirección (Opcional)</label>
                  <input
                    value={direccionSede}
                    onChange={(e) => setDireccionSede(e.target.value)}
                    placeholder="Av. Libertador 450"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Plan Selection */}
            <div className="space-y-3 pt-3 border-t border-white/8">
              <h2 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> 2. Elige tu Plan (14 días gratis)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { codigo: "STARTER", nombre: "Starter", desc: "Hasta 200 socios", precio: "$25.000" },
                  { codigo: "PRO", nombre: "Pro", desc: "Hasta 600 socios + Clases", precio: "$45.000", popular: true },
                  { codigo: "ENTERPRISE", nombre: "Enterprise", desc: "Ilimitado + Multi-sede", precio: "$75.000" },
                ].map((p) => (
                  <label
                    key={p.codigo}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition relative flex flex-col justify-between ${
                      planCodigo === p.codigo
                        ? "bg-cyan-500/10 border-cyan-500/40 ring-2 ring-cyan-500/20"
                        : "bg-slate-950 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      checked={planCodigo === p.codigo}
                      onChange={() => setPlanCodigo(p.codigo)}
                      className="sr-only"
                    />
                    <div>
                      {p.popular && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 mb-2 inline-block">
                          Recomendado
                        </span>
                      )}
                      <h3 className="font-black text-sm text-white">{p.nombre}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                    </div>
                    <p className="text-sm font-black text-cyan-300 mt-3">{p.precio}<span className="text-[10px] text-slate-500 font-bold">/mes</span></p>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3: Cuenta Admin */}
            <div className="space-y-3 pt-3 border-t border-white/8">
              <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <User className="w-4 h-4" /> 3. Tu Cuenta de Administrador
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Tu Nombre</label>
                  <input
                    value={nombreAdmin}
                    onChange={(e) => setNombreAdmin(e.target.value)}
                    required
                    placeholder="Carlos Gómez"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Email de Acceso</label>
                  <input
                    type="email"
                    value={emailAdmin}
                    onChange={(e) => setEmailAdmin(e.target.value)}
                    required
                    placeholder="carlos@spartafitness.com"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={passwordAdmin}
                    onChange={(e) => setPasswordAdmin(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/8">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creando plataforma de tu gimnasio...
                  </>
                ) : (
                  <>
                    Comenzar Prueba Gratuita <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
