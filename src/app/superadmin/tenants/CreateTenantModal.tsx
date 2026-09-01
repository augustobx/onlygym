"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Building2, User, Lock, Mail, MapPin, Layers, Loader2, Sparkles } from "lucide-react";
import { crearTenantSuperAdmin } from "@/app/actions/superadmin";

export default function CreateTenantModal({
  planes,
  defaultOpen = false,
}: {
  planes: Array<{ id: number; nombre: string; codigo: string; precioMensual: number }>;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");

  function handleNombreChange(val: string) {
    setNombre(val);
    const generatedSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nombre: String(formData.get("nombre") || ""),
      slug: String(formData.get("slug") || "").toLowerCase().trim(),
      planSaaSId: formData.get("planSaaSId") ? Number(formData.get("planSaaSId")) : undefined,
      sucursalNombre: String(formData.get("sucursalNombre") || "Sede Principal"),
      sucursalDireccion: String(formData.get("sucursalDireccion") || ""),
      adminName: String(formData.get("adminName") || ""),
      adminEmail: String(formData.get("adminEmail") || ""),
      adminPassword: String(formData.get("adminPassword") || ""),
      diasPrueba: Number(formData.get("diasPrueba") || 14),
    };

    const result = await crearTenantSuperAdmin(payload);

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error || "Error al crear el gimnasio");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Nuevo Gimnasio
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#121824] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 grid place-items-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Alta de Nuevo Gimnasio</h2>
                  <p className="text-xs text-slate-400">Provisionamiento automático de tenant y subdominio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Sección Gimnasio */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Datos del Gimnasio
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Comercial</label>
                    <input
                      name="nombre"
                      value={nombre}
                      onChange={(e) => handleNombreChange(e.target.value)}
                      required
                      placeholder="Ej. Iron Gym Centro"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Slug Subdominio</label>
                    <div className="relative">
                      <input
                        name="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                        required
                        placeholder="irongym"
                        className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl pl-3.5 pr-28 text-sm font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 pointer-events-none">
                        .nanoapps.ar
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Plan Comercial SaaS</label>
                    <select
                      name="planSaaSId"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (${Number(p.precioMensual).toLocaleString("es-AR")}/mes)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Días de Prueba Gratis</label>
                    <input
                      name="diasPrueba"
                      type="number"
                      defaultValue={14}
                      min={0}
                      max={365}
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Primera Sede</label>
                    <input
                      name="sucursalNombre"
                      defaultValue="Sede Principal"
                      required
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Dirección (Opcional)</label>
                    <input
                      name="sucursalDireccion"
                      placeholder="Av. Santa Fe 1234"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección Administrador Inicial */}
              <div className="space-y-3 pt-3 border-t border-white/8">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Usuario Administrador del Gimnasio
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Completo</label>
                    <input
                      name="adminName"
                      required
                      placeholder="Juan Pérez"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Email Administrador</label>
                    <input
                      name="adminEmail"
                      type="email"
                      required
                      placeholder="juan@irongym.com"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Contraseña Inicial</label>
                    <input
                      name="adminPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Provisionando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Crear y Habilitar Gimnasio
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
