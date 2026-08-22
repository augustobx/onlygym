"use client";

import { useEffect, useState } from "react";
import { searchClientes, getMembresiasDisponibles, registrarPago, getMovimientosHoy } from "@/app/actions/caja";
import { CreditCard, Search, Check, Sparkles, CheckCircle2, User, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

export default function PagosPage() {
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [membresias, setMembresias] = useState<any[]>([]);
  const [selectedMembresia, setSelectedMembresia] = useState<any>(null);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagosHoy, setPagosHoy] = useState<any[]>([]);

  const sucursalId = typeof window !== "undefined" ? Number(localStorage.getItem("activeSucursalId") || "1") : 1;

  useEffect(() => {
    getMembresiasDisponibles().then(r => r.success && setMembresias(r.data!.map((m: any) => ({ ...m, precio: Number(m.precio) }))));
    loadPagosHoy();
  }, []);

  const loadPagosHoy = () => {
    getMovimientosHoy(sucursalId).then(r => r.success && setPagosHoy(r.data!));
  };

  useEffect(() => {
    if (search.length < 2) { setClientes([]); return; }
    const t = setTimeout(() => {
      searchClientes(search, sucursalId).then(r => r.success && setClientes(r.data!));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handlePago = async () => {
    if (!selectedCliente || !selectedMembresia) return;
    setLoading(true); setError(null); setSuccess(null);

    const result = await registrarPago({
      clienteId: selectedCliente.id,
      membresiaId: selectedMembresia.id,
      sucursalId,
      monto: selectedMembresia.precio,
      notas: notas || undefined
    });

    if (result.success) {
      setSuccess(`Cobro registrado para ${selectedCliente.nombre} ${selectedCliente.apellido} — ${selectedMembresia.nombre}`);
      setSelectedCliente(null); setSelectedMembresia(null); setSearch(""); setNotas(""); setClientes([]);
      loadPagosHoy();
    } else {
      setError(result.error || "Error al registrar el cobro");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5 font-sans max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan-600" />
            Cobro de Membresías & Cuotas
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Selecciona el socio y el plan para registrar el pago y emitir comprobante.
          </p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Formulario de Cobro (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          
          {/* Paso 1: Buscar Socio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Seleccionar Socio
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedCliente(null); }}
                placeholder="Escribe DNI, nombre o apellido..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Dropdown de Búsqueda */}
            {clientes.length > 0 && !selectedCliente && (
              <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-20 relative text-xs">
                {clientes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCliente(c); setClientes([]); setSearch(`${c.nombre} ${c.apellido}`); }}
                    className="w-full text-left px-3 py-2 hover:bg-cyan-50/70 flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{c.nombre} {c.apellido}</span>
                      <span className="text-slate-600 ml-2 font-mono text-[11px]">DNI: {c.documento}</span>
                    </div>
                    {c.pagos?.[0] && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        new Date(c.pagos[0].fechaVencimiento) >= new Date()
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-rose-50 text-rose-800 border-rose-300"
                      }`}>
                        {new Date(c.pagos[0].fechaVencimiento) >= new Date() ? "● Al Día" : "● Vencido"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Socio Seleccionado Banner */}
            {selectedCliente && (
              <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-lg flex items-center justify-between text-xs text-cyan-950">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-md">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-slate-900">{selectedCliente.nombre} {selectedCliente.apellido}</span>
                    <span className="text-[11px] text-cyan-800 font-mono font-semibold">DNI: {selectedCliente.documento}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedCliente(null); setSearch(""); }}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Paso 2: Seleccionar Plan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Plan de Membresía
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {membresias.map(m => {
                const isSelected = selectedMembresia?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMembresia(m)}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? "bg-cyan-50/90 border-cyan-500 ring-2 ring-cyan-500/30 text-slate-900"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 block">{m.nombre}</span>
                        <span className="text-[11px] text-slate-600">{m.diasDuracion} días</span>
                      </div>
                      <span className="font-bold font-mono text-slate-900 tabular-nums">{formatMoney(m.precio)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paso 3: Observaciones */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Notas u Observaciones (Opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Pago en mostrador..."
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Botón de Confirmación */}
          <button
            onClick={handlePago}
            disabled={!selectedCliente || !selectedMembresia || loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>
              {loading 
                ? "Registrando cobro..." 
                : selectedMembresia 
                ? `Confirmar Cobro de ${formatMoney(selectedMembresia.precio)}` 
                : "Selecciona socio y plan"}
            </span>
          </button>
        </div>

        {/* Panel Derecho: Pagos Registrados Hoy (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-cyan-600" />
              Cobros de la Fecha
            </h3>
            <span className="text-[11px] text-slate-600 font-mono font-semibold">
              {pagosHoy.length} pagos
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto text-xs">
            {pagosHoy.length === 0 ? (
              <p className="p-8 text-xs text-slate-500 text-center font-medium">Sin cobros registrados en la fecha.</p>
            ) : (
              pagosHoy.map((p: any) => (
                <div key={p.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/70 transition">
                  <div>
                    <Link
                      href={`/dashboard/clientes/${p.clienteId}`}
                      className="font-bold text-slate-900 hover:text-cyan-700 transition block"
                    >
                      {p.cliente?.nombre} {p.cliente?.apellido}
                    </Link>
                    <span className="text-[10px] text-slate-600">
                      {p.membresia?.nombre} · {new Date(p.fechaPago).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-slate-900 tabular-nums">
                    {formatMoney(Number(p.monto))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
