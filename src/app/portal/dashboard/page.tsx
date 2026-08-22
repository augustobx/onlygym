"use client";

import { useEffect, useState } from "react";
import { 
  getPortalData, 
  logoutCliente, 
  cambiarPasswordPortal,
  getDetalleTicketVenta 
} from "@/app/actions/portalAuth";
import { useRouter } from "next/navigation";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { 
  Dumbbell, 
  LogOut, 
  CreditCard, 
  Activity, 
  User, 
  History, 
  QrCode, 
  X, 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  Receipt,
  MapPin,
  Bell,
  Clock,
  ChevronRight
} from "lucide-react";

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

export default function PortalDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"carnet" | "cuenta" | "pagos" | "asistencias" | "aforo">("carnet");
  const [showQrModal, setShowQrModal] = useState(false);

  // Ticket modal
  const [ticketModal, setTicketModal] = useState<any | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Push Notifications PWA
  const [notifPermission, setNotifPermission] = useState<string>("default");

  // Cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPortal = async () => {
    const r = await getPortalData();
    if (r.success && r.data) {
      setData(r.data);
      if (r.data.debeCambiarPassword) {
        setShowPasswordModal(true);
      }
    } else {
      router.push("/");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPortal();
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, [router]);

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        new Notification("GymLink Socio", {
          body: "¡Notificaciones activadas! Te avisaremos antes de que venza tu cuota.",
          icon: "/icon-192.png",
        });
      }
    }
  };

  const handleLogout = async () => {
    await logoutCliente();
    router.push("/");
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (nuevaPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nuevaPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setChangingPassword(true);
    const res = await cambiarPasswordPortal(nuevaPassword);
    if (res.success) {
      setShowPasswordModal(false);
      setMsg({ type: "success", text: "Tu contraseña fue actualizada con éxito." });
      loadPortal();
      setTimeout(() => setMsg(null), 3500);
    } else {
      setPasswordError(res.error || "Error al cambiar contraseña");
    }
    setChangingPassword(false);
  };

  const handleOpenTicket = async (concepto: string) => {
    const match = concepto.match(/#(\d+)/);
    if (!match) return;

    const ticketId = Number(match[1]);
    setLoadingTicket(true);
    const res = await getDetalleTicketVenta(ticketId);
    if (res.success && res.data) {
      setTicketModal(res.data);
    } else {
      alert("No se pudo cargar el ticket.");
    }
    setLoadingTicket(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-xs font-medium text-slate-400">Accediendo a tu cuenta...</p>
      </div>
    );
  }

  if (!data) return null;

  const ultimoPago = data.pagos?.[0];
  const hoy = new Date();
  let diasRestantes = 0;
  let estadoAcceso = "VENCIDO";
  let fechaVencimiento: Date | null = null;

  if (ultimoPago) {
    fechaVencimiento = new Date(ultimoPago.fechaVencimiento);
    fechaVencimiento.setHours(23, 59, 59, 999);
    if (fechaVencimiento >= hoy) {
      estadoAcceso = "ACTIVO";
      const diffMs = fechaVencimiento.getTime() - hoy.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const saldoCuenta = data.cuentaCorriente ? Number(data.cuentaCorriente.saldo) : 0;
  const limiteCredito = data.cuentaCorriente ? Number(data.cuentaCorriente.limiteCredito) : 5000;
  const creditoDisponible = Math.max(0, limiteCredito - saldoCuenta);
  const movimientosCuenta = data.cuentaCorriente?.movimientos || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {data.foto ? (
              <img
                src={data.foto}
                alt={data.nombre}
                className="w-8 h-8 rounded-lg object-cover border border-slate-700 flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0">
                <Dumbbell className="w-4 h-4" />
              </div>
            )}
            <div className="truncate">
              <span className="text-xs font-bold text-white block leading-none truncate">GymLink Socio</span>
              <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">{data.nombre} {data.apellido}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {notifPermission !== "granted" && (
              <button
                onClick={requestNotificationPermission}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Activar notificaciones"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Cambiar contraseña"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg text-xs font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Surface */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        
        {/* Banner Alert */}
        {msg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs font-medium text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{msg.text}</span>
          </div>
        )}

        {/* PWA Prompt */}
        <PWAInstallPrompt variant="card" appName="GymLink Socio" />

        {/* Segmented Tab Navigation */}
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex overflow-x-auto gap-1 text-xs font-medium scrollbar-none">
          <button
            onClick={() => setActiveTab("carnet")}
            className={`flex-1 min-w-[85px] py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "carnet"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <QrCode className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Carnet QR</span>
          </button>

          <button
            onClick={() => setActiveTab("cuenta")}
            className={`flex-1 min-w-[95px] py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "cuenta"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Cta. Corriente</span>
          </button>

          <button
            onClick={() => setActiveTab("pagos")}
            className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "pagos"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Membresías</span>
          </button>

          <button
            onClick={() => setActiveTab("asistencias")}
            className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "asistencias"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Asistencias</span>
          </button>

          <button
            onClick={() => setActiveTab("aforo")}
            className={`flex-1 min-w-[75px] py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "aforo"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Aforo</span>
          </button>
        </div>

        {/* TAB 1: CARNET DIGITAL ESTILO APPLE WALLET */}
        {activeTab === "carnet" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            
            {/* Apple Wallet / Metal Pass Card */}
            <div className="md:col-span-7 bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl space-y-4 relative">
              {/* Header Pass */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">GymLink Club</h3>
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Pase de Acceso</span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    estadoAcceso === "ACTIVO"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
                      : "bg-rose-950/60 text-rose-400 border-rose-800/50"
                  }`}
                >
                  {estadoAcceso === "ACTIVO" ? "● Activo" : "● Vencido"}
                </span>
              </div>

              {/* Socio + QR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-2.5 text-center sm:text-left w-full sm:w-auto">
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    {data.foto ? (
                      <img
                        src={data.foto}
                        alt={data.nombre}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 text-white font-bold text-base flex items-center justify-center border border-slate-700">
                        {data.nombre.charAt(0)}{data.apellido.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-bold text-white leading-tight">{data.nombre} {data.apellido}</h2>
                      <span className="text-xs font-mono text-slate-400 font-medium">DNI: {data.documento}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-left">
                    <div>
                      <span className="text-[9px] text-slate-500 font-semibold uppercase block">Plan</span>
                      <p className="text-xs font-semibold text-slate-200 truncate">{ultimoPago?.membresia?.nombre || "Sin Plan"}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-semibold uppercase block">Vence</span>
                      <p className="text-xs font-medium font-mono text-slate-200">
                        {fechaVencimiento ? formatDate(fechaVencimiento.toISOString()) : "—"}
                      </p>
                    </div>
                  </div>

                  {estadoAcceso === "ACTIVO" && (
                    <p className="text-[11px] text-emerald-400 font-medium">
                      ✓ {diasRestantes} días de acceso restantes
                    </p>
                  )}
                </div>

                {/* QR Canvas */}
                <div className="flex flex-col items-center gap-1.5 bg-white p-2.5 rounded-lg shadow-sm flex-shrink-0">
                  <QRCodeDisplay value={data.documento} size={115} />
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="w-full py-1 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-[9px] font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>Ampliar</span>
                  </button>
                </div>
              </div>

              {/* Sede Footer */}
              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{data.sucursales?.[0]?.nombre || "Sede Principal"}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">ID #{data.id}</span>
              </div>
            </div>

            {/* Quick Overview Sidebar */}
            <div className="md:col-span-5 space-y-3">
              
              {/* Cuenta Corriente Card */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Mi Cuenta Corriente</span>
                  <button
                    onClick={() => setActiveTab("cuenta")}
                    className="text-[11px] font-medium text-indigo-400 hover:underline"
                  >
                    Detalle →
                  </button>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Saldo a Pagar</span>
                    <p className={`text-base font-bold font-mono mt-0.5 tabular-nums ${saldoCuenta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {formatMoney(saldoCuenta)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Cupo Disponible</span>
                    <p className="text-xs font-bold font-mono text-slate-300 tabular-nums mt-0.5">{formatMoney(creditoDisponible)}</p>
                  </div>
                </div>
              </div>

              {/* Aforo Card */}
              {data.aforo && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Aforo de Sede</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                      {data.aforo.porcentaje}% Ocupado
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{data.aforo.nivelTexto}</p>
                  
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${Math.min(100, data.aforo.porcentaje)}%` }}
                      className={`h-full rounded-full transition-all ${
                        data.aforo.porcentaje >= 80 ? "bg-rose-500" : data.aforo.porcentaje >= 50 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUENTA CORRIENTE & TICKETS */}
        {activeTab === "cuenta" && (
          <div className="space-y-3">
            
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Deuda</span>
                <p className={`text-sm font-bold font-mono mt-0.5 tabular-nums ${saldoCuenta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatMoney(saldoCuenta)}
                </p>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Límite</span>
                <p className="text-sm font-bold font-mono text-slate-300 mt-0.5 tabular-nums">{formatMoney(limiteCredito)}</p>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Disponible</span>
                <p className="text-sm font-bold font-mono text-indigo-400 mt-0.5 tabular-nums">{formatMoney(creditoDisponible)}</p>
              </div>
            </div>

            {/* Listado de Movimientos */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                  Movimientos Registrados
                </h3>
              </div>

              {movimientosCuenta.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-medium">
                  Sin movimientos registrados en tu cuenta.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 text-xs">
                  {movimientosCuenta.map((m: any) => {
                    const esCargo = m.tipo === "cargo";
                    const tieneTicket = m.concepto && m.concepto.includes("Ticket #");

                    return (
                      <div key={m.id} className="p-3 hover:bg-slate-800/40 transition flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                                esCargo
                                  ? "bg-rose-950/60 text-rose-400 border-rose-800/50"
                                  : "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
                              }`}
                            >
                              {esCargo ? "● Cargo" : "● Abono"}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">{formatDateTime(m.fecha)}</span>
                          </div>
                          <p className="text-slate-300 font-medium">{m.concepto || "Movimiento"}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {tieneTicket && (
                            <button
                              onClick={() => handleOpenTicket(m.concepto)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[10px] font-medium transition"
                            >
                              Ver Ticket
                            </button>
                          )}
                          <span className={`font-bold font-mono tabular-nums ${esCargo ? "text-rose-400" : "text-emerald-400"}`}>
                            {esCargo ? `+ ${formatMoney(m.monto)}` : `- ${formatMoney(m.monto)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MEMBRESÍAS */}
        {activeTab === "pagos" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                Historial de Cuotas Abonadas
              </h3>
            </div>

            {data.pagos?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium">
                Sin pagos de membresías registrados.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 text-xs">
                {data.pagos.map((p: any) => (
                  <div key={p.id} className="p-3 hover:bg-slate-800/40 transition flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{p.membresia?.nombre || "General"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Pagado: {formatDate(p.fechaPago)} · Vence: <strong className="text-slate-200">{formatDate(p.fechaVencimiento)}</strong>
                      </p>
                    </div>
                    <span className="font-bold font-mono text-emerald-400 tabular-nums">
                      {formatMoney(p.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ASISTENCIAS */}
        {activeTab === "asistencias" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Registro de Entrenamientos
              </h3>
            </div>

            {data.ingresos?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium">
                Sin asistencias registradas aún.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 text-xs">
                {data.ingresos.map((ing: any) => (
                  <div key={ing.id} className="p-3 hover:bg-slate-800/40 transition flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{formatDate(ing.fechaHora)}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {new Date(ing.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                        {ing.horaSalida && ` a ${new Date(ing.horaSalida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                    </div>

                    {ing.duracionMinutos ? (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                        {ing.duracionMinutos} min
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">En sala</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AFORO */}
        {activeTab === "aforo" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Ocupación Actual
              </h3>
              <div className="p-5 bg-slate-950 rounded-lg border border-slate-800 text-center space-y-1">
                <h2 className="text-3xl font-bold text-white font-mono">{data.aforo?.personasAdentro || 0}</h2>
                <p className="text-xs text-slate-400">Socios en sala ahora</p>
                <p className="text-xs font-medium text-emerald-400">{data.aforo?.nivelTexto || "Ideal para entrenar"}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Horarios Sugeridos
              </h3>
              <div className="space-y-1.5 text-xs">
                {data.horasRecomendadas?.map((h: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{h.turno}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{h.rango}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                      {h.afluencia}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Desglose Ticket */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl max-w-xs w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 p-4 text-white text-center relative">
              <button
                onClick={() => setTicketModal(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <Receipt className="w-5 h-5 mx-auto mb-1 text-slate-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Detalle de Compra</h3>
              <p className="text-[10px] text-slate-400 font-mono">Ticket #{ticketModal.id}</p>
            </div>

            <div className="p-4 space-y-2.5 font-mono text-xs text-slate-800">
              <div className="text-center pb-2 border-b border-dashed border-slate-200">
                <p className="font-bold text-slate-900">{ticketModal.sucursal}</p>
                <p className="text-[10px] text-slate-500">{new Date(ticketModal.fechaVenta).toLocaleString("es-AR")}</p>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-slate-200 text-[11px]">
                {ticketModal.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between items-center">
                    <span className="truncate max-w-[160px]">{it.cantidad}x {it.nombre}</span>
                    <span className="font-bold tabular-nums">{formatMoney(it.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-0.5">
                <span>TOTAL:</span>
                <span className="text-sm font-mono text-slate-900 tabular-nums">{formatMoney(ticketModal.total)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setTicketModal(null)}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Pantalla Completa */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl p-5 max-w-xs w-full text-center space-y-3 shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-900">Código QR de Acceso</h3>
              <p className="text-[11px] text-slate-500">Muestra este código al escáner del molinete</p>
            </div>

            <div className="flex justify-center p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <QRCodeDisplay value={data.documento} size={180} />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800">{data.nombre} {data.apellido}</p>
              <p className="text-xs text-slate-500 font-mono">DNI: {data.documento}</p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Cambio Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl p-5 max-w-sm w-full border border-slate-800 shadow-2xl space-y-3 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {data.debeCambiarPassword ? "Actualiza tu Contraseña" : "Cambiar Contraseña"}
              </h3>
              {!data.debeCambiarPassword && (
                <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {passwordError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 rounded-lg text-xs font-medium text-center">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleCambiarPassword} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirmar Contraseña</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                {!data.debeCambiarPassword && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                >
                  {changingPassword ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
