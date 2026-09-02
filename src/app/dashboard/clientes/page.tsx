"use client";

import { useEffect, useState } from "react";
import { exportarClientesData, getClientesPaginados, toggleClienteEstado } from "@/app/actions/clientes";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  Plus,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";

function formatMoney(n: unknown) {
  const val = typeof n === "number" && !Number.isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR");
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroMembresia, setFiltroMembresia] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sucursalId, setSucursalId] = useState<number | null>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem("activeSucursalId") || 0);
    setSucursalId(stored > 0 ? stored : null);
  }, []);

  const fetchClientes = async () => {
    if (!sucursalId) return;
    setLoading(true);
    const res = await getClientesPaginados({
      sucursalId,
      page: pagina,
      limit: 12,
      search: buscar,
      estado: filtroMembresia,
    });
    if (res.success && res.data) {
      setClientes(res.data.items);
      setTotalPages(res.data.pagination.totalPages || 1);
      setTotalRecords(res.data.pagination.total || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (sucursalId) void fetchClientes();
    // La búsqueda se ejecuta explícitamente al enviar el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroMembresia, sucursalId]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (pagina !== 1) {
      setPagina(1);
      return;
    }
    void fetchClientes();
  };

  const handleToggleEstado = async (id: number, currentEstado: string, nombre: string) => {
    const accion = currentEstado === "activo" ? "desactivar" : "activar";
    if (!window.confirm(`¿Querés ${accion} a ${nombre}?`)) return;

    const res = await toggleClienteEstado(id, currentEstado);
    if (res.success) {
      setClientes((current) => current.map((c) => c.id === id ? { ...c, estado: res.nuevoEstado } : c));
    }
  };

  const handleExportar = async () => {
    if (!sucursalId) return;
    const res = await exportarClientesData(sucursalId);
    if (!res.success || !res.data) return;

    const csvContent = "data:text/csv;charset=utf-8," +
      ["Documento,Nombre,Apellido,Telefono,Email,Saldo,Estado,Vencimiento"]
        .concat(res.data.map((c: any) =>
          `"${c.documento}","${c.nombre}","${c.apellido}","${c.telefono || ""}","${c.email || ""}",${c.saldoDeuda || 0},"${c.estado}","${c.vencimiento || "—"}"`
        )).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `socios_onlygym_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generarLinkWhatsApp = (cliente: any) => {
    if (!cliente.telefono) return null;
    const nombre = `${cliente.nombre} ${cliente.apellido}`;
    const mensaje = cliente.fechaVencimiento
      ? `Hola ${nombre}! Te escribimos desde tu gimnasio para recordarte que tu membresía vence/venció el ${formatDate(cliente.fechaVencimiento)}. Si querés, te ayudamos a renovarla. 💪`
      : `Hola ${nombre}! Te escribimos desde tu gimnasio. Cuando quieras podemos ayudarte a activar tu primera membresía. 💪`;
    return buildWhatsAppUrl(cliente.telefono, mensaje);
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Socios</h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Buscá un socio, revisá su estado y entrá a su ficha para operar sobre su cuenta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportar} disabled={!sucursalId} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium shadow-2xs transition disabled:opacity-50">
            <Download className="h-3.5 w-3.5 text-cyan-600" />
            <span>Exportar</span>
          </button>

          <Link href="/dashboard/clientes/nuevo" className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition">
            <Plus className="h-3.5 w-3.5" />
            <span>Nuevo socio</span>
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleBuscar} className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por DNI, nombre o apellido..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: "todos", label: "Todos" },
            { id: "al_dia", label: "Al día" },
            { id: "vencido", label: "Vencidos" },
            { id: "vencen_pronto", label: "Vencen en 7 días" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => { setFiltroMembresia(filter.id); setPagina(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filtroMembresia === filter.id
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                  : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Socio</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Membresía</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">Cuenta corriente</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600" />
                      <span>Cargando socios...</span>
                    </div>
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-medium">
                    No se encontraron socios con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const wsLink = generarLinkWhatsApp(c);
                  const hasMembership = Boolean(c.fechaVencimiento);
                  const isPorVencer = c.estadoMembresia === "AL_DIA" && c.vencenPronto;
                  const isAlDia = c.estadoMembresia === "AL_DIA" && !c.vencenPronto;
                  const isVencido = c.estadoMembresia === "VENCIDO" && hasMembership;
                  const saldoDeuda = Number(c.saldoCuenta || 0);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition group">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clientes/${c.id}`} className="flex items-center gap-2.5 group-hover:text-cyan-700">
                          {c.foto ? (
                            <img src={c.foto} alt={c.nombre} className="h-8 w-8 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {c.nombre.charAt(0)}{c.apellido.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block group-hover:text-cyan-700 transition">{c.nombre} {c.apellido}</span>
                            <span className="text-[10px] text-slate-500 font-medium">{c.estado === "activo" ? "Activo" : "Inactivo"} · {c.ultimoPlan}</span>
                          </div>
                        </Link>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-700 font-semibold">{c.documento}</td>

                      <td className="px-4 py-3">
                        {c.telefono ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700 font-mono text-[11px]">{c.telefono}</span>
                            {wsLink && (
                              <a href={wsLink} target="_blank" rel="noreferrer" className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition" title="Enviar WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin teléfono</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isAlDia && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"><CheckCircle2 className="h-3 w-3" />Al día</span>}
                        {isPorVencer && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300"><AlertCircle className="h-3 w-3" />Vence pronto</span>}
                        {isVencido && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300"><AlertCircle className="h-3 w-3" />Vencido</span>}
                        {!hasMembership && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Sin membresía</span>}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-slate-700">{formatDate(c.fechaVencimiento)}</td>

                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                        {saldoDeuda > 0 ? <span className="text-rose-600">{formatMoney(saldoDeuda)}</span> : <span className="text-emerald-700">$0.00</span>}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/clientes/${c.id}`} className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-cyan-50 hover:border-cyan-300 text-slate-800 hover:text-cyan-800 text-[11px] font-semibold transition">
                            Abrir ficha
                          </Link>
                          <button
                            onClick={() => handleToggleEstado(c.id, c.estado, `${c.nombre} ${c.apellido}`)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold transition ${
                              c.estado === "activo"
                                ? "bg-white border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                                : "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                            }`}
                          >
                            {c.estado === "activo" ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                            {c.estado === "activo" ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600 font-medium">
          <div>Mostrando <strong>{clientes.length}</strong> de <strong>{totalRecords}</strong> socios</div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1 || loading} className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-slate-900 font-bold px-2">{pagina} / {totalPages}</span>
            <button onClick={() => setPagina((p) => Math.min(totalPages, p + 1))} disabled={pagina === totalPages || loading} className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
