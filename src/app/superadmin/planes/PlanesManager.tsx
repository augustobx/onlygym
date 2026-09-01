"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Check, X, Layers, Users, MapPin, Sparkles, Loader2, Save } from "lucide-react";
import { crearPlanSaaS, actualizarPlanSaaS } from "@/app/actions/superadmin";

const MODULE_KEYS = [
  { key: "socios", label: "Gestión de Socios" },
  { key: "membresias", label: "Planes de Membresía" },
  { key: "accesos", label: "Molinete y Control de Acceso" },
  { key: "caja", label: "Punto de Venta / Caja" },
  { key: "entrenamiento", label: "Rutinas y Planes de Entrenamiento" },
  { key: "clases", label: "Clases y Reservas" },
  { key: "mediciones", label: "Mediciones Corporales y Fotos" },
  { key: "puntos", label: "Fidelización, Puntos y Premios" },
  { key: "reportes", label: "Analítica y Reportes Avanzados" },
];

export default function PlanesManager({
  initialPlanes,
}: {
  initialPlanes: any[];
}) {
  const router = useRouter();
  const [planes, setPlanes] = useState(initialPlanes);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingPlan({
      codigo: "",
      nombre: "",
      descripcion: "",
      precioMensual: 25000,
      limiteUsuarios: 5,
      limiteSucursales: 1,
      limiteSocios: 500,
      modulos: {
        socios: true,
        membresias: true,
        accesos: true,
        caja: true,
        entrenamiento: true,
        clases: true,
        mediciones: true,
        puntos: true,
        reportes: true,
      },
      activo: true,
    });
    setIsNew(true);
    setError(null);
  }

  function openEdit(plan: any) {
    setEditingPlan({
      ...plan,
      precioMensual: Number(plan.precioMensual),
      modulos: plan.modulos || {},
    });
    setIsNew(false);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (isNew) {
      const result = await crearPlanSaaS({
        codigo: editingPlan.codigo.toUpperCase().trim(),
        nombre: editingPlan.nombre.trim(),
        descripcion: editingPlan.descripcion || undefined,
        precioMensual: Number(editingPlan.precioMensual),
        limiteUsuarios: Number(editingPlan.limiteUsuarios),
        limiteSucursales: Number(editingPlan.limiteSucursales),
        limiteSocios: editingPlan.limiteSocios ? Number(editingPlan.limiteSocios) : null,
        modulos: editingPlan.modulos,
        activo: Boolean(editingPlan.activo),
      });

      if (result.success) {
        setEditingPlan(null);
        router.refresh();
      } else {
        setError(result.error || "Error al crear plan");
      }
    } else {
      const result = await actualizarPlanSaaS(editingPlan.id, {
        nombre: editingPlan.nombre.trim(),
        descripcion: editingPlan.descripcion || undefined,
        precioMensual: Number(editingPlan.precioMensual),
        limiteUsuarios: Number(editingPlan.limiteUsuarios),
        limiteSucursales: Number(editingPlan.limiteSucursales),
        limiteSocios: editingPlan.limiteSocios ? Number(editingPlan.limiteSocios) : null,
        modulos: editingPlan.modulos,
        activo: Boolean(editingPlan.activo),
      });

      if (result.success) {
        setEditingPlan(null);
        router.refresh();
      } else {
        setError(result.error || "Error al actualizar plan");
      }
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nuevo Plan SaaS
        </button>
      </div>

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {planes.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 rounded-3xl bg-[#121824] border transition flex flex-col justify-between ${
              plan.activo ? "border-white/8 hover:border-cyan-500/30" : "border-red-500/20 opacity-60"
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                  {plan.codigo}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    plan.activo ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {plan.activo ? "Activo" : "Inactivo"}
                </span>
              </div>

              <h3 className="text-xl font-black text-white">{plan.nombre}</h3>
              <p className="text-xs text-slate-400 mt-1 min-h-[32px]">
                {plan.descripcion || "Sin descripción"}
              </p>

              <div className="mt-4 pb-4 border-b border-white/5">
                <span className="text-3xl font-black text-white tracking-tight">
                  ${Number(plan.precioMensual).toLocaleString("es-AR")}
                </span>
                <span className="text-xs text-slate-500 font-bold ml-1.5">/ mes</span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Usuarios staff:</span>
                  <span className="font-bold text-white">{plan.limiteUsuarios}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sedes / Sucursales:</span>
                  <span className="font-bold text-white">{plan.limiteSucursales}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Límite de socios:</span>
                  <span className="font-bold text-white">
                    {plan.limiteSocios ? `${plan.limiteSocios} socios` : "Ilimitados"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gimnasios suscritos:</span>
                  <span className="font-bold text-cyan-400">{plan._count?.tenants || 0}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() => openEdit(plan)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar Plan
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Editor / Creador */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#121824] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 grid place-items-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">
                    {isNew ? "Crear Nuevo Plan SaaS" : `Editar Plan ${editingPlan.nombre}`}
                  </h2>
                  <p className="text-xs text-slate-400">Ajuste de precio y capacidades del plan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
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

            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Código Único (Técnico)</label>
                  <input
                    value={editingPlan.codigo}
                    onChange={(e) => setEditingPlan({ ...editingPlan, codigo: e.target.value.toUpperCase() })}
                    disabled={!isNew}
                    required
                    placeholder="STARTER"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Comercial</label>
                  <input
                    value={editingPlan.nombre}
                    onChange={(e) => setEditingPlan({ ...editingPlan, nombre: e.target.value })}
                    required
                    placeholder="Plan Profesional"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Descripción</label>
                <input
                  value={editingPlan.descripcion || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, descripcion: e.target.value })}
                  placeholder="Ideal para gimnasios en crecimiento con hasta 500 socios..."
                  className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Precio Mensual ($)</label>
                  <input
                    type="number"
                    value={editingPlan.precioMensual}
                    onChange={(e) => setEditingPlan({ ...editingPlan, precioMensual: e.target.value })}
                    required
                    min={0}
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Límite Usuarios</label>
                  <input
                    type="number"
                    value={editingPlan.limiteUsuarios}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limiteUsuarios: e.target.value })}
                    min={1}
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Límite Sedes</label>
                  <input
                    type="number"
                    value={editingPlan.limiteSucursales}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limiteSucursales: e.target.value })}
                    min={1}
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Límite Socios</label>
                  <input
                    type="number"
                    value={editingPlan.limiteSocios ?? ""}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limiteSocios: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Vacío = Ilimitado"
                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Módulos Habilitados */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Módulos Incluidos en este Plan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {MODULE_KEYS.map((mod) => {
                    const active = Boolean(editingPlan.modulos?.[mod.key] ?? true);
                    return (
                      <label
                        key={mod.key}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 cursor-pointer transition ${
                          active
                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                            : "bg-slate-950 border-white/5 text-slate-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              modulos: {
                                ...(editingPlan.modulos || {}),
                                [mod.key]: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-white/20 text-cyan-500 focus:ring-0"
                        />
                        <span className="truncate">{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Estado Activo */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.activo}
                    onChange={(e) => setEditingPlan({ ...editingPlan, activo: e.target.checked })}
                    className="rounded border-white/20 text-cyan-500 focus:ring-0"
                  />
                  <span>Plan activo y disponible para contratación</span>
                </label>
              </div>

              <div className="pt-4 border-t border-white/8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isNew ? "Crear Plan" : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
