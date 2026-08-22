"use client";

import { useEffect, useState } from "react";
import { getCuentas, registrarPagoCuenta, registrarCargoCuenta, getMovimientosCuenta, setLimiteCredito } from "@/app/actions/cuentas";
import { FileText, Search, CreditCard, Plus, ArrowUpRight, ArrowDownRight, History, Settings, User, CheckCircle2, AlertCircle, Receipt } from "lucide-react";
import Link from "next/link";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function formatDateTime(d: string) { 
  return new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }); 
}

export default function CuentasCorrientesPage() {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("con_deuda");
  const [cuentaActiva, setCuentaActiva] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<"pago" | "cargo" | "limite" | null>(null);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const load = () => { getCuentas().then(r => r.success && setCuentas(r.data!)); };
  useEffect(() => { load(); }, []);

  const loadMovimientos = (clienteId: number) => {
    getMovimientosCuenta(clienteId).then(r => r.success && setMovimientos(r.data!));
  };

  const handleSelectCuenta = (cuenta: any) => {
    setCuentaActiva(cuenta);
    loadMovimientos(cuenta.clienteId);
    setMsg(null);
  };

  const handleTransaccion = async () => {
    if (!monto || Number(monto) <= 0) return;
    
    let result;
    if (showModal === "pago") {
      result = await registrarPagoCuenta(cuentaActiva.clienteId, Number(monto), concepto || "Pago a cuenta");
    } else if (showModal === "cargo") {
      result = await registrarCargoCuenta(cuentaActiva.clienteId, Number(monto), concepto || "Cargo a cuenta");
    } else if (showModal === "limite") {
      result = await setLimiteCredito(cuentaActiva.clienteId, Number(monto));
    }

    if (result?.success) {
      setShowModal(null);
      setMonto("");
      setConcepto("");
      load();
      loadMovimientos(cuentaActiva.clienteId);
      setMsg({ type: "success", text: "Operación completada con éxito." });
      
      if (showModal === "pago") setCuentaActiva({ ...cuentaActiva, saldo: cuentaActiva.saldo - Number(monto) });
      else if (showModal === "cargo") setCuentaActiva({ ...cuentaActiva, saldo: cuentaActiva.saldo + Number(monto) });
      else if (showModal === "limite") setCuentaActiva({ ...cuentaActiva, limiteCredito: Number(monto) });
    } else {
      setMsg({ type: "error", text: result?.error || "Error al procesar operación" });
    }
  };

  const cuentasFiltradas = cuentas.filter(c => {
    if (filtro === "con_deuda" && c.saldo <= 0) return false;
    if (filtro === "sin_deuda" && c.saldo > 0) return false;
    if (filtro === "excedido" && c.saldo <= c.limiteCredito) return false;
    
    if (buscar) {
      const b = buscar.toLowerCase();
      return c.cliente.nombre.toLowerCase().includes(b) || 
             c.cliente.apellido.toLowerCase().includes(b) || 
             c.cliente.documento.includes(b);
    }
    return true;
  });

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-cyan-600" />
            Cuentas Corrientes & Fiados
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Libro mayor de saldos deudores, límites de crédito para cantina y registro de abonos.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Lista de Cuentas (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col h-[600px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar por DNI o nombre..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>
            <select
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            >
              <option value="todos">Todos los socios con cuenta</option>
              <option value="con_deuda">Con Deuda (Saldo &gt; $0)</option>
              <option value="sin_deuda">Sin Deuda (Saldo = $0)</option>
              <option value="excedido">Límite Excedido</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
            {cuentasFiltradas.length === 0 ? (
              <p className="p-8 text-center text-slate-500 font-medium">No se encontraron cuentas.</p>
            ) : (
              cuentasFiltradas.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCuenta(c)}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition border-l-2 ${
                    cuentaActiva?.id === c.id 
                      ? "bg-cyan-50/80 border-cyan-600" 
                      : "border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">{c.cliente.nombre} {c.cliente.apellido}</p>
                      <p className="text-[11px] text-slate-600 font-mono font-semibold">DNI: {c.cliente.documento}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold font-mono tabular-nums ${c.saldo > 0 ? "text-rose-600" : "text-slate-800"}`}>
                        {formatMoney(c.saldo)}
                      </p>
                      {c.limiteCredito > 0 && (
                        <p className="text-[10px] text-slate-500 font-mono font-medium">Lím: {formatMoney(c.limiteCredito)}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detalle de Cuenta Activa (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {!cuentaActiva ? (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs h-80 flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-1.5">
              <User className="w-8 h-8 text-slate-400" />
              <p className="text-xs font-bold text-slate-800">Selecciona un socio de la lista izquierda</p>
              <p className="text-[11px] text-slate-500 font-medium">Podrás consultar su libro de movimientos, asentar pagos o registrar cargos.</p>
            </div>
          ) : (
            <>
              {/* Tarjeta Resumen */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {cuentaActiva.cliente.nombre} {cuentaActiva.cliente.apellido}
                    </h3>
                    <span className="text-xs text-slate-600 font-mono font-semibold">DNI: {cuentaActiva.cliente.documento}</span>
                    <Link
                      href={`/dashboard/clientes/${cuentaActiva.clienteId}`}
                      className="text-cyan-700 text-xs font-semibold hover:text-cyan-900 hover:underline mt-1 block"
                    >
                      Ver Ficha 360 del socio →
                    </Link>
                  </div>
                  
                  <div className="text-left sm:text-right p-3 bg-slate-50 rounded-lg border border-slate-200 min-w-[180px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Saldo Deudor</span>
                    <p className={`text-xl font-bold font-mono mt-0.5 tabular-nums ${cuentaActiva.saldo > 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {formatMoney(cuentaActiva.saldo)}
                    </p>
                    <span className="text-[11px] text-slate-600 font-mono font-medium block">Límite: {formatMoney(cuentaActiva.limiteCredito)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => { setShowModal("pago"); setMonto(""); setConcepto(""); }}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-2 px-3 rounded-lg font-semibold text-xs transition"
                  >
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span>Abonar a Cuenta</span>
                  </button>

                  <button
                    onClick={() => { setShowModal("cargo"); setMonto(""); setConcepto(""); }}
                    className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 py-2 px-3 rounded-lg font-semibold text-xs transition"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span>Registrar Deuda</span>
                  </button>

                  <button
                    onClick={() => { setShowModal("limite"); setMonto(String(cuentaActiva.limiteCredito)); }}
                    className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 py-2 px-3 rounded-lg font-medium text-xs shadow-2xs transition"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-600" />
                    <span>Ajustar Límite</span>
                  </button>
                </div>
              </div>

              {/* Historial de Movimientos */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-cyan-600" />
                    Historial de Movimientos
                  </h3>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2">Fecha</th>
                        <th className="px-3.5 py-2">Concepto</th>
                        <th className="px-3.5 py-2">Operador</th>
                        <th className="px-3.5 py-2 text-right">Cargo (+)</th>
                        <th className="px-3.5 py-2 text-right">Abono (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {movimientos.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-3.5 py-2 text-slate-600 font-mono text-[11px]">{formatDateTime(m.fecha)}</td>
                          <td className="px-3.5 py-2 font-semibold text-slate-900">{m.concepto || "—"}</td>
                          <td className="px-3.5 py-2 text-slate-600 font-medium">{m.usuario}</td>
                          <td className="px-3.5 py-2 text-right text-rose-600 font-bold font-mono tabular-nums">{m.tipo === "cargo" ? `+ ${formatMoney(m.monto)}` : ""}</td>
                          <td className="px-3.5 py-2 text-right text-emerald-700 font-bold font-mono tabular-nums">{m.tipo === "pago" ? `- ${formatMoney(m.monto)}` : ""}</td>
                        </tr>
                      ))}
                      {movimientos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                            Sin movimientos registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Transacción */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-sm font-bold text-slate-900">
              {showModal === "pago" && "Registrar Abono (Pago a Cuenta)"}
              {showModal === "cargo" && "Registrar Cargo (Deuda en Cantina)"}
              {showModal === "limite" && "Configurar Límite de Crédito"}
            </h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  autoFocus
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-base font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              
              {showModal !== "limite" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Concepto / Detalle (Opcional)</label>
                  <input
                    type="text"
                    value={concepto}
                    onChange={e => setConcepto(e.target.value)}
                    placeholder="Ej. Pago en efectivo por mostrador..."
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowModal(null)}
                className="flex-1 bg-white border border-slate-300 rounded-lg py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransaccion}
                className={`flex-1 text-white rounded-lg py-2 text-xs font-semibold shadow-xs transition ${
                  showModal === "pago" 
                    ? "bg-emerald-600 hover:bg-emerald-700" 
                    : showModal === "cargo" 
                    ? "bg-rose-600 hover:bg-rose-700" 
                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
