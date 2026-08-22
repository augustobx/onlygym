"use client";

import { useEffect, useState, useRef } from "react";
import { 
  getCliente, 
  updateCliente, 
  resetPasswordCliente,
  renovarMembresiaCliente360 
} from "@/app/actions/clientes";
import { 
  registrarPagoCuenta, 
  registrarCargoCuenta, 
  setLimiteCredito 
} from "@/app/actions/cuentas";
import { getMembresiasDisponibles } from "@/app/actions/caja";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  Activity, 
  Save, 
  KeyRound, 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Receipt,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  Settings
} from "lucide-react";
import Link from "next/link";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function formatDate(d: string) { 
  return new Date(d).toLocaleDateString("es-AR"); 
}
function formatDateTime(d: string) { 
  return new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }); 
}

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = Number(params.id);

  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"membresias" | "cuenta" | "datos" | "asistencias">("membresias");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Formulario
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resettingPwd, setResettingPwd] = useState(false);

  // Modal Renovación 360
  const [showModalRenovar, setShowModalRenovar] = useState(false);
  const [membresiasDisponibles, setMembresiasDisponibles] = useState<any[]>([]);
  const [selectedMembresiaId, setSelectedMembresiaId] = useState<number | "">("");
  const [metodoPagoRenovacion, setMetodoPagoRenovacion] = useState<string>("efectivo");
  const [montoRenovacion, setMontoRenovacion] = useState<string>("");
  const [notasRenovacion, setNotasRenovacion] = useState<string>("");
  const [extenderDesdeVencimiento, setExtenderDesdeVencimiento] = useState(true);
  const [procesandoRenovacion, setProcesandoRenovacion] = useState(false);

  // Modal Cuenta Corriente 360
  const [showModalCuenta, setShowModalCuenta] = useState<"pago" | "cargo" | "limite" | null>(null);
  const [montoCuenta, setMontoCuenta] = useState("");
  const [conceptoCuenta, setConceptoCuenta] = useState("");
  const [procesandoCuenta, setProcesandoCuenta] = useState(false);

  const loadCliente = () => {
    getCliente(clienteId).then((r) => {
      if (r.success && r.data) {
        setCliente(r.data);
        setFotoBase64(r.data.foto || null);
        setForm({
          nombre: r.data.nombre,
          apellido: r.data.apellido,
          documento: r.data.documento,
          telefono: r.data.telefono || "",
          email: r.data.email || "",
          direccion: r.data.direccion || "",
          estado: r.data.estado,
        });
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadCliente();
    getMembresiasDisponibles().then((r) => {
      if (r.success && r.data) {
        setMembresiasDisponibles(r.data.map((m: any) => ({ ...m, precio: Number(m.precio) })));
      }
    });
  }, [clienteId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setMsg({ type: "error", text: "La imagen no debe superar los 3 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setFotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveDatos = async () => {
    setSaving(true);
    const dataToSend = { ...form, foto: fotoBase64 || null };
    const result = await updateCliente(clienteId, dataToSend);
    if (result.success) {
      setMsg({ type: "success", text: "Datos del socio guardados con éxito." });
      loadCliente();
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: result.error || "Error al actualizar" });
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!confirm("¿Restablecer la contraseña del socio a '123456'?")) return;
    setResettingPwd(true);
    const res = await resetPasswordCliente(clienteId);
    if (res.success) {
      setMsg({ type: "success", text: "Contraseña restablecida a '123456'." });
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error al restablecer" });
    }
    setResettingPwd(false);
  };

  const handleEjecutarRenovacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembresiaId) return;

    setProcesandoRenovacion(true);
    const sucursalId = typeof window !== "undefined" ? Number(localStorage.getItem("activeSucursalId") || "1") : 1;

    const res = await renovarMembresiaCliente360({
      clienteId,
      membresiaId: Number(selectedMembresiaId),
      sucursalId,
      metodoPago: metodoPagoRenovacion,
      monto: montoRenovacion ? Number(montoRenovacion) : undefined,
      notas: notasRenovacion || undefined,
      extenderDesdeVencimiento,
    });

    if (res.success) {
      setMsg({ type: "success", text: res.mensaje || "¡Membresía renovada con éxito!" });
      setShowModalRenovar(false);
      setSelectedMembresiaId("");
      setNotasRenovacion("");
      loadCliente();
      setTimeout(() => setMsg(null), 3500);
    } else {
      setMsg({ type: "error", text: res.error || "Error al renovar membresía" });
    }
    setProcesandoRenovacion(false);
  };

  const handleEjecutarCuenta = async () => {
    if (!montoCuenta || Number(montoCuenta) <= 0) return;
    setProcesandoCuenta(true);

    let res;
    if (showModalCuenta === "pago") {
      res = await registrarPagoCuenta(clienteId, Number(montoCuenta), conceptoCuenta || "Pago a cuenta corriente");
    } else if (showModalCuenta === "cargo") {
      res = await registrarCargoCuenta(clienteId, Number(montoCuenta), conceptoCuenta || "Cargo directo a cuenta corriente");
    } else if (showModalCuenta === "limite") {
      res = await setLimiteCredito(clienteId, Number(montoCuenta));
    }

    if (res?.success) {
      setMsg({ type: "success", text: "Operación de cuenta corriente registrada." });
      setShowModalCuenta(null);
      setMontoCuenta("");
      setConceptoCuenta("");
      loadCliente();
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res?.error || "Error en operación" });
    }
    setProcesandoCuenta(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        <p className="text-xs font-semibold text-slate-600">Cargando ficha 360 del socio...</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-center text-xs font-semibold">
        Socio no encontrado.
      </div>
    );
  }

  const ultimoPago = cliente.pagos?.[0];
  const hoy = new Date();
  let estaAlDia = false;
  let diasRestantes = 0;
  let fechaVencimiento: Date | null = null;

  if (ultimoPago) {
    fechaVencimiento = new Date(ultimoPago.fechaVencimiento);
    fechaVencimiento.setHours(23, 59, 59, 999);
    if (fechaVencimiento >= hoy) {
      estaAlDia = true;
      const diffMs = fechaVencimiento.getTime() - hoy.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const saldoDeudor = cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.saldo) : 0;
  const limiteCredito = cliente.cuentaCorriente ? Number(cliente.cuentaCorriente.limiteCredito) : 5000;
  const creditoDisponible = Math.max(0, limiteCredito - saldoDeudor);

  const cleanPhone = (cliente.telefono || "").replace(/[^0-9]/g, "");
  const sucursalNombre = cliente.sucursales?.[0]?.nombre || "GymLink";
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
        cliente.nombre
      )}!%20Te%20recordamos%20desde%20${encodeURIComponent(
        sucursalNombre
      )}%20que%20tu%20membres%C3%ADa%20(${encodeURIComponent(
        ultimoPago?.membresia?.nombre || "General"
      )})%20vence%20el%20${fechaVencimiento ? formatDate(fechaVencimiento.toISOString()) : "pronto"}.%20%C2%A1Te%20esperamos%20para%20renovar!`
    : null;

  return (
    <div className="space-y-5 font-sans max-w-6xl mx-auto">
      
      {/* Header Ficha 360 */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="relative flex-shrink-0">
              {fotoBase64 ? (
                <img
                  src={fotoBase64}
                  alt={cliente.nombre}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-cyan-50 text-cyan-800 flex items-center justify-center font-bold text-lg border border-cyan-200">
                  {cliente.nombre.charAt(0)}{cliente.apellido.charAt(0)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {cliente.nombre} {cliente.apellido}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    estaAlDia
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}
                >
                  {estaAlDia ? `● Al Día (${diasRestantes}d)` : "● Vencido"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium mt-0.5">
                <span className="font-mono">DNI: <strong className="text-slate-900">{cliente.documento}</strong></span>
                {cliente.telefono && <span>📞 {cliente.telefono}</span>}
                {cliente.email && <span>✉️ {cliente.email}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowModalRenovar(true);
                if (membresiasDisponibles.length > 0) {
                  setSelectedMembresiaId(membresiasDisponibles[0].id);
                  setMontoRenovacion(String(membresiasDisponibles[0].precio));
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Renovar Membresía</span>
            </button>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition"
                title="Enviar recordatorio por WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                <span>WhatsApp</span>
              </a>
            )}

            <button
              onClick={handleResetPassword}
              disabled={resettingPwd}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-medium shadow-2xs transition"
              title="Resetear clave del portal a 123456"
            >
              <KeyRound className="h-3.5 w-3.5 text-slate-600" />
              <span>Reset Clave</span>
            </button>
          </div>
        </div>

        {/* KPI Mini-Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Plan Vigente</span>
            <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{ultimoPago?.membresia?.nombre || "Sin Plan"}</p>
            <span className="text-[10px] text-slate-600 font-medium">
              Vence: {fechaVencimiento ? formatDate(fechaVencimiento.toISOString()) : "—"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Saldo Cuenta Corriente</span>
            <p className={`text-xs font-bold font-mono mt-0.5 tabular-nums ${saldoDeudor > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {formatMoney(saldoDeudor)}
            </p>
            <span className="text-[10px] text-slate-600 font-medium">Deuda acumulada</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Crédito Disponible</span>
            <p className="text-xs font-bold font-mono text-slate-900 mt-0.5 tabular-nums">{formatMoney(creditoDisponible)}</p>
            <span className="text-[10px] text-slate-600 font-medium">Límite: {formatMoney(limiteCredito)}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Visitas</span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{cliente.ingresos?.length || 0} ingresos</p>
            <span className="text-[10px] text-slate-600 font-medium">Registros en molinete</span>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-700" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* Tabs Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
        <button
          onClick={() => setActiveTab("membresias")}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 ${
            activeTab === "membresias"
              ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
          <span>Membresías & Cuotas</span>
        </button>

        <button
          onClick={() => setActiveTab("cuenta")}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 ${
            activeTab === "cuenta"
              ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-cyan-600" />
          <span>Cuenta Corriente</span>
        </button>

        <button
          onClick={() => setActiveTab("datos")}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 ${
            activeTab === "datos"
              ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <User className="w-3.5 h-3.5 text-cyan-600" />
          <span>Datos & Foto</span>
        </button>

        <button
          onClick={() => setActiveTab("asistencias")}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 ${
            activeTab === "asistencias"
              ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-600" />
          <span>Asistencias ({cliente.ingresos?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: MEMBRESÍAS */}
      {activeTab === "membresias" && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Historial de Membresías</h3>
            <button
              onClick={() => {
                setShowModalRenovar(true);
                if (membresiasDisponibles.length > 0) {
                  setSelectedMembresiaId(membresiasDisponibles[0].id);
                  setMontoRenovacion(String(membresiasDisponibles[0].precio));
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cobrar Cuota</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Fecha Pago</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Vencimiento</th>
                  <th className="px-4 py-2.5">Método</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                  <th className="px-4 py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cliente.pagos?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-medium">
                      Sin membresías cargadas.
                    </td>
                  </tr>
                ) : (
                  cliente.pagos.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{formatDate(p.fechaPago)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{p.membresia?.nombre || "General"}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{formatDate(p.fechaVencimiento)}</td>
                      <td className="px-4 py-2.5 uppercase font-mono text-[10px] text-slate-600 font-semibold">{p.metodoPago || "Efectivo"}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">{formatMoney(Number(p.monto))}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          ● Pagado
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CUENTA CORRIENTE */}
      {activeTab === "cuenta" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Gestión de Cuenta Corriente</h3>
              <p className="text-xs text-slate-600">Abonos, cargos y ajuste de crédito autorizado</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowModalCuenta("pago"); setMontoCuenta(""); setConceptoCuenta(""); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Abonar Pago</span>
              </button>

              <button
                onClick={() => { setShowModalCuenta("cargo"); setMontoCuenta(""); setConceptoCuenta(""); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-semibold transition"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Cargar Deuda</span>
              </button>

              <button
                onClick={() => { setShowModalCuenta("limite"); setMontoCuenta(String(limiteCredito)); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-medium shadow-2xs transition"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                <span>Límite</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Movimientos de Cuenta</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Fecha</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Concepto</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cliente.cuentaCorriente?.movimientos?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-medium">
                        Sin movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    cliente.cuentaCorriente.movimientos.map((m: any) => {
                      const esCargo = m.tipo === "cargo";
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{formatDateTime(m.fecha)}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                esCargo
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
                              }`}
                            >
                              {esCargo ? "● Cargo" : "● Abono"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{m.concepto || "—"}</td>
                          <td className={`px-4 py-2.5 text-right font-bold font-mono tabular-nums ${esCargo ? "text-rose-600" : "text-emerald-700"}`}>
                            {esCargo ? `+ ${formatMoney(Number(m.monto))}` : `- ${formatMoney(Number(m.monto))}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATOS PERSONALES */}
      {activeTab === "datos" && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4 text-cyan-600" />
              Editar Información Personal
            </h3>
            <span className="text-[11px] text-slate-500">
              Registrado el {formatDate(cliente.fechaRegistro)}
            </span>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="relative flex-shrink-0">
              {fotoBase64 ? (
                <img
                  src={fotoBase64}
                  alt={cliente.nombre}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-cyan-50 text-cyan-800 flex items-center justify-center font-bold text-lg border border-cyan-200">
                  {cliente.nombre.charAt(0)}{cliente.apellido.charAt(0)}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900">Foto para Reconocimiento</p>
              <p className="text-[11px] text-slate-600">Visible en pantalla de molinete y credencial del socio.</p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-md text-xs font-medium shadow-2xs transition"
              >
                <Camera className="h-3.5 w-3.5 text-cyan-600" />
                <span>{fotoBase64 ? "Cambiar Foto" : "Subir Foto"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre</label>
              <input
                value={form.nombre || ""}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Apellido</label>
              <input
                value={form.apellido || ""}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">DNI (Documento)</label>
              <input
                value={form.documento || ""}
                onChange={e => setForm({ ...form, documento: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Estado</label>
              <select
                value={form.estado || "activo"}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg font-semibold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              >
                <option value="activo">Activo (Habilitado)</option>
                <option value="inactivo">Inactivo (Bloqueado)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
              <input
                value={form.telefono || ""}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ""}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Dirección</label>
              <input
                value={form.direccion || ""}
                onChange={e => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveDatos}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ASISTENCIAS */}
      {activeTab === "asistencias" && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Historial de Asistencias</h3>
            <span className="text-xs text-slate-600 font-medium">{cliente.ingresos?.length || 0} registros</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Entrada</th>
                  <th className="px-4 py-2.5">Salida</th>
                  <th className="px-4 py-2.5 text-center">Permanencia</th>
                  <th className="px-4 py-2.5 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cliente.ingresos?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                      Sin ingresos registrados.
                    </td>
                  </tr>
                ) : (
                  cliente.ingresos.map((i: any) => (
                    <tr key={i.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{formatDate(i.fechaHora)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900 font-mono text-[11px]">
                        {new Date(i.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">
                        {i.horaSalida ? new Date(i.horaSalida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {i.duracionMinutos ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono text-[10px] font-semibold border border-slate-200">
                            <Clock className="w-3 h-3 text-cyan-600" />
                            {i.duracionMinutos} min
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-medium">En curso</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          ● OK
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Renovar Membresía */}
      {showModalRenovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Renovar / Cobrar Membresía</h3>
              </div>
              <button onClick={() => setShowModalRenovar(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEjecutarRenovacion} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan de Membresía *</label>
                <select
                  value={selectedMembresiaId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedMembresiaId(id);
                    const sel = membresiasDisponibles.find((m) => m.id === id);
                    if (sel) setMontoRenovacion(String(sel.precio));
                  }}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                >
                  {membresiasDisponibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.diasDuracion} días) — {formatMoney(m.precio)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Forma de Pago</label>
                  <select
                    value={metodoPagoRenovacion}
                    onChange={(e) => setMetodoPagoRenovacion(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta Débito/Crédito</option>
                    <option value="cuenta_corriente">Cuenta Corriente</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={montoRenovacion}
                    onChange={(e) => setMontoRenovacion(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extenderDesdeVencimiento}
                  onChange={(e) => setExtenderDesdeVencimiento(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                />
                <span className="text-[11px] text-slate-700 font-medium">
                  Extender vigencia a partir del vencimiento actual (si aún no vence)
                </span>
              </label>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas (Opcional)</label>
                <input
                  type="text"
                  value={notasRenovacion}
                  onChange={(e) => setNotasRenovacion(e.target.value)}
                  placeholder="Ej: Pago en mostrador"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalRenovar(false)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoRenovacion}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {procesandoRenovacion ? "Procesando..." : "Confirmar Renovación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cuenta Corriente */}
      {showModalCuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {showModalCuenta === "pago" && "Registrar Abono a Cuenta"}
                {showModalCuenta === "cargo" && "Registrar Cargo en Cuenta"}
                {showModalCuenta === "limite" && "Configurar Límite de Crédito"}
              </h3>
              <button onClick={() => setShowModalCuenta(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  required
                  value={montoCuenta}
                  onChange={(e) => setMontoCuenta(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-base font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {showModalCuenta !== "limite" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Concepto / Motivo</label>
                  <input
                    type="text"
                    value={conceptoCuenta}
                    onChange={(e) => setConceptoCuenta(e.target.value)}
                    placeholder="Ej: Pago parcial en efectivo..."
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowModalCuenta(null)}
                className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEjecutarCuenta}
                disabled={procesandoCuenta || !montoCuenta}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition disabled:opacity-50"
              >
                {procesandoCuenta ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
