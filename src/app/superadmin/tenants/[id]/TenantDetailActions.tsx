"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarTenantSuperAdmin,
  suspenderTenantSuperAdmin,
  reactivarTenantSuperAdmin,
  registrarPagoPlataforma,
} from "@/app/actions/superadmin";
import {
  Check,
  Ban,
  Clock,
  Save,
  CreditCard,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

export default function TenantDetailActions({
  tenant,
  planes,
}: {
  tenant: any;
  planes: Array<{ id: number; nombre: string; codigo: string; precioMensual: number }>;
}) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // States
  const [nombre, setNombre] = useState(tenant.nombre);
  const [slug, setSlug] = useState(tenant.slug);
  const [estado, setEstado] = useState<"activo" | "prueba" | "suspendido" | "cancelado">(tenant.estado);
  const [planSaaSId, setPlanSaaSId] = useState<number | undefined>(tenant.planSaaSId || undefined);
  const [fechaVencimiento, setFechaVencimiento] = useState(
    tenant.fechaVencimiento ? new Date(tenant.fechaVencimiento).toISOString().slice(0, 10) : ""
  );

  // Modal pago
  const [pagoModal, setPagoModal] = useState(false);
  const [montoPago, setMontoPago] = useState(
    String(tenant.planSaaS?.precioMensual || 25000)
  );
  const [metodoPago, setMetodoPago] = useState("transferencia");
  const [extenderDias, setExtenderDias] = useState("30");

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await actualizarTenantSuperAdmin(tenant.id, {
      nombre,
      slug,
      estado,
      planSaaSId,
      fechaVencimiento: fechaVencimiento || null,
    });

    if (result.success) {
      setMessage({ text: "Configuración actualizada correctamente", type: "success" });
      router.refresh();
    } else {
      setMessage({ text: result.error || "Error al actualizar", type: "error" });
    }
    setSaving(false);
  }

  async function handleSuspender() {
    if (!window.confirm("¿Seguro que deseas suspender este gimnasio? Los socios y el personal verán la pantalla de servicio suspendido.")) return;
    setSaving(true);
    const result = await suspenderTenantSuperAdmin(tenant.id, "Suspensión manual desde SuperAdmin");
    if (result.success) {
      setEstado("suspendido");
      setMessage({ text: "Gimnasio suspendido", type: "success" });
      router.refresh();
    }
    setSaving(false);
  }

  async function handleReactivar() {
    setSaving(true);
    const result = await reactivarTenantSuperAdmin(tenant.id, 30);
    if (result.success) {
      setEstado("activo");
      setMessage({ text: "Gimnasio reactivado (+30 días agregados)", type: "success" });
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    const suscripcionActiva = tenant.suscripciones[0];
    if (!suscripcionActiva) {
      alert("No hay suscripción activa asociada a este tenant");
      return;
    }

    setSaving(true);
    const result = await registrarPagoPlataforma({
      tenantId: tenant.id,
      suscripcionId: suscripcionActiva.id,
      monto: parseFloat(montoPago) || 0,
      metodoPago,
      extenderDias: parseInt(extenderDias, 10) || 30,
    });

    if (result.success) {
      setPagoModal(false);
      setMessage({ text: "Pago registrado y membresía extendida", type: "success" });
      router.refresh();
    } else {
      setMessage({ text: result.error || "Error registrando pago", type: "error" });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border border-red-500/20 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Quick Status Bar */}
      <div className="p-5 rounded-3xl bg-[#121824] border border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-xs">
            <span className="text-slate-400">Estado del Servicio: </span>
            <span className="font-black uppercase text-white">{estado}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {estado === "suspendido" ? (
            <button
              type="button"
              onClick={handleReactivar}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Reactivar (+30d)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSuspender}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold hover:bg-red-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Ban className="w-4 h-4" /> Suspender Servicio
            </button>
          )}

          {tenant.suscripciones.length > 0 && (
            <button
              type="button"
              onClick={() => setPagoModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 transition flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" /> Registrar Cobro
            </button>
          )}
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl bg-[#121824] border border-white/8 space-y-6">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" /> Configuración de la Suscripción
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre Comercial</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Slug de Subdominio</label>
            <div className="relative">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                required
                className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl pl-3.5 pr-28 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 pointer-events-none">
                .nanoapps.ar
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Plan SaaS Asignado</label>
            <select
              value={planSaaSId || ""}
              onChange={(e) => setPlanSaaSId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Sin Plan Asignado</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (${Number(p.precioMensual).toLocaleString("es-AR")}/mes)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Estado de Membresía</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as any)}
              className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="activo">Activo (Habilitado)</option>
              <option value="prueba">En Prueba (Trial)</option>
              <option value="suspendido">Suspendido (Falta de pago)</option>
              <option value="cancelado">Cancelado / Baja</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha de Vencimiento</label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/8 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black text-xs hover:opacity-95 transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </form>

      {/* Modal Registrar Cobro */}
      {pagoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121824] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" /> Registrar Cobro de Plataforma
            </h3>
            <p className="text-xs text-slate-400">
              Registra el pago de la suscripción SaaS para <b>{tenant.nombre}</b>.
            </p>

            <form onSubmit={handleRegistrarPago} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Monto Cobrado ($)</label>
                <input
                  type="number"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  required
                  className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Método de Cobro</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="debito_automatico">Débito Automático</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Extender Vencimiento (Días)</label>
                <input
                  type="number"
                  value={extenderDias}
                  onChange={(e) => setExtenderDias(e.target.value)}
                  min={0}
                  className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPagoModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 transition"
                >
                  {saving ? "Procesando..." : "Confirmar Cobro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
