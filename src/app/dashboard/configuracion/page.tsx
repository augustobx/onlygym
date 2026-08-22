"use client";

import { useEffect, useState } from "react";
import { 
  getAllMembresias, 
  createMembresiaFull, 
  updateMembresia, 
  toggleMembresiaEstado 
} from "@/app/actions/configuracion";
import { 
  getHorariosSemana, 
  guardarHorariosSemana, 
  HorarioDiaInput 
} from "@/app/actions/horarios";
import {
  getAllSucursalesAdmin,
  createSucursal,
  updateSucursal,
  toggleSucursalEstado
} from "@/app/actions/sucursales";
import { 
  Settings, 
  Plus, 
  X, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Building2, 
  MapPin, 
  Edit2
} from "lucide-react";

function formatMoney(n: any) {
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

const NOMBRES_DIAS: { [key: number]: string } = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  0: "Domingo",
};

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<"membresias" | "horarios" | "sucursales">("membresias");
  const [sucursalId, setSucursalId] = useState<number>(1);
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");

  // Membresías
  const [membresias, setMembresias] = useState<any[]>([]);
  const [showModalMembresia, setShowModalMembresia] = useState(false);
  const [editandoMembresia, setEditandoMembresia] = useState<any>(null);
  const [formMembresia, setFormMembresia] = useState({ nombre: "", diasDuracion: "", precio: "", descripcion: "" });

  // Horarios
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [guardandoHorarios, setGuardandoHorarios] = useState(false);

  // Sucursales
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [showModalSucursal, setShowModalSucursal] = useState(false);
  const [editandoSucursal, setEditandoSucursal] = useState<any>(null);
  const [formSucursal, setFormSucursal] = useState({ nombre: "", direccion: "", capacidadMaxima: "50" });
  const [guardandoSucursal, setGuardandoSucursal] = useState(false);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    const id = sId ? parseInt(sId) : 1;
    setSucursalId(id);
    if (sName) setSucursalNombre(sName);

    loadMembresias();
    loadHorarios(id);
    loadSucursales();
  }, []);

  const loadMembresias = () => {
    getAllMembresias().then(r => r.success && setMembresias(r.data!));
  };

  const loadHorarios = (sid: number) => {
    setLoadingHorarios(true);
    getHorariosSemana(sid).then(r => {
      if (r.success && r.data) setHorarios(r.data);
      setLoadingHorarios(false);
    });
  };

  const loadSucursales = () => {
    setLoadingSucursales(true);
    getAllSucursalesAdmin().then(r => {
      if (r.success && r.data) setSucursales(r.data);
      setLoadingSucursales(false);
    });
  };

  // Handlers Membresías
  const openNewMembresia = () => {
    setEditandoMembresia(null);
    setFormMembresia({ nombre: "", diasDuracion: "30", precio: "", descripcion: "" });
    setShowModalMembresia(true);
  };

  const openEditMembresia = (m: any) => {
    setEditandoMembresia(m);
    setFormMembresia({
      nombre: m.nombre,
      diasDuracion: String(m.diasDuracion),
      precio: String(m.precio),
      descripcion: m.descripcion || "",
    });
    setShowModalMembresia(true);
  };

  const handleSubmitMembresia = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      nombre: formMembresia.nombre,
      diasDuracion: Number(formMembresia.diasDuracion),
      precio: Number(formMembresia.precio),
      descripcion: formMembresia.descripcion || undefined,
    };

    const res = editandoMembresia
      ? await updateMembresia(editandoMembresia.id, data)
      : await createMembresiaFull(data);

    if (res.success) {
      setShowModalMembresia(false);
      setMsg({ type: "success", text: editandoMembresia ? "Plan actualizado" : "Plan creado con éxito" });
      loadMembresias();
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error" });
    }
  };

  const handleToggleMembresia = async (m: any) => {
    const res = await toggleMembresiaEstado(m.id, m.estado);
    if (res.success) {
      const nuevo = m.estado === "activo" ? "inactivo" : "activo";
      setMsg({ type: "success", text: `Plan '${m.nombre}' actualizado a ${nuevo}` });
      loadMembresias();
      setTimeout(() => setMsg(null), 3000);
    }
  };

  // Handlers Horarios
  const handleHorarioFieldChange = (index: number, field: string, value: any) => {
    setHorarios(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleGuardarHorarios = async () => {
    setGuardandoHorarios(true);
    const payload: HorarioDiaInput[] = horarios.map(h => ({
      diaSemana: h.diaSemana,
      tipoApertura: h.tipoApertura,
      horaApertura1: h.horaApertura1,
      horaCierre1: h.horaCierre1,
      horaApertura2: h.horaApertura2 || undefined,
      horaCierre2: h.horaCierre2 || undefined,
      activo: h.activo,
      capacidadMaxima: Number(h.capacidadMaxima || 50),
    }));

    const res = await guardarHorariosSemana(sucursalId, payload);
    if (res.success) {
      setMsg({ type: "success", text: "Horarios y aforo de la sede guardados correctamente." });
      loadHorarios(sucursalId);
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error al guardar horarios" });
    }
    setGuardandoHorarios(false);
  };

  // Handlers Sucursales
  const openNewSucursal = () => {
    setEditandoSucursal(null);
    setFormSucursal({ nombre: "", direccion: "", capacidadMaxima: "50" });
    setShowModalSucursal(true);
  };

  const openEditSucursal = (s: any) => {
    setEditandoSucursal(s);
    setFormSucursal({
      nombre: s.nombre,
      direccion: s.direccion || "",
      capacidadMaxima: String(s.capacidadMaxima || 50),
    });
    setShowModalSucursal(true);
  };

  const handleSubmitSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoSucursal(true);

    const res = editandoSucursal
      ? await updateSucursal(editandoSucursal.id, {
          nombre: formSucursal.nombre,
          direccion: formSucursal.direccion,
          capacidadMaxima: Number(formSucursal.capacidadMaxima),
        })
      : await createSucursal({
          nombre: formSucursal.nombre,
          direccion: formSucursal.direccion,
          capacidadMaxima: Number(formSucursal.capacidadMaxima),
        });

    if (res.success) {
      setShowModalSucursal(false);
      setMsg({ type: "success", text: editandoSucursal ? "Sede actualizada" : "Nueva sede creada" });
      loadSucursales();
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: res.error || "Error" });
    }
    setGuardandoSucursal(false);
  };

  const handleToggleSucursal = async (s: any) => {
    const res = await toggleSucursalEstado(s.id, s.estado);
    if (res.success) {
      setMsg({ type: "success", text: `Sede '${s.nombre}' actualizada a ${res.nuevoEstado}` });
      loadSucursales();
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-600" />
            Configuración del Sistema
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Planes de membresía, horarios y aforo por sede, y gestión de sucursales.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200 text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("membresias")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "membresias"
                ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-cyan-600" />
            <span>Membresías</span>
          </button>

          <button
            onClick={() => setActiveTab("horarios")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "horarios"
                ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-cyan-600" />
            <span>Horarios & Aforo</span>
          </button>

          <button
            onClick={() => setActiveTab("sucursales")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "sucursales"
                ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-cyan-600" />
            <span>Sedes ({sucursales.length})</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
          msg.type === "success" 
            ? "bg-emerald-50 text-emerald-900 border-emerald-300" 
            : "bg-rose-50 text-rose-900 border-rose-300"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertCircle className="h-4 w-4 text-rose-700" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* TAB 1: MEMBRESÍAS */}
      {activeTab === "membresias" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Catálogo de Planes</h3>
              <p className="text-xs text-slate-600 font-medium">Define los planes de acceso, duración y precios.</p>
            </div>
            <button
              onClick={openNewMembresia}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nuevo Plan</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Plan</th>
                    <th className="px-4 py-2.5 text-left">Duración</th>
                    <th className="px-4 py-2.5 text-left">Descripción</th>
                    <th className="px-4 py-2.5 text-right">Precio</th>
                    <th className="px-4 py-2.5 text-center">Estado</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {membresias.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{m.nombre}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{m.diasDuracion} días</td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{m.descripcion || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">{formatMoney(Number(m.precio))}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.estado === "activo" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                          {m.estado === "activo" ? "● Activo" : "● Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <button
                          onClick={() => openEditMembresia(m)}
                          className="px-2 py-1 bg-white hover:bg-cyan-50 hover:text-cyan-800 text-slate-800 rounded-md text-xs font-semibold border border-slate-300 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleMembresia(m)}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-300 transition"
                        >
                          {m.estado === "activo" ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HORARIOS & AFORO */}
      {activeTab === "horarios" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Horarios & Capacidad Máxima — {sucursalNombre}
              </h3>
              <p className="text-xs text-slate-600 font-medium">Configura apertura, corte de turno y aforo para cada día.</p>
            </div>
            <button
              onClick={handleGuardarHorarios}
              disabled={guardandoHorarios}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{guardandoHorarios ? "Guardando..." : "Guardar Horarios"}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Día</th>
                    <th className="px-4 py-2.5 text-center">Estado</th>
                    <th className="px-4 py-2.5 text-center">Modalidad</th>
                    <th className="px-4 py-2.5 text-center">Turno Mañana</th>
                    <th className="px-4 py-2.5 text-center">Turno Tarde</th>
                    <th className="px-4 py-2.5 text-center">Aforo Máx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {horarios.map((h, idx) => (
                    <tr key={h.diaSemana} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{NOMBRES_DIAS[h.diaSemana]}</td>
                      <td className="px-4 py-2.5 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={h.activo}
                            onChange={e => handleHorarioFieldChange(idx, "activo", e.target.checked)}
                            className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                          />
                        </label>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <select
                          value={h.tipoApertura}
                          onChange={e => handleHorarioFieldChange(idx, "tipoApertura", e.target.value)}
                          className="bg-white border border-slate-300 text-slate-900 rounded px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="corrido">Corrido</option>
                          <option value="cortado">Cortado (2 turnos)</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono">
                          <input
                            type="time"
                            value={h.horaApertura1}
                            onChange={e => handleHorarioFieldChange(idx, "horaApertura1", e.target.value)}
                            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                          />
                          <span className="text-slate-600 font-bold">a</span>
                          <input
                            type="time"
                            value={h.horaCierre1}
                            onChange={e => handleHorarioFieldChange(idx, "horaCierre1", e.target.value)}
                            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {h.tipoApertura === "cortado" ? (
                          <div className="flex items-center justify-center gap-1 font-mono">
                            <input
                              type="time"
                              value={h.horaApertura2 || ""}
                              onChange={e => handleHorarioFieldChange(idx, "horaApertura2", e.target.value)}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                            />
                            <span className="text-slate-600 font-bold">a</span>
                            <input
                              type="time"
                              value={h.horaCierre2 || ""}
                              onChange={e => handleHorarioFieldChange(idx, "horaCierre2", e.target.value)}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          value={h.capacidadMaxima}
                          onChange={e => handleHorarioFieldChange(idx, "capacidadMaxima", e.target.value)}
                          className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center font-mono text-slate-900 font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUCURSALES */}
      {activeTab === "sucursales" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Gestión de Sedes</h3>
              <p className="text-xs text-slate-600 font-medium">Agrega o administra las sedes del gimnasio.</p>
            </div>
            <button
              onClick={openNewSucursal}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nueva Sede</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Sede</th>
                    <th className="px-4 py-2.5 text-left">Dirección</th>
                    <th className="px-4 py-2.5 text-center">Aforo Máx</th>
                    <th className="px-4 py-2.5 text-center">Socios Asignados</th>
                    <th className="px-4 py-2.5 text-center">Estado</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sucursales.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />
                        <span>{s.nombre}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{s.direccion || "—"}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold text-slate-800">{s.capacidadMaxima} pers.</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-900">{s._count?.clientes || 0}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.estado === "activo" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                          {s.estado === "activo" ? "● Activa" : "● Inactiva"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <button
                          onClick={() => openEditSucursal(s)}
                          className="px-2 py-1 bg-white hover:bg-cyan-50 hover:text-cyan-800 text-slate-800 rounded-md text-xs font-semibold border border-slate-300 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleSucursal(s)}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-300 transition"
                        >
                          {s.estado === "activo" ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Membresía */}
      {showModalMembresia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editandoMembresia ? "Editar Plan" : "Nuevo Plan de Membresía"}
              </h3>
              <button onClick={() => setShowModalMembresia(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMembresia} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Plan *</label>
                <input
                  required
                  value={formMembresia.nombre}
                  onChange={e => setFormMembresia({ ...formMembresia, nombre: e.target.value })}
                  placeholder="Ej: Pase Mensual Full"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duración (Días) *</label>
                  <input
                    type="number"
                    required
                    value={formMembresia.diasDuracion}
                    onChange={e => setFormMembresia({ ...formMembresia, diasDuracion: e.target.value })}
                    placeholder="30"
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formMembresia.precio}
                    onChange={e => setFormMembresia({ ...formMembresia, precio: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formMembresia.descripcion}
                  onChange={e => setFormMembresia({ ...formMembresia, descripcion: e.target.value })}
                  placeholder="Acceso libre a sala de musculación..."
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalMembresia(false)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition"
                >
                  {editandoMembresia ? "Guardar" : "Crear Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sucursal */}
      {showModalSucursal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editandoSucursal ? "Editar Sede" : "Nueva Sede / Sucursal"}
              </h3>
              <button onClick={() => setShowModalSucursal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSucursal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre de la Sede *</label>
                <input
                  required
                  value={formSucursal.nombre}
                  onChange={e => setFormSucursal({ ...formSucursal, nombre: e.target.value })}
                  placeholder="Ej: Sede Centro"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección</label>
                <input
                  value={formSucursal.direccion}
                  onChange={e => setFormSucursal({ ...formSucursal, direccion: e.target.value })}
                  placeholder="Ej: Av. Principal 450"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Capacidad Máxima (Aforo)</label>
                <input
                  type="number"
                  required
                  value={formSucursal.capacidadMaxima}
                  onChange={e => setFormSucursal({ ...formSucursal, capacidadMaxima: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalSucursal(false)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoSucursal}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition"
                >
                  {guardandoSucursal ? "Guardando..." : editandoSucursal ? "Guardar" : "Crear Sede"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
