"use client";

import { useState, useEffect, useRef } from "react";
import { registrarIngresoMolinete, getUltimosIngresos } from "@/app/actions/accesos";
import { 
  LogOut, 
  ScanFace, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Camera, 
  CameraOff, 
  Volume2, 
  VolumeX, 
  Clock
} from "lucide-react";
import { useRouter } from "next/navigation";

function playSound(type: "success" | "denied") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "success") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (err) {
    console.error("Audio error:", err);
  }
}

export default function MolinetePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [sucursalName, setSucursalName] = useState<string>("");
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [ultimoResultado, setUltimoResultado] = useState<{
    estado: "ESPERANDO" | "ACTIVO" | "VENCIDO" | "ERROR" | "DENEGADO";
    mensaje: string;
    clienteNombre?: string;
    clienteFoto?: string | null;
  }>({
    estado: "ESPERANDO",
    mensaje: "Escanea tu DNI o Código QR para ingresar",
  });

  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    if (!sId) {
      router.push("/seleccionar-sucursal");
      return;
    }
    const parsedId = parseInt(sId);
    setSucursalId(parsedId);
    setSucursalName(sName || "Sede Principal");
    cargarHistorial(parsedId);

    const keepFocus = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1500);

    return () => clearInterval(keepFocus);
  }, [router]);

  const cargarHistorial = async (id: number) => {
    const res = await getUltimosIngresos(id);
    if (res.success && res.data) {
      setHistorial(res.data);
    }
  };

  const procesarIngreso = async (documento: string) => {
    if (!documento.trim() || !sucursalId || loading) return;
    setLoading(true);

    const res = await registrarIngresoMolinete(documento.trim(), sucursalId);

    if (res.success) {
      setUltimoResultado({
        estado: res.estado as any,
        mensaje: res.mensaje || (res.estado === "ACTIVO" ? "¡Acceso Concedido!" : "Cuota Vencida"),
        clienteNombre: res.cliente ? `${res.cliente.nombre} ${res.cliente.apellido}` : undefined,
        clienteFoto: res.cliente?.foto || null,
      });

      if (soundEnabled) {
        if (res.estado === "ACTIVO") {
          playSound("success");
        } else {
          playSound("denied");
        }
      }

      cargarHistorial(sucursalId);
    } else {
      setUltimoResultado({
        estado: (res.estado as any) || "ERROR",
        mensaje: res.error || "Acceso Denegado",
        clienteNombre: res.cliente ? `${res.cliente.nombre} ${res.cliente.apellido}` : undefined,
        clienteFoto: res.cliente?.foto || null,
      });

      if (soundEnabled) playSound("denied");
    }

    setLoading(false);
    setDni("");

    setTimeout(() => {
      setUltimoResultado({
        estado: "ESPERANDO",
        mensaje: "Escanea tu DNI o Código QR para ingresar",
        clienteFoto: null,
      });
    }, 5000);
  };

  const handleScanForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await procesarIngreso(dni);
  };

  const bgConfig = {
    ESPERANDO: "bg-slate-950",
    ACTIVO: "bg-emerald-950 text-white",
    VENCIDO: "bg-rose-950 text-white",
    DENEGADO: "bg-rose-950 text-white",
    ERROR: "bg-amber-950 text-white",
  }[ultimoResultado.estado] || "bg-slate-950";

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-500 font-sans ${bgConfig}`}>
      
      {/* Surface Principal Molinete */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-white relative min-h-[550px]">
        
        {/* Top Controls */}
        <div className="absolute top-5 left-5 right-5 flex items-center justify-between z-20">
          <button 
            onClick={() => router.push("/dashboard")}
            className="flex items-center text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Panel Admin</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white transition"
              title={soundEnabled ? "Silenciar audio" : "Activar sonido"}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-rose-400" />}
            </button>

            <span className="text-xs font-medium text-slate-300 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              📍 {sucursalName}
            </span>
          </div>
        </div>

        {/* Central Display */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-xl">
          
          {/* Avatar / Reconocimiento */}
          <div className="relative animate-in zoom-in duration-200">
            {ultimoResultado.clienteFoto ? (
              <div className="relative">
                <img
                  src={ultimoResultado.clienteFoto}
                  alt={ultimoResultado.clienteNombre || "Socio"}
                  className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-cover border-2 border-white/80 shadow-2xl"
                />
                <div className="absolute -bottom-2 -right-2 p-1.5 bg-slate-950 rounded-full shadow-lg border border-slate-800">
                  {ultimoResultado.estado === "ACTIVO" ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-500" />
                  )}
                </div>
              </div>
            ) : (
              <div>
                {ultimoResultado.estado === "ESPERANDO" && (
                  <div className="w-36 h-36 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg">
                    <ScanFace className="w-16 h-16 text-slate-500 animate-pulse" />
                  </div>
                )}
                {ultimoResultado.estado === "ACTIVO" && (
                  <div className="w-36 h-36 rounded-xl bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-20 h-20 text-emerald-400" />
                  </div>
                )}
                {(ultimoResultado.estado === "VENCIDO" || ultimoResultado.estado === "DENEGADO") && (
                  <div className="w-36 h-36 rounded-xl bg-rose-900/60 border border-rose-500/50 flex items-center justify-center shadow-lg">
                    <XCircle className="w-20 h-20 text-rose-400" />
                  </div>
                )}
                {ultimoResultado.estado === "ERROR" && (
                  <div className="w-36 h-36 rounded-xl bg-amber-900/60 border border-amber-500/50 flex items-center justify-center shadow-lg">
                    <AlertCircle className="w-20 h-20 text-amber-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nombre */}
          {ultimoResultado.clienteNombre && (
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              {ultimoResultado.clienteNombre}
            </h1>
          )}
          
          {/* Mensaje de Estado */}
          <h2 className="text-lg sm:text-2xl font-medium text-slate-200">
            {ultimoResultado.mensaje}
          </h2>
        </div>

        {/* Input invisible para pistola USB o teclado */}
        <form onSubmit={handleScanForm} className="absolute bottom-5 opacity-30 hover:opacity-100 transition">
          <input
            ref={inputRef}
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="DNI o Tarjeta..."
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 text-white placeholder-slate-500 border border-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
            autoComplete="off"
          />
        </form>
      </div>

      {/* Panel Lateral: Historial de Accesos */}
      <div className="w-full lg:w-80 bg-slate-900/90 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>Últimos Accesos</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">En vivo</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] lg:max-h-none pr-1">
          {historial.map((ingreso) => {
            const esOk = ingreso.estado === "ACTIVO" || ingreso.estado === "permitido";

            return (
              <div 
                key={ingreso.id} 
                className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                  esOk 
                    ? "bg-slate-950 border-slate-800" 
                    : "bg-rose-950/40 border-rose-900/60"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-white truncate">
                    {ingreso.cliente?.nombre} {ingreso.cliente?.apellido}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">DNI: {ingreso.documento}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                    esOk ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-rose-950 text-rose-400 border-rose-800"
                  }`}>
                    {esOk ? "PERMITIDO" : ingreso.estado}
                  </span>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                    {new Date(ingreso.fechaHora).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}

          {historial.length === 0 && (
            <p className="text-slate-500 text-center text-xs py-8 font-medium">
              Sin ingresos registrados hoy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
