"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";
import { exportarClientesData, getClientesPaginados, toggleClienteEstado } from "@/app/actions/clientes";
import MemberOperationsNav from "@/components/MemberOperationsNav";
import { buildMembershipReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";

function formatMoney(value: unknown) {
  const amount = typeof value === "number" && !Number.isNaN(value) ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("es-AR") : "—";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchReady, setBranchReady] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [filtroMembresia, setFiltroMembresia] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("Sucursal activa");
  const [gymName, setGymName] = useState("tu gimnasio");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getStaffNavigationContext().then((result) => {
      if (result.success && result.data) {
        setSucursalId(result.data.branchId);
        setSucursalNombre(result.data.branchName || "Sucursal activa");
        setGymName(result.data.tenantName || "tu gimnasio");
      } else {
        setError("No se pudo validar la sede activa.");
      }
      setBranchReady(true);
    });
  }, []);

  const fetchClientes = async () => {
    if (!sucursalId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getClientesPaginados({
      sucursalId,
      page: pagina,
      limit: 12,
      search: buscar,
      estado: filtroMembresia,
    });
    if (result.success && result.data) {
      setClientes(result.data.items);
      setTotalPages(result.data.pagination.totalPages || 1);
      setTotalRecords(result.data.pagination.total || 0);
      if (result.data.pagination.page !== pagina) setPagina(result.data.pagination.page);
    } else {
      setClientes([]);
      setTotalPages(1);
      setTotalRecords(0);
      setError(result.error || "No se pudieron cargar los socios.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (branchReady) void fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroMembresia, sucursalId, branchReady]);

  const handleBuscar = (event: React.FormEvent) => {
    event.preventDefault();
    if (pagina !== 1) {
      setPagina(1);
      return;
    }
    void fetchClientes();
  };

  const handleToggleEstado = async (id: number, currentEstado: string, nombre: string) => {
    const accion = currentEstado === "activo" ? "desactivar" : "activar";
    if (!window.confirm(`¿Querés ${accion} a ${nombre}?`)) return;
    setError(null);
    const result = await toggleClienteEstado(id, currentEstado);
    if (result.success) {
      setClientes((current) => current.map((cliente) => cliente.id === id ? { ...cliente, estado: result.nuevoEstado } : cliente));
    } else {
      setError(result.error || "No se pudo cambiar el estado del socio.");
    }
  };

  const handleExportar = async () => {
    if (!sucursalId) return;
    setError(null);
    const result = await exportarClientesData(sucursalId);
    if (!result.success || !result.data) {
      setError(result.error || "No se pudo exportar el listado.");
      return;
    }

    const rows = [
      ["Documento", "Nombre", "Apellido", "Teléfono", "Email", "Membresía", "Plan", "Vencimiento", "Saldo", "Estado"],
      ...result.data.map((cliente: any) => [
        cliente.documento,
        cliente.nombre,
        cliente.apellido,
        cliente.telefono,
        cliente.email,
        cliente.estadoMembresia,
        cliente.ultimoPlan,
        cliente.vencimiento,
        cliente.saldoDeuda,
        cliente.estado,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `socios_${sucursalNombre.toLowerCase().replace(/\s+/g, "-")}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const whatsappLink = (cliente: any) => {
    if (!cliente.telefono) return null;
    const message = buildMembershipReminderMessage({
      name: cliente.nombre,
      gymName,
      membershipName: cliente.ultimoPlan === "Sin plan" ? null : cliente.ultimoPlan,
      expirationDate: cliente.fechaVencimiento ? formatDate(cliente.fechaVencimiento) : null,
      expired: cliente.estadoMembresia === "VENCIDO" && Boolean(cliente.fechaVencimiento),
    });
    return buildWhatsAppUrl(cliente.telefono, message);
  };

  return (
    <div className="space-y-5 font-sans">
      <MemberOperationsNav />

      <header className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Socios · Sede activa</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">Socios</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-600">Buscá, cobrá, contactá o abrí la ficha completa sin salir del circuito de la sede.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-950"><MapPin className="h-3.5 w-3.5 text-cyan-700" />{sucursalNombre}</span>
          <button onClick={handleExportar} disabled={!sucursalId || loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Download className="h-3.5 w-3.5 text-cyan-600" />Exportar</button>
          <Link href="/dashboard/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-xs font-black text-white"><Plus className="h-3.5 w-3.5" />Nuevo socio</Link>
        </div>
      </header>

      {error && <button onClick={() => setError(null)} className="flex w-full items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-left text-xs font-bold text-rose-900"><AlertCircle className="h-4 w-4" />{error}</button>}

      {branchReady && !sucursalId ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <MapPin className="mx-auto h-7 w-7 text-amber-700" />
          <h2 className="mt-2 font-black text-amber-950">Seleccioná una sucursal</h2>
          <p className="mt-1 text-sm text-amber-800">El padrón y todas sus acciones trabajan sobre la sede activa validada por el servidor.</p>
          <Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Seleccionar sucursal</Link>
        </section>
      ) : (
        <>
          <section className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs md:flex-row">
            <form onSubmit={handleBuscar} className="relative w-full md:w-96"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input type="text" placeholder="DNI, nombre, apellido, email o teléfono" value={buscar} onChange={(event) => setBuscar(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" /></form>
            <div className="flex w-full flex-wrap items-center gap-1.5 md:w-auto">
              {[
                { id: "todos", label: "Todos" },
                { id: "al_dia", label: "Al día" },
                { id: "vencido", label: "Vencidos" },
                { id: "vencen_pronto", label: "Vencen en 7 días" },
                { id: "sin_membresia", label: "Sin membresía" },
              ].map((filter) => (
                <button key={filter.id} onClick={() => { setFiltroMembresia(filter.id); setPagina(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filtroMembresia === filter.id ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{filter.label}</button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Socio</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Membresía</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3 text-right">Cuenta</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center font-semibold text-slate-500">Cargando socios…</td></tr>
                  ) : clientes.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center font-semibold text-slate-500">No se encontraron socios con los filtros aplicados.</td></tr>
                  ) : clientes.map((cliente) => {
                    const wsLink = whatsappLink(cliente);
                    const hasMembership = Boolean(cliente.fechaVencimiento);
                    const isSoon = cliente.estadoMembresia === "AL_DIA" && cliente.vencenPronto;
                    const isCurrent = cliente.estadoMembresia === "AL_DIA" && !cliente.vencenPronto;
                    const isExpired = cliente.estadoMembresia === "VENCIDO" && hasMembership;
                    const debt = Number(cliente.saldoCuenta || 0);
                    return (
                      <tr key={cliente.id} className="group transition hover:bg-slate-50/80">
                        <td className="px-4 py-3"><Link href={`/dashboard/clientes/${cliente.id}`} className="flex items-center gap-2.5">{cliente.foto ? <img src={cliente.foto} alt={cliente.nombre} className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-xs font-black text-cyan-800">{cliente.nombre.charAt(0)}{cliente.apellido.charAt(0)}</div>}<div><span className="block font-black text-slate-900 group-hover:text-cyan-700">{cliente.nombre} {cliente.apellido}</span><span className="text-[10px] font-medium text-slate-500">{cliente.estado === "activo" ? "Activo" : "Inactivo"} · {cliente.ultimoPlan}</span></div></Link></td>
                        <td className="px-4 py-3 font-mono font-semibold">{cliente.documento}</td>
                        <td className="px-4 py-3">{cliente.telefono ? <div className="flex items-center gap-1.5"><span className="font-mono text-[11px]">{cliente.telefono}</span>{wsLink && <a href={wsLink} target="_blank" rel="noreferrer" className="rounded-md border border-emerald-300 bg-emerald-50 p-1 text-emerald-800 hover:bg-emerald-100" title="Enviar recordatorio por WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>}</div> : <span className="italic text-slate-400">Sin teléfono</span>}</td>
                        <td className="px-4 py-3">{isCurrent && <Badge tone="good" icon={CheckCircle2}>Al día</Badge>}{isSoon && <Badge tone="warn" icon={AlertCircle}>Vence pronto</Badge>}{isExpired && <Badge tone="bad" icon={AlertCircle}>Vencido</Badge>}{!hasMembership && <Badge>Sin membresía</Badge>}</td>
                        <td className="px-4 py-3 font-mono text-[11px]">{formatDate(cliente.fechaVencimiento)}</td>
                        <td className="px-4 py-3 text-right font-mono font-black">{debt > 0 ? <span className="text-rose-700">{formatMoney(debt)}</span> : <span className="text-emerald-700">$0,00</span>}</td>
                        <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1.5"><Link href={`/dashboard/pagos?clienteId=${cliente.id}`} className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-800"><CreditCard className="h-3 w-3" />Cobrar</Link><Link href={`/dashboard/clientes/${cliente.id}`} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black text-slate-800">Ficha</Link><button onClick={() => handleToggleEstado(cliente.id, cliente.estado, `${cliente.nombre} ${cliente.apellido}`)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black ${cliente.estado === "activo" ? "border-slate-300 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{cliente.estado === "activo" ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}{cliente.estado === "activo" ? "Desactivar" : "Activar"}</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs font-medium text-slate-600"><div>Mostrando <strong>{clientes.length}</strong> de <strong>{totalRecords}</strong> socios</div><div className="flex items-center gap-1.5"><button onClick={() => setPagina((value) => Math.max(1, value - 1))} disabled={pagina === 1 || loading} className="rounded-md border border-slate-300 bg-white p-1 text-slate-700 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 font-mono font-black text-slate-900">{pagina} / {totalPages}</span><button onClick={() => setPagina((value) => Math.min(totalPages, value + 1))} disabled={pagina === totalPages || loading} className="rounded-md border border-slate-300 bg-white p-1 text-slate-700 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>
        </>
      )}
    </div>
  );
}

function Badge({ children, tone = "neutral", icon: Icon }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad"; icon?: typeof CheckCircle2 }) {
  const classes = tone === "good"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : tone === "bad"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-slate-300 bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${classes}`}>{Icon && <Icon className="h-3 w-3" />}{children}</span>;
}
