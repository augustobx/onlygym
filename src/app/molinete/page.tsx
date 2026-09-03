"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock3,
  LogOut,
  RefreshCw,
  ScanLine,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { registrarIngresoMolinete, getUltimosIngresos } from "@/app/actions/accesos";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

type AccessState = "ESPERANDO" | "ACTIVO" | "VENCIDO" | "INACTIVO" | "NO_ENCONTRADO" | "DENEGADO" | "ERROR";
type AccessResult = {
  estado: AccessState;
  mensaje: string;
  clienteNombre?: string;
  clienteFoto?: string | null;
};
type HistoryItem = {
  id: number;
  fechaHora: string;
  estado: string;
  motivo?: string | null;
  cliente: { nombre: string; apellido: string };
};

function playSound(type: "success" | "denied") {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === "success" ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(type === "success" ? 620 : 220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === "success" ? 900 : 160, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // El audio es una ayuda operativa, nunca debe bloquear un ingreso.
  }
}

export default function MolinetePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState("Sede activa");
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<AccessResult>({ estado: "ESPERANDO", mensaje: "Escaneá el carnet QR o ingresá el DNI" });

  const loadHistory = useCallback(async (id: number) => {
    const response = await getUltimosIngresos(id);
    if (response.success && response.data) setHistory(response.data as unknown as HistoryItem[]);
  }, []);

  useEffect(() => {
    void (async () => {
      const context = await getStaffNavigationContext();
      if (!context.success || !context.data) {
        router.replace("/login");
        return;
      }
      if (!context.data.branchId || !context.data.branchName) {
        router.replace("/seleccionar-sucursal");
        return;
      }
      setBranchId(context.data.branchId);
      setBranchName(context.data.branchName);
      await loadHistory(context.data.branchId);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    })();
  }, [loadHistory, router]);

  useEffect(() => {
    if (!branchId) return;
    const poll = window.setInterval(() => void loadHistory(branchId), 15_000);
    return () => window.clearInterval(poll);
  }, [branchId, loadHistory]);

  useEffect(() => () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const processCredential = useCallback(async (raw: string) => {
    if (!branchId || loading) return;
    const clean = raw.trim();
    if (!clean) return;

    setLoading(true);
    const response = await registrarIngresoMolinete(clean, branchId);
    const state = (response.estado || "ERROR") as AccessState;
    const success = response.success && state === "ACTIVO";
    setResult({
      estado: state,
      mensaje: response.mensaje || response.error || (success ? "Acceso concedido" : "Acceso denegado"),
      clienteNombre: response.cliente ? `${response.cliente.nombre} ${response.cliente.apellido}` : undefined,
      clienteFoto: response.cliente?.foto || null,
    });
    if (soundEnabled) playSound(success ? "success" : "denied");
    setCredential("");
    await loadHistory(branchId);
    setLoading(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
    window.setTimeout(() => setResult({ estado: "ESPERANDO", mensaje: "Escaneá el carnet QR o ingresá el DNI" }), 5_000);
  }, [branchId, loadHistory, loading, soundEnabled]);

  async function toggleCamera() {
    if (cameraActive) {
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
      return;
    }

    setCameraError(null);
    const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Detector) {
      setCameraError("Este navegador no permite leer QR con cámara. Podés usar un lector USB/Bluetooth o ingresar el DNI.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || loading) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setCameraActive(false);
            await processCredential(value);
          }
        } catch {
          // Se continúa intentando mientras la cámara esté activa.
        }
      }, 450);
    } catch {
      setCameraError("No se pudo abrir la cámara. Revisá los permisos del navegador.");
    }
  }

  const success = result.estado === "ACTIVO";
  const waiting = result.estado === "ESPERANDO";
  const surface = waiting
    ? "bg-slate-950"
    : success
      ? "bg-emerald-950"
      : result.estado === "ERROR"
        ? "bg-amber-950"
        : "bg-rose-950";

  return (
    <main className={`min-h-dvh transition-colors ${surface} text-white lg:grid lg:grid-cols-[1fr_360px]`}>
      <section className="relative flex min-h-[70dvh] flex-col items-center justify-center px-5 py-24 lg:min-h-dvh">
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
          <button onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-200">
            <LogOut className="h-4 w-4" /> Panel
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20" title={soundEnabled ? "Silenciar" : "Activar sonido"}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-300" />}
            </button>
            <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black">{branchName}</span>
          </div>
        </div>

        <div className="w-full max-w-xl text-center">
          <div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-[32px] border border-white/15 bg-black/20 shadow-2xl">
            {result.clienteFoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.clienteFoto} alt={result.clienteNombre || "Socio"} className="h-full w-full object-cover" />
            ) : waiting ? (
              <ScanLine className="h-16 w-16 animate-pulse text-cyan-300" />
            ) : success ? (
              <CheckCircle2 className="h-20 w-20 text-emerald-300" />
            ) : result.estado === "ERROR" ? (
              <AlertCircle className="h-20 w-20 text-amber-300" />
            ) : (
              <XCircle className="h-20 w-20 text-rose-300" />
            )}
          </div>

          {result.clienteNombre && <h1 className="mt-6 text-3xl font-black">{result.clienteNombre}</h1>}
          <p className={`mt-4 text-xl font-black ${waiting ? "text-slate-300" : success ? "text-emerald-200" : "text-white"}`}>{result.mensaje}</p>

          <form
            className="mx-auto mt-8 max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              void processCredential(credential);
            }}
          >
            <input
              ref={inputRef}
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              disabled={!branchId || loading}
              autoComplete="off"
              inputMode="text"
              placeholder="DNI o lectura del scanner"
              className="h-14 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-center text-lg font-black outline-none placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50"
            />
            <button disabled={!credential.trim() || loading || !branchId} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 text-sm font-black text-slate-950 disabled:opacity-40">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Validar ingreso
            </button>
          </form>

          <div className="mx-auto mt-4 max-w-md">
            <button onClick={() => void toggleCamera()} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-black">
              {cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraActive ? "Cerrar cámara" : "Escanear QR con cámara"}
            </button>
            {cameraError && <p className="mt-2 rounded-xl bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">{cameraError}</p>}
          </div>

          <video ref={videoRef} muted playsInline className={`${cameraActive ? "mt-4 block" : "hidden"} mx-auto aspect-square w-full max-w-sm rounded-3xl border border-white/15 bg-black object-cover`} />
        </div>
      </section>

      <aside className="border-t border-white/10 bg-[#0b0f15] p-5 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-400">Terminal</p><h2 className="mt-1 text-lg font-black">Últimos ingresos</h2></div>
          <button disabled={!branchId} onClick={() => branchId && void loadHistory(branchId)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-400"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-2">
          {history.length ? history.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/7 bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-black">{item.cliente.nombre} {item.cliente.apellido}</p><p className="mt-1 truncate text-[10px] text-slate-500">{item.motivo || "Registro de acceso"}</p></div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.estado === "ACTIVO" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{item.estado}</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-600"><Clock3 className="h-3 w-3" />{new Date(item.fechaHora).toLocaleString("es-AR")}</p>
            </article>
          )) : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-600">Todavía no hay movimientos.</p>}
        </div>
      </aside>
    </main>
  );
}
