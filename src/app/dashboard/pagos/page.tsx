"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MapPin,
  Search,
  User,
  WalletCards,
} from "lucide-react";
import {
  getClienteParaCobro,
  getMembresiasDisponibles,
  getMovimientosHoy,
  registrarPago,
  searchClientes,
} from "@/app/actions/caja";

function formatMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("es-AR") : "—";
}

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";

export default function PagosPage() {
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("Sucursal activa");
  const [branchReady, setBranchReady] = useState(false);
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [membresias, setMembresias] = useState<any[]>([]);
  const [selectedMembresia, setSelectedMembresia] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("efectivo");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingInitialMember, setLoadingInitialMember] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagosHoy, setPagosHoy] = useState<any[]>([]);

  const loadPagosHoy = (branchId: number) => {
    void getMovimientosHoy(branchId).then((result) => {
      if (result.success && result.data) setPagosHoy(result.data);
    });
  };

  useEffect(() => {
    const storedBranch = Number(localStorage.getItem("activeSucursalId") || 0);
    const storedName = localStorage.getItem("activeSucursalName");
    if (storedName) setSucursalNombre(storedName);
    if (!Number.isInteger(storedBranch) || storedBranch <= 0) {
      setError("Seleccioná una sucursal antes de registrar cobros.");
      setBranchReady(true);
      return;
    }

    setSucursalId(storedBranch);
    setBranchReady(true);
    loadPagosHoy(storedBranch);

    void getMembresiasDisponibles().then((result) => {
      if (result.success && result.data) {
        setMembresias(result.data.map((item: any) => ({ ...item, precio: Number(item.precio) })));
      } else if (!result.success) {
        setError(result.error || "No se pudieron cargar los planes");
      }
    });

    const clienteId = Number(new URLSearchParams(window.location.search).get("clienteId") || 0);
    if (Number.isInteger(clienteId) && clienteId > 0) {
      setLoadingInitialMember(true);
      void getClienteParaCobro(clienteId, storedBranch).then((result) => {
        if (result.success && result.data) {
          setSelectedCliente(result.data);
          setSearch(`${result.data.nombre} ${result.data.apellido}`);
        } else {
          setError(result.error || "No se pudo cargar el socio seleccionado");
        }
        setLoadingInitialMember(false);
      });
    }
  }, []);

  useEffect(() => {
    if (!sucursalId || selectedCliente || search.trim().length < 2) {
      setClientes([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchClientes(search, sucursalId).then((result) => {
        if (result.success && result.data) setClientes(result.data);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, selectedCliente, sucursalId]);

  const selectCliente = (cliente: any) => {
    setSelectedCliente(cliente);
    setClientes([]);
    setSearch(`${cliente.nombre} ${cliente.apellido}`);
    setSuccess(null);
    setError(null);
  };

  const clearCliente = () => {
    setSelectedCliente(null);
    setSelectedMembresia(null);
    setSearch("");
    setClientes([]);
    setSuccess(null);
  };

  const handlePago = async () => {
    if (!sucursalId || !selectedCliente || !selectedMembresia) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await registrarPago({
      clienteId: selectedCliente.id,
      membresiaId: selectedMembresia.id,
      sucursalId,
      metodoPago,
      notas: notas || undefined,
    });

    if (result.success && result.data) {
      setSuccess(
        `Cobro registrado. ${result.data.membresia?.nombre || selectedMembresia.nombre} vigente hasta ${formatDate(result.data.fechaVencimiento)}.`,
      );
      setSelectedMembresia(null);
      setNotas("");
      loadPagosHoy(sucursalId);
    } else {
      setError(result.error || "No se pudo registrar el cobro");
    }
    setLoading(false);
  };

  const currentPayment = selectedCliente?.ultimoPago || selectedCliente?.pagos?.[0] || null;
  const currentPaymentActive = currentPayment && new Date(currentPayment.fechaVencimiento) >= new Date();

  if (!branchReady) {
    return <div className="py-20 text-center text-sm font-semibold text-slate-500">Preparando cobros…</div>;
  }

  if (!sucursalId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MapPin className="mx-auto h-7 w-7 text-amber-700" />
        <h1 className="mt-2 text-lg font-black text-amber-950">Falta seleccionar la sucursal</h1>
        <p className="mt-1 text-sm text-amber-800">Los cobros siempre se registran en una sede concreta.</p>
        <Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">
          Seleccionar sucursal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 font-sans">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Socios · Membresías</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <CreditCard className="h-5 w-5 text-cyan-600" />
            Cobrar membresía
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-600">Un único circuito para buscar socio, elegir plan y registrar el medio de pago.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-950">
          <MapPin className="h-3.5 w-3.5 text-cyan-600" />
          {sucursalNombre}
        </div>
      </header>

      {success && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-700" />{success}</span>
          {selectedCliente && <Link href={`/dashboard/clientes/${selectedCliente.id}`} className="shrink-0 font-black underline">Ver ficha</Link>}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-950">
          <AlertCircle className="h-4 w-4 text-rose-700" />{error}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <section className="space-y-5 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs lg:col-span-7">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">1 · Socio</label>
              {selectedCliente && <button onClick={clearCliente} className="text-xs font-bold text-cyan-700 hover:underline">Cambiar socio</button>}
            </div>

            {selectedCliente ? (
              <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-600 text-sm font-black text-white">
                    {selectedCliente.nombre?.charAt(0)}{selectedCliente.apellido?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-slate-950">{selectedCliente.nombre} {selectedCliente.apellido}</p>
                    <p className="text-xs font-semibold text-slate-600">DNI {selectedCliente.documento}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${currentPaymentActive ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"}`}>
                    {currentPaymentActive ? `Al día · ${formatDate(currentPayment.fechaVencimiento)}` : "Sin membresía vigente"}
                  </span>
                  <Link href={`/dashboard/clientes/${selectedCliente.id}`} title="Abrir ficha del socio" className="rounded-lg border border-cyan-200 bg-white p-2 text-cyan-700 hover:bg-cyan-50">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={loadingInitialMember}
                  placeholder={loadingInitialMember ? "Cargando socio…" : "DNI, nombre o apellido"}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  autoFocus
                />
                {clientes.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {clientes.map((cliente) => {
                      const ultimo = cliente.pagos?.[0];
                      const alDia = ultimo && new Date(ultimo.fechaVencimiento) >= new Date();
                      return (
                        <button key={cliente.id} onClick={() => selectCliente(cliente)} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-cyan-50">
                          <div><p className="text-sm font-bold text-slate-950">{cliente.nombre} {cliente.apellido}</p><p className="text-[11px] font-semibold text-slate-500">DNI {cliente.documento}</p></div>
                          <span className={`text-[10px] font-black ${alDia ? "text-emerald-700" : "text-rose-700"}`}>{alDia ? "AL DÍA" : "A RENOVAR"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-800">2 · Plan</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {membresias.map((membresia) => {
                const active = selectedMembresia?.id === membresia.id;
                return (
                  <button
                    key={membresia.id}
                    type="button"
                    onClick={() => setSelectedMembresia(membresia)}
                    className={`rounded-xl border p-3 text-left transition ${active ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{membresia.nombre}</p><p className="text-[11px] font-semibold text-slate-500">{membresia.diasDuracion} días</p></div><strong className="font-mono text-sm text-slate-950">{formatMoney(membresia.precio)}</strong></div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-800">3 · Medio de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "efectivo", label: "Efectivo", icon: Banknote },
                { id: "tarjeta", label: "Tarjeta", icon: WalletCards },
                { id: "transferencia", label: "Transferencia", icon: CreditCard },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setMetodoPago(id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold ${metodoPago === id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-800">Nota <span className="font-medium text-slate-400">(opcional)</span></label>
            <input value={notas} onChange={(event) => setNotas(event.target.value)} placeholder="Ej: transferencia recibida, observación…" className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Total</span><strong className="font-mono text-xl text-slate-950">{selectedMembresia ? formatMoney(selectedMembresia.precio) : "$0,00"}</strong></div>
            <p className="mt-1 text-[10px] font-medium text-slate-500">El importe se toma del plan configurado en el servidor.</p>
          </div>

          <button onClick={handlePago} disabled={!selectedCliente || !selectedMembresia || loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
            <CreditCard className="h-4 w-4" />
            {loading ? "Registrando cobro…" : selectedMembresia ? `Confirmar ${formatMoney(selectedMembresia.precio)}` : "Seleccioná socio y plan"}
          </button>
        </section>

        <aside className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs lg:col-span-5">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Cobros de hoy</h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{pagosHoy.length} operaciones en {sucursalNombre}</p>
          </div>
          <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">
            {pagosHoy.length === 0 ? (
              <p className="p-8 text-center text-xs font-medium text-slate-500">Todavía no hay cobros registrados hoy.</p>
            ) : pagosHoy.map((pago: any) => (
              <div key={pago.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <Link href={`/dashboard/clientes/${pago.clienteId}`} className="block truncate text-xs font-black text-slate-950 hover:text-cyan-700">{pago.cliente?.nombre} {pago.cliente?.apellido}</Link>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">{pago.membresia?.nombre} · {new Date(pago.fechaPago).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {pago.metodoPago || "efectivo"}</p>
                </div>
                <span className="shrink-0 font-mono text-xs font-black text-slate-950">{formatMoney(pago.monto)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
