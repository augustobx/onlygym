"use client";

import { useState, useEffect } from "react";
import { 
  getClientesPaginados, 
  toggleClienteEstado, 
  exportarClientesData 
} from "@/app/actions/clientes";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Download, 
  UserCheck, 
  UserX, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  MessageCircle,
  Users,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

function formatMoney(n: any) {
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR");
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  
  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sucursalId, setSucursalId] = useState<number>(1);
  const [exportando, setExportando] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    if (sId) setSucursalId(parseInt(sId));
  }, []);

  const loadData = async (p = page, q = search, est = estadoFiltro) => {
    setLoading(true);
    const res = await getClientesPaginados({
      page: p,
      limit,
      search: q,
      estado: est,
      sucursalId,
    });

    if (res.success && res.data) {
      setClientes(res.data.items);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(1, search, estadoFiltro);
    setPage(1);
  }, [search, estadoFiltro, sucursalId]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    loadData(newPage, search, estadoFiltro);
  };

  const handleToggleEstado = async (id: number, estadoActual: string) => {
    const res = await toggleClienteEstado(id, estadoActual);
    if (res.success) {
      setMsg({ type: "success", text: `Estado del socio actualizado a ${res.nuevoEstado}` });
      loadData(page, search, estadoFiltro);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleExportarCSV = async () => {
    setExportando(true);
    const res = await exportarClientesData(sucursalId);
    if (res.success && res.data) {
      const headers = ["DNI", "Nombre", "Apellido", "Telefono", "Email", "Estado", "Membresia", "Ultimo_Plan", "Vencimiento", "Saldo_Deuda", "Fecha_Registro"];
      const csvRows = [
        headers.join(","),
        ...res.data.map((c: any) =>
          [`"${c.documento}"`, `"${c.nombre}"`, `"${c.apellido}"`, `"${c.telefono}"`, `"${c.email}"`, `"${c.estado}"`, `"${c.estadoMembresia}"`, `"${c.ultimoPlan}"`, `"${c.vencimiento}"`, c.saldoDeuda, `"${c.fechaRegistro}"`].join(",")
        ),
      ];
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `socios_gymlink_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setExportando(false);
  };

  const sucursalNombre = typeof window !== "undefined" ? localStorage.getItem("activeSucursalName") || "GymLink" : "GymLink";

  return (
    <div className="space-y-5 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Gestión de Socios
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {total} socios registrados. Ficha 360, renovaciones rápidas y avisos por WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportarCSV}
            disabled={exportando || total === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{exportando ? "Exportando..." : "Exportar CSV"}</span>
          </button>

          <Link
            href="/dashboard/clientes/nuevo"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-2xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Socio</span>
          </Link>
        </div>
      </div>

      {/* Alertas */}
      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* Barra de Filtros & Búsqueda Compacta */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por DNI, nombre, teléfono..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Segmented Control de Filtros */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5 bg-slate-100 rounded-lg">
          {[
            { id: "todos", label: "Todos" },
            { id: "vencen_pronto", label: "⚠️ Vencen Pronto / Vencidos" },
            { id: "al_dia", label: "Al Día" },
            { id: "vencido", label: "Vencidos" },
            { id: "inactivo", label: "Inactivos" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setEstadoFiltro(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                estadoFiltro === f.id
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla Profesional de Socios */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium">Cargando socios...</div>
        ) : clientes.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-1">
            <Users className="h-8 w-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-800 text-sm">No se encontraron socios</p>
            <p className="text-xs text-slate-400">Prueba cambiando los criterios de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left">Socio</th>
                  <th scope="col" className="px-4 py-2.5 text-left">Contacto & WhatsApp</th>
                  <th scope="col" className="px-4 py-2.5 text-center">Estado Membresía</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Cuenta Corriente</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {clientes.map(c => {
                  const alDia = c.estadoMembresia === "AL_DIA";
                  const cleanPhone = (c.telefono || "").replace(/[^0-9]/g, "");
                  const whatsappLink = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
                        c.nombre
                      )}!%20Te%20recordamos%20desde%20${encodeURIComponent(
                        sucursalNombre
                      )}%20que%20tu%20membres%C3%ADa%20(${encodeURIComponent(
                        c.ultimoPlan
                      )})%20vence%20el%20${formatDate(c.fechaVencimiento)}.%20%C2%A1Te%20esperamos%20para%20renovar!`
                    : null;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      {/* Avatar y Nombre */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {c.foto ? (
                            <img
                              src={c.foto}
                              alt={c.nombre}
                              className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                              {c.nombre.charAt(0)}{c.apellido.charAt(0)}
                            </div>
                          )}

                          <div className="truncate">
                            <Link
                              href={`/dashboard/clientes/${c.id}`}
                              className="font-semibold text-slate-900 hover:text-indigo-600 transition truncate block"
                            >
                              {c.nombre} {c.apellido}
                            </Link>
                            <span className="text-[11px] text-slate-500 font-mono">DNI: {c.documento}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contacto & WhatsApp */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700 text-[11px]">{c.telefono || "—"}</span>
                          {whatsappLink && (
                            <a
                              href={whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold border border-emerald-200 transition"
                              title="Enviar recordatorio por WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                        {c.email && (
                          <span className="text-[10px] text-slate-400 truncate block max-w-[160px]">{c.email}</span>
                        )}
                      </td>

                      {/* Estado Membresía */}
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            alDia
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {alDia ? `● Al Día (${c.diasRestantes}d)` : "● Vencido"}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[120px] mx-auto">{c.ultimoPlan}</span>
                      </td>

                      {/* Cuenta Corriente */}
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`font-mono font-bold text-xs tabular-nums ${
                            c.saldoCuenta > 0 ? "text-rose-600" : "text-slate-700"
                          }`}
                        >
                          {formatMoney(c.saldoCuenta)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {c.saldoCuenta > 0 ? "Deuda pendiente" : "Al día"}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-md font-medium text-xs transition"
                          >
                            Ficha 360 →
                          </Link>

                          <button
                            onClick={() => handleToggleEstado(c.id, c.estado)}
                            className={`p-1 rounded-md text-xs transition border ${
                              c.estado === "activo"
                                ? "bg-white text-slate-400 hover:text-rose-600 border-slate-200 hover:bg-rose-50"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                            title={c.estado === "activo" ? "Desactivar socio" : "Activar socio"}
                          >
                            {c.estado === "activo" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación Compacta */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({total} socios)
            </p>

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
