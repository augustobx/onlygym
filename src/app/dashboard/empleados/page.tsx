"use client";

import { useEffect, useState } from "react";
import { getEmpleados, updateEmpleado, toggleEmpleadoEstado } from "@/app/actions/empleados";
import { UserCog, Edit2, X, CheckCircle2, AlertCircle, Shield } from "lucide-react";

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ name: "", nivel: "cajero" });
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const load = () => { getEmpleados().then(r => r.success && setEmpleados(r.data!)); };
  useEffect(() => { load(); }, []);

  const openEdit = (e: any) => {
    setEditando(e);
    setForm({ name: e.name, nivel: e.nivel });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    const result = await updateEmpleado(editando.id, form);
    if (result.success) { 
      setShowModal(false); 
      setMsg({ type: "success", text: "Datos del empleado actualizados" }); 
      load(); 
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: result.error || "Error" });
    }
  };

  const handleToggle = async (e: any) => {
    await toggleEmpleadoEstado(e.id, e.estado);
    load();
  };

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="h-5 w-5 text-cyan-600" />
            Personal & Staff
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Administra los usuarios del sistema, niveles de acceso y sedes asignadas.
          </p>
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

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left">Nombre</th>
                <th className="px-4 py-2.5 text-left">Usuario</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-center">Nivel</th>
                <th className="px-4 py-2.5 text-center">Sedes</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {empleados.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{e.name}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px] font-semibold">{e.username || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.email}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      e.nivel === "admin" 
                        ? "bg-cyan-50 text-cyan-800 border-cyan-300" 
                        : e.nivel === "supervisor" 
                        ? "bg-blue-50 text-blue-800 border-blue-300" 
                        : "bg-slate-100 text-slate-800 border-slate-300"
                    }`}>
                      {e.nivel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-800">{e.sucursales?.length || 0}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      e.estado === "activo" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      {e.estado === "activo" ? "● Activo" : "● Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-1">
                    <button
                      onClick={() => openEdit(e)}
                      className="px-2 py-1 bg-white hover:bg-cyan-50 hover:text-cyan-800 text-slate-800 rounded-md text-xs font-semibold border border-slate-300 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggle(e)}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-300 transition"
                    >
                      {e.estado === "activo" ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Editar Empleado</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nivel de Acceso</label>
                <select
                  value={form.nivel}
                  onChange={e => setForm({ ...form, nivel: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-bold"
                >
                  <option value="cajero">Cajero / Recepción</option>
                  <option value="supervisor">Supervisor de Sede</option>
                  <option value="admin">Administrador Total</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
