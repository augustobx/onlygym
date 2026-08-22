"use client";

import { useEffect, useState } from "react";
import { 
  getAforoEnVivo, 
  registrarSalidaSocio, 
  registrarSalidaPorDocumento, 
  marcarSalidaTodos 
} from "@/app/actions/horarios";
import { 
  Users, 
  Activity, 
  Clock, 
  LogOut, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  Timer, 
  ArrowRight
} from "lucide-react";

export default function AforoTiempoRealPage() {
  const [sucursalId, setSucursalId] = useState<number>(1);
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");

  const [aforo, setAforo] = useState<any>({
    personasAdentro: 0,
    capacidadMaxima: 50,
    porcentaje: 0,
    nivel: "bajo",
    nivelTexto: "Ocupación baja, ideal para entrenar",
    duracionPromedio: 0,
    personasPresentes: [],
    ultimasSalidas: [],
  });

  const [loading, setLoading] = useState(true);
  const [searchPresentes, setSearchPresentes] = useState("");
  const [dniSalida, setDniSalida] = useState("");
  const [loadingSalida, setLoadingSalida] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    const id = sId ? parseInt(sId) : 1;
    setSucursalId(id);
    if (sName) setSucursalNombre(sName);

    loadAforo(id);

    const interval = setInterval(() => {
      loadAforo(id, false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadAforo = async (sId?: number, showLoading = true) => {
    if (showLoading) setLoading(true);
    const sid = sId || sucursalId;
    const res = await getAforoEnVivo(sid);
    if (res.success && res.data) {
      setAforo(res.data);
    }
    if (showLoading) setLoading(false);
  };

  const handleSalidaIndividual = async (ingresoId: number, nombre: string) => {
    const res = await registrarSalidaSocio(ingresoId);
    if (res.success) {
      setMsg({
        type: "success",
        text: `Salida registrada para ${nombre}. Permanencia: ${res.duracionMinutos} min.`,
      });
      loadAforo(sucursalId, false);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error al marcar salida" });
    }
  };

  const handleSalidaDni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dniSalida.trim()) return;

    setLoadingSalida(true);
    const res = await registrarSalidaPorDocumento(dniSalida.trim(), sucursalId);
    if (res.success) {
      setMsg({ type: "success", text: res.mensaje || "Salida procesada con éxito" });
      setDniSalida("");
      loadAforo(sucursalId, false);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "No se encontró el ingreso" });
    }
    setLoadingSalida(false);
  };

  const handleSalidaTodos = async () => {
    if (!confirm("¿Deseas marcar la salida de todos los socios activos en este momento?")) return;
    const res = await marcarSalidaTodos(sucursalId);
    if (res.success) {
      setMsg({ type: "success", text: `Salida registrada para ${res.count} personas.` });
      loadAforo(sucursalId, false);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error" });
    }
  };

  const personasFiltradas = aforo.personasPresentes.filter((p: any) => {
    if (!searchPresentes) return true;
    const q = searchPresentes.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || p.documento.includes(q);
  });

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            Aforo & Ocupación en Tiempo Real
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Sede: <strong className="text-slate-800">{sucursalNombre}</strong> — Monitoreo en vivo de permanencia en sala.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAforo(sucursalId, true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {aforo.personasAdentro > 0 && (
            <button
              onClick={handleSalidaTodos}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Salida Masiva</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
          msg.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Monitor Central de Ocupación */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Monitoreo Activo · {aforo.nivelTexto}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono text-slate-900 tabular-nums">{aforo.personasAdentro}</span>
              <span className="text-sm font-medium text-slate-500">/ {aforo.capacidadMaxima} capacidad máx.</span>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <span className="text-xs text-slate-500 font-medium">Permanencia Promedio</span>
            <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{aforo.duracionPromedio} min</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, aforo.porcentaje)}%` }}
              className={`h-full rounded-full transition-all ${
                aforo.porcentaje >= 85 ? "bg-rose-500" : aforo.porcentaje >= 60 ? "bg-amber-500" : "bg-indigo-600"
              }`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>0 personas</span>
            <span>{aforo.porcentaje}% de ocupación</span>
            <span>{aforo.capacidadMaxima} personas máx.</span>
          </div>
        </div>
      </div>

      {/* Grid: Personas adentro + Marcar Salida */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Personas Presentes (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span>Socios en Sala ({aforo.personasPresentes.length})</span>
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchPresentes}
                onChange={e => setSearchPresentes(e.target.value)}
                placeholder="Buscar socio presente..."
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Socio</th>
                  <th className="px-4 py-2.5">Hora Entrada</th>
                  <th className="px-4 py-2.5">Tiempo en Sala</th>
                  <th className="px-4 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {personasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium">
                      No hay socios presentes en este momento.
                    </td>
                  </tr>
                ) : (
                  personasFiltradas.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {p.nombre}
                        <span className="text-[10px] text-slate-500 font-mono block font-normal">DNI: {p.documento}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{p.horaEntrada}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
                          <Clock className="w-3 h-3" />
                          {p.minutosAdentro} min
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleSalidaIndividual(p.id, p.nombre)}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-md text-xs font-medium transition"
                        >
                          Marcar Salida
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Salida Rápida por DNI (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <LogOut className="h-4 w-4 text-slate-600" />
              Salida Manual por DNI
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Si el socio no marcó salida en el molinete.</p>
          </div>

          <form onSubmit={handleSalidaDni} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">DNI del Socio</label>
              <input
                type="text"
                required
                value={dniSalida}
                onChange={e => setDniSalida(e.target.value)}
                placeholder="Número de documento..."
                className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-mono font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loadingSalida || !dniSalida}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50 transition"
            >
              {loadingSalida ? "Procesando..." : "Registrar Salida"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
