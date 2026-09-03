"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, KeyRound, Search, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { getEmpleados, toggleEmpleadoEstado, updateEmpleado } from "@/app/actions/empleados";
import { getAllSucursalesAdmin } from "@/app/actions/sucursales";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";

type Employee = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  nivel: "owner" | "admin" | "recepcion" | "entrenador";
  rolTenant: "OWNER" | "ADMIN" | "RECEPCION" | "ENTRENADOR";
  estado: string;
  identidadCompartida: boolean;
  isSelf: boolean;
  sucursales: Array<{ id: number; nombre: string; estado: string }>;
};

type Branch = { id: number; nombre: string; estado: string };
type Notice = { type: "success" | "error"; text: string } | null;

const roleLabels: Record<Employee["nivel"], string> = {
  owner: "Owner",
  admin: "Administrador",
  recepcion: "Recepción",
  entrenador: "Entrenador",
};

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [actorRole, setActorRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; nivel: string; sucursalIds: number[] }>({ name: "", nivel: "recepcion", sucursalIds: [] });

  const load = async () => {
    const [staffResult, branchResult, navResult] = await Promise.all([
      getEmpleados(),
      getAllSucursalesAdmin(),
      getStaffNavigationContext(),
    ]);
    if (staffResult.success && staffResult.data) setEmpleados(staffResult.data as unknown as Employee[]);
    else setNotice({ type: "error", text: staffResult.error || "No se pudo cargar el personal" });
    if (branchResult.success && branchResult.data) setBranches(branchResult.data as unknown as Branch[]);
    if (navResult.success && navResult.data) setActorRole(navResult.data.role);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter((employee) => [employee.name, employee.email, employee.username || "", roleLabels[employee.nivel]].some((value) => value.toLowerCase().includes(q)));
  }, [empleados, search]);

  const metrics = useMemo(() => ({
    active: empleados.filter((employee) => employee.estado === "activo").length,
    admins: empleados.filter((employee) => employee.rolTenant === "OWNER" || employee.rolTenant === "ADMIN").length,
    reception: empleados.filter((employee) => employee.rolTenant === "RECEPCION").length,
    trainers: empleados.filter((employee) => employee.rolTenant === "ENTRENADOR").length,
  }), [empleados]);

  const openEdit = (employee: Employee) => {
    if (employee.rolTenant === "OWNER" && !employee.isSelf) {
      setNotice({ type: "error", text: "La cuenta OWNER sólo puede ser administrada por su propio titular." });
      return;
    }
    setEditing(employee);
    setForm({
      name: employee.name,
      nivel: employee.nivel,
      sucursalIds: employee.sucursales.filter((branch) => branch.estado === "activo").map((branch) => branch.id),
    });
    setNotice(null);
  };

  const toggleBranch = (branchId: number) => {
    setForm((current) => ({
      ...current,
      sucursalIds: current.sucursalIds.includes(branchId)
        ? current.sucursalIds.filter((id) => id !== branchId)
        : [...current.sucursalIds, branchId],
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    const branchBound = form.nivel === "recepcion" || form.nivel === "entrenador";
    const result = await updateEmpleado(editing.id, {
      name: form.name,
      nivel: editing.rolTenant === "OWNER" ? undefined : form.nivel,
      sucursalIds: branchBound ? form.sucursalIds : [],
    });
    if (result.success) {
      setEditing(null);
      setNotice({ type: "success", text: "Acceso del empleado actualizado." });
      await load();
    } else {
      setNotice({ type: "error", text: result.error || "No se pudo actualizar el empleado" });
    }
    setSaving(false);
  };

  const handleToggle = async (employee: Employee) => {
    const verb = employee.estado === "activo" ? "desactivar" : "activar";
    if (!window.confirm(`¿${verb.charAt(0).toUpperCase() + verb.slice(1)} el acceso de ${employee.name}?`)) return;
    const result = await toggleEmpleadoEstado(employee.id, employee.estado);
    setNotice(result.success
      ? { type: "success", text: `Acceso de ${employee.name} actualizado.` }
      : { type: "error", text: result.error || "No se pudo cambiar el estado" });
    if (result.success) await load();
  };

  const canChangePrivileges = (employee: Employee) => {
    if (employee.rolTenant === "OWNER") return false;
    if (employee.isSelf) return false;
    if (actorRole === "ADMIN" && employee.rolTenant === "ADMIN") return false;
    return true;
  };

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-slate-500">Preparando gestión del personal…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 font-sans">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Administración · Accesos</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-slate-950"><UserCog className="h-5 w-5 text-cyan-600" />Personal y permisos</h1>
          <p className="mt-1 text-xs font-medium text-slate-600">Roles reales del tenant, sedes operativas y estado de acceso desde un único lugar.</p>
        </div>
        <Link href="/dashboard/seguridad" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-800 hover:bg-slate-50"><ShieldCheck className="h-4 w-4 text-cyan-700" />Sesiones y auditoría</Link>
      </header>

      {notice && <button onClick={() => setNotice(null)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold ${notice.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>{notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{notice.text}</button>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users} label="Activos" value={metrics.active} />
        <Metric icon={ShieldCheck} label="Administración" value={metrics.admins} />
        <Metric icon={KeyRound} label="Recepción" value={metrics.reception} />
        <Metric icon={Building2} label="Entrenadores" value={metrics.trainers} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-black text-slate-950">Equipo del gimnasio</h2><p className="text-[11px] font-medium text-slate-500">Recepción y Entrenadores deben tener al menos una sede asignada.</p></div>
          <label className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, usuario, email o rol" className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold outline-none focus:border-cyan-500" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 text-left">Persona</th><th className="px-4 py-3 text-left">Rol</th><th className="px-4 py-3 text-left">Sedes</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((employee) => {
                const privilegesEditable = canChangePrivileges(employee);
                return <tr key={employee.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><div className="font-black text-slate-950">{employee.name}{employee.isSelf ? <span className="ml-2 text-[9px] font-black uppercase text-cyan-700">Vos</span> : null}</div><div className="mt-0.5 text-[11px] font-medium text-slate-500">{employee.username || employee.email}{employee.identidadCompartida ? " · identidad multi-tenant" : ""}</div></td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${employee.rolTenant === "OWNER" ? "border-violet-300 bg-violet-50 text-violet-800" : employee.rolTenant === "ADMIN" ? "border-cyan-300 bg-cyan-50 text-cyan-800" : employee.rolTenant === "ENTRENADOR" ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-300 bg-slate-100 text-slate-700"}`}>{roleLabels[employee.nivel]}</span></td>
                  <td className="px-4 py-3">{employee.rolTenant === "OWNER" || employee.rolTenant === "ADMIN" ? <span className="font-semibold text-slate-500">Todas las sedes</span> : employee.sucursales.length ? <div className="flex flex-wrap gap-1">{employee.sucursales.map((branch) => <span key={branch.id} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{branch.nombre}</span>)}</div> : <span className="font-bold text-rose-700">Sin sede</span>}</td>
                  <td className="px-4 py-3 text-center"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${employee.estado === "activo" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}`}>{employee.estado === "activo" ? "ACTIVO" : "INACTIVO"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1.5"><button onClick={() => openEdit(employee)} disabled={employee.rolTenant === "OWNER" && !employee.isSelf} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Editar</button><button onClick={() => void handleToggle(employee)} disabled={!privilegesEditable} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-35">{employee.estado === "activo" ? "Desactivar" : "Activar"}</button></div></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No hay personal que coincida con la búsqueda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Acceso del personal</p><h2 className="mt-1 text-lg font-black text-slate-950">{editing.name}</h2></div><button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <label className="block text-xs font-black text-slate-700">Nombre<input value={form.name} disabled={editing.identidadCompartida} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500" /></label>
              {editing.identidadCompartida && <p className="rounded-xl bg-amber-50 p-3 text-[11px] font-semibold text-amber-900">El nombre pertenece a una identidad compartida entre tenants y se administra globalmente.</p>}

              <label className="block text-xs font-black text-slate-700">Rol<select value={form.nivel} disabled={!canChangePrivileges(editing)} onChange={(event) => setForm({ ...form, nivel: event.target.value, sucursalIds: [] })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold disabled:bg-slate-100">
                {editing.rolTenant === "OWNER" ? <option value="owner">Owner</option> : <>
                  {(actorRole === "OWNER" || editing.rolTenant === "ADMIN") && <option value="admin">Administrador</option>}
                  <option value="recepcion">Recepción</option>
                  <option value="entrenador">Entrenador</option>
                </>}
              </select></label>

              {(form.nivel === "recepcion" || form.nivel === "entrenador") ? <div><div className="flex items-center justify-between"><p className="text-xs font-black text-slate-700">Sedes operativas</p><span className="text-[10px] font-bold text-slate-500">{form.sucursalIds.length} seleccionadas</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{branches.filter((branch) => branch.estado === "activo").map((branch) => <label key={branch.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-bold ${form.sucursalIds.includes(branch.id) ? "border-cyan-400 bg-cyan-50 text-cyan-950" : "border-slate-200 text-slate-700"}`}><input type="checkbox" checked={form.sucursalIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="h-4 w-4 accent-cyan-600" />{branch.nombre}</label>)}</div><p className="mt-2 text-[11px] font-medium text-slate-500">Estas sedes definen dónde puede operar y qué socios puede consultar el rol.</p></div> : <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs font-semibold text-cyan-950">Owner y Administrador operan sobre todas las sedes del tenant.</div>}

              <div className="flex gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar acceso"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><Icon className="h-4 w-4 text-cyan-600" /></div><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></article>;
}
