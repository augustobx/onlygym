"use client";

import { useState, useEffect, useRef } from "react";
import { 
  getProductosPOS, 
  searchClientesPOS, 
  procesarVentaPOS, 
  ItemVentaInput 
} from "@/app/actions/pos";
import { 
  searchClientes, 
  getMembresiasDisponibles, 
  registrarPago 
} from "@/app/actions/caja";
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  UserCheck, 
  UserX, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Barcode, 
  Store, 
  Receipt, 
  History,
  X,
  PackageCheck,
  Zap,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

function formatMoney(amount: any) {
  const val = typeof amount === "number" && !isNaN(amount) ? amount : Number(amount) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "membresias">("pos");
  const [activeSucursal, setActiveSucursal] = useState<number>(1);
  const [sucursalNombre, setSucursalNombre] = useState<string>("Sede Principal");

  // POS Kiosco
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [buscarProducto, setBuscarProducto] = useState<string>("");
  const [loadingProductos, setLoadingProductos] = useState<boolean>(true);

  // Carrito
  const [cart, setCart] = useState<ItemVentaInput[]>([]);
  
  // Cliente POS
  const [buscarClientePOS, setBuscarClientePOS] = useState<string>("");
  const [clientesPOS, setClientesPOS] = useState<any[]>([]);
  const [clienteSeleccionadoPOS, setClienteSeleccionadoPOS] = useState<any | null>(null);
  const [loadingClientesPOS, setLoadingClientesPOS] = useState<boolean>(false);

  // Pago POS
  const [tipoPagoPOS, setTipoPagoPOS] = useState<"efectivo" | "cuenta_corriente" | "tarjeta" | "transferencia">("efectivo");
  const [notasPOS, setNotasPOS] = useState<string>("");
  const [procesandoVenta, setProcesandoVenta] = useState<boolean>(false);
  const [errorPOS, setErrorPOS] = useState<string | null>(null);

  // Modal Ticket
  const [ticketVenta, setTicketVenta] = useState<any | null>(null);

  // Cobro Membresías
  const [queryMem, setQueryMem] = useState("");
  const [clientesMem, setClientesMem] = useState<any[]>([]);
  const [membresias, setMembresias] = useState<any[]>([]);
  const [selectedClienteMem, setSelectedClienteMem] = useState<any | null>(null);
  const [selectedMembresiaId, setSelectedMembresiaId] = useState<number | "">("");
  const [loadingSearchMem, setLoadingSearchMem] = useState(false);
  const [loadingPagoMem, setLoadingPagoMem] = useState(false);
  const [successMsgMem, setSuccessMsgMem] = useState("");
  const [errorMsgMem, setErrorMsgMem] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sId = localStorage.getItem("activeSucursalId");
    const sName = localStorage.getItem("activeSucursalName");
    const sucursalActual = sId ? parseInt(sId) : 1;
    setActiveSucursal(sucursalActual);
    if (sName) setSucursalNombre(sName);

    loadProductos(sucursalActual);
    getMembresiasDisponibles().then(res => {
      if (res.success && res.data) setMembresias(res.data);
    });
  }, []);

  const loadProductos = async (sucId = activeSucursal, cat = categoriaSeleccionada, q = buscarProducto) => {
    setLoadingProductos(true);
    const res = await getProductosPOS(
      sucId,
      cat === "todas" ? undefined : cat,
      q || undefined
    );

    if (res.success && res.data) {
      setProductos(res.data.productos);
      setCategorias(res.data.categorias);
    }
    setLoadingProductos(false);
  };

  const handleCategoriaChange = (cat: string) => {
    setCategoriaSeleccionada(cat);
    loadProductos(activeSucursal, cat, buscarProducto);
  };

  const handleBuscarProductoChange = (val: string) => {
    setBuscarProducto(val);
    loadProductos(activeSucursal, categoriaSeleccionada, val);
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && buscarProducto.trim()) {
      e.preventDefault();
      const code = buscarProducto.trim();
      const exactMatch = productos.find(p => p.codigo?.toLowerCase() === code.toLowerCase());

      if (exactMatch && exactMatch.stock > 0) {
        addToCart(exactMatch);
        setBuscarProducto("");
        loadProductos(activeSucursal, categoriaSeleccionada, "");
      }
    }
  };

  useEffect(() => {
    if (buscarClientePOS.trim().length < 2) {
      setClientesPOS([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingClientesPOS(true);
      const res = await searchClientesPOS(buscarClientePOS);
      if (res.success && res.data) {
        setClientesPOS(res.data);
      }
      setLoadingClientesPOS(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [buscarClientePOS]);

  const addToCart = (prod: any) => {
    if (prod.stock <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.productoId === prod.id);
      if (existing) {
        if (existing.cantidad >= prod.stock) return prev;
        return prev.map(item =>
          item.productoId === prod.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precioUnitario,
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productoId: prod.id,
            nombre: prod.nombre,
            precioUnitario: Number(prod.precio),
            cantidad: 1,
            subtotal: Number(prod.precio),
          },
        ];
      }
    });
  };

  const updateQuantity = (productoId: number, delta: number) => {
    const prod = productos.find(p => p.id === productoId);
    setCart(prev =>
      prev
        .map(item => {
          if (item.productoId === productoId) {
            const nuevaCant = item.cantidad + delta;
            if (nuevaCant <= 0) return null;
            if (prod && nuevaCant > prod.stock) return item;
            return {
              ...item,
              cantidad: nuevaCant,
              subtotal: nuevaCant * item.precioUnitario,
            };
          }
          return item;
        })
        .filter((item): item is ItemVentaInput => item !== null)
    );
  };

  const removeFromCart = (productoId: number) => {
    setCart(prev => prev.filter(item => item.productoId !== productoId));
  };

  const clearCart = () => {
    setCart([]);
    setClienteSeleccionadoPOS(null);
    setBuscarClientePOS("");
    setNotasPOS("");
    setErrorPOS(null);
  };

  const totalCarrito = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalArticulos = cart.reduce((sum, item) => sum + item.cantidad, 0);

  const handleProcesarVentaPOS = async () => {
    if (cart.length === 0) return;

    if (tipoPagoPOS === "cuenta_corriente" && !clienteSeleccionadoPOS) {
      setErrorPOS("Debes asociar un socio para vender a Cuenta Corriente.");
      return;
    }

    if (tipoPagoPOS === "cuenta_corriente" && clienteSeleccionadoPOS) {
      const nuevoSaldo = clienteSeleccionadoPOS.saldoCuenta + totalCarrito;
      if (nuevoSaldo > clienteSeleccionadoPOS.limiteCredito) {
        setErrorPOS(
          `Límite de crédito excedido. Saldo + Compra supera el cupo de ${formatMoney(clienteSeleccionadoPOS.limiteCredito)}.`
        );
        return;
      }
    }

    setProcesandoVenta(true);
    setErrorPOS(null);

    const res = await procesarVentaPOS({
      items: cart,
      clienteId: clienteSeleccionadoPOS?.id || null,
      sucursalId: activeSucursal,
      tipoPago: tipoPagoPOS,
      notas: notasPOS || undefined,
    });

    if (res.success && res.data) {
      setTicketVenta(res.data);
      clearCart();
      loadProductos();
    } else {
      setErrorPOS(res.error || "Ocurrió un error al procesar la venta");
    }

    setProcesandoVenta(false);
  };

  const handleSearchMem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryMem.trim() || !activeSucursal) return;
    setLoadingSearchMem(true);
    const res = await searchClientes(queryMem, activeSucursal);
    if (res.success && res.data) setClientesMem(res.data);
    setLoadingSearchMem(false);
  };

  const handleCobrarMem = async () => {
    if (!selectedClienteMem || selectedMembresiaId === "" || !activeSucursal) return;
    setLoadingPagoMem(true);
    setSuccessMsgMem("");
    setErrorMsgMem("");

    const mem = membresias.find(m => m.id === Number(selectedMembresiaId));

    const res = await registrarPago({
      clienteId: selectedClienteMem.id,
      membresiaId: Number(selectedMembresiaId),
      sucursalId: activeSucursal,
      monto: Number(mem.precio),
    });

    if (res.success) {
      setSuccessMsgMem(`Pago registrado exitosamente para ${selectedClienteMem.nombre} ${selectedClienteMem.apellido}.`);
      setSelectedClienteMem(null);
      setClientesMem([]);
      setQueryMem("");
      setSelectedMembresiaId("");
    } else {
      setErrorMsgMem(res.error || "Ocurrió un error");
    }
    setLoadingPagoMem(false);
  };

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="h-5 w-5 text-cyan-600" />
            Punto de Venta / Caja
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Sede: <strong className="text-slate-900">{sucursalNombre}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab("pos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeTab === "pos"
                  ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5 text-cyan-600" />
              <span>Cantina / POS</span>
            </button>
            <button
              onClick={() => setActiveTab("membresias")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeTab === "membresias"
                  ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5 text-cyan-600" />
              <span>Cobro de Membresías</span>
            </button>
          </div>

          <Link
            href="/dashboard/caja/movimientos"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-50 shadow-2xs transition"
          >
            <History className="h-3.5 w-3.5 text-slate-600" />
            <span>Arqueo</span>
          </Link>
        </div>
      </div>

      {/* POS KIOSCO */}
      {activeTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Lado Izquierdo: Catálogo de Productos (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-3">
            
            {/* Buscador & Scanner */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={buscarProducto}
                  onChange={e => handleBuscarProductoChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar producto o escanear código de barras..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 text-cyan-900 rounded-lg text-xs font-mono font-semibold self-center sm:self-auto border border-cyan-200">
                <Barcode className="h-3.5 w-3.5 text-cyan-600" />
                <span className="text-[11px]">Lector activo</span>
              </div>
            </div>

            {/* Categorías */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => handleCategoriaChange("todas")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                  categoriaSeleccionada === "todas"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                Todas las categorías
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoriaChange(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                    categoriaSeleccionada === cat
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de Productos */}
            {loadingProductos ? (
              <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200/90 text-xs font-medium">
                Cargando catálogo...
              </div>
            ) : productos.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200/90">
                <PackageCheck className="h-8 w-8 mx-auto text-slate-400 mb-1" />
                <p className="font-bold text-slate-900 text-xs">No se encontraron productos</p>
                <p className="text-[11px] text-slate-500">Intenta con otro término o categoría.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {productos.map(p => {
                  const enCarrito = cart.find(item => item.productoId === p.id);
                  const sinStock = p.stock <= 0;
                  const stockBajo = p.stock > 0 && p.stock <= p.stockMinimo;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={sinStock}
                      className={`relative text-left p-3 rounded-lg border transition-all flex flex-col justify-between ${
                        sinStock
                          ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                          : enCarrito
                          ? "bg-cyan-50/90 border-cyan-500 ring-2 ring-cyan-500/30"
                          : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs active:scale-98"
                      }`}
                    >
                      {enCarrito && (
                        <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                          {enCarrito.cantidad}
                        </span>
                      )}

                      <div>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                          <span className="truncate max-w-[80px]">{p.categoria || "Cantina"}</span>
                          {p.codigo && <span className="font-mono">{p.codigo}</span>}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                          {p.nombre}
                        </h4>
                      </div>

                      <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-end justify-between">
                        <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                          {formatMoney(p.precio)}
                        </span>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            sinStock
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : stockBajo
                              ? "bg-amber-50 text-amber-900 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {sinStock ? "Agotado" : `${p.stock} disp.`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lado Derecho: Carrito & Cobro (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 space-y-4 sticky top-20">
            
            {/* Carrito Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-cyan-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Carrito de Venta</h3>
                <span className="text-[11px] text-slate-600 font-mono font-semibold">({totalArticulos})</span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                >
                  Vaciar
                </button>
              )}
            </div>

            {errorPOS && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-900 text-xs rounded-lg flex items-start gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-700" />
                <span>{errorPOS}</span>
              </div>
            )}

            {/* Items Carrito */}
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 text-xs">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <ShoppingCart className="h-6 w-6 mx-auto text-slate-400 mb-1" />
                  <p className="font-bold text-slate-800">Carrito vacío</p>
                  <p className="text-[11px] text-slate-500">Haz clic en los productos para agregarlos.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.productoId}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate">{item.nombre}</p>
                      <p className="text-[10px] text-slate-600 font-mono font-medium">{formatMoney(item.precioUnitario)} c/u</p>
                    </div>

                    <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-slate-300">
                      <button
                        onClick={() => updateQuantity(item.productoId, -1)}
                        className="p-0.5 text-slate-600 hover:text-cyan-700 rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center font-bold text-xs text-slate-900 font-mono">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productoId, 1)}
                        className="p-0.5 text-slate-600 hover:text-cyan-700 rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-right pl-2.5">
                      <p className="font-bold font-mono text-slate-900 tabular-nums">{formatMoney(item.subtotal)}</p>
                      <button
                        onClick={() => removeFromCart(item.productoId)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Socio Selector */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Socio (Opcional / Cta. Cte.)
              </label>

              {clienteSeleccionadoPOS ? (
                <div className="p-2.5 bg-cyan-50/70 border border-cyan-200 rounded-lg space-y-0.5 relative text-xs">
                  <button
                    onClick={() => setClienteSeleccionadoPOS(null)}
                    className="absolute top-2 right-2 text-cyan-700 hover:text-cyan-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="font-bold text-slate-900">
                    {clienteSeleccionadoPOS.nombre} {clienteSeleccionadoPOS.apellido}
                  </p>
                  <p className="text-[10px] text-cyan-900 font-mono font-semibold">DNI: {clienteSeleccionadoPOS.documento}</p>
                  <div className="pt-1 border-t border-cyan-200/60 flex items-center justify-between text-[10px] font-mono">
                    <span>Deuda: <strong className={clienteSeleccionadoPOS.saldoCuenta > 0 ? "text-rose-600" : "text-emerald-700"}>{formatMoney(clienteSeleccionadoPOS.saldoCuenta)}</strong></span>
                    <span>Disp: <strong className="text-slate-900">{formatMoney(clienteSeleccionadoPOS.disponibleCredito)}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={buscarClientePOS}
                    onChange={e => setBuscarClientePOS(e.target.value)}
                    placeholder="Buscar socio por DNI o nombre..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />

                  {clientesPOS.length > 0 && !clienteSeleccionadoPOS && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {clientesPOS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setClienteSeleccionadoPOS(c);
                            setClientesPOS([]);
                            setBuscarClientePOS("");
                          }}
                          className="w-full text-left p-2 hover:bg-slate-50 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{c.nombre} {c.apellido}</p>
                            <p className="text-[10px] text-slate-600 font-mono">DNI: {c.documento}</p>
                          </div>
                          <span className={`text-[10px] font-mono font-bold ${c.saldoCuenta > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                            {formatMoney(c.saldoCuenta)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Método de Pago */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Método de Pago</label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: "efectivo", label: "Efectivo", icon: DollarSign },
                  { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
                  { id: "transferencia", label: "Transferencia", icon: Receipt },
                  { id: "cuenta_corriente", label: "Cta. Cte.", icon: History },
                ].map(m => {
                  const Icon = m.icon;
                  const isSel = tipoPagoPOS === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTipoPagoPOS(m.id as any)}
                      className={`p-2 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition ${
                        isSel
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total y Checkout */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5">
              <div className="flex items-center justify-between text-slate-900 font-bold text-sm">
                <span>Total a Cobrar</span>
                <span className="text-xl font-mono tabular-nums text-slate-900">{formatMoney(totalCarrito)}</span>
              </div>

              <button
                disabled={cart.length === 0 || procesandoVenta}
                onClick={handleProcesarVentaPOS}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
              >
                {procesandoVenta ? (
                  "Procesando venta..."
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Cobrar {formatMoney(totalCarrito)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COBRO DE MEMBRESÍAS TAB */}
      {activeTab === "membresias" && (
        <div className="max-w-3xl mx-auto space-y-4">
          {successMsgMem && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0" />
              <span>{successMsgMem}</span>
            </div>
          )}

          {errorMsgMem && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 text-rose-700 flex-shrink-0" />
              <span>{errorMsgMem}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-cyan-600" />
                Cobro de Cuota de Membresía
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Busca al socio y selecciona el plan para renovar su acceso.
              </p>
            </div>

            {/* 1. Buscar Socio */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                1. Buscar Socio
              </label>
              <form onSubmit={handleSearchMem} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={queryMem}
                    onChange={e => {
                      setQueryMem(e.target.value);
                      if (selectedClienteMem) setSelectedClienteMem(null);
                    }}
                    placeholder="DNI, Nombre o Apellido..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingSearchMem}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  {loadingSearchMem ? "Buscando..." : "Buscar"}
                </button>
              </form>

              {clientesMem.length > 0 && !selectedClienteMem && (
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 bg-white shadow-lg max-h-48 overflow-y-auto text-xs">
                  {clientesMem.map(c => {
                    const ultimoPago = c.pagos?.[0];
                    const alDia = ultimoPago && new Date(ultimoPago.fechaVencimiento) >= new Date();

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClienteMem(c);
                          setClientesMem([]);
                          setQueryMem(`${c.nombre} ${c.apellido}`);
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{c.nombre} {c.apellido}</p>
                          <p className="text-[10px] text-slate-600 font-mono font-semibold">DNI: {c.documento}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            alDia ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-rose-50 text-rose-800 border-rose-300"
                          }`}
                        >
                          {alDia ? "● Al Día" : "● Vencido"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedClienteMem && (
                <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs">
                      {selectedClienteMem.nombre.charAt(0)}{selectedClienteMem.apellido.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{selectedClienteMem.nombre} {selectedClienteMem.apellido}</p>
                      <p className="text-[10px] text-cyan-900 font-mono font-semibold">DNI: {selectedClienteMem.documento}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClienteMem(null);
                      setQueryMem("");
                    }}
                    className="text-xs text-cyan-700 font-bold hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>

            {/* 2. Seleccionar Plan */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                2. Seleccionar Plan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {membresias.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMembresiaId(m.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedMembresiaId === m.id
                        ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                        : "bg-white border-slate-300 hover:border-slate-400 text-slate-800"
                    }`}
                  >
                    <p className="font-bold">{m.nombre}</p>
                    <p className={`text-[10px] ${selectedMembresiaId === m.id ? "text-slate-300" : "text-slate-500"}`}>
                      {m.diasDuracion} días
                    </p>
                    <p className={`text-base font-bold font-mono mt-2 tabular-nums ${selectedMembresiaId === m.id ? "text-white" : "text-slate-900"}`}>
                      {formatMoney(Number(m.precio))}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={!selectedClienteMem || selectedMembresiaId === "" || loadingPagoMem}
                onClick={handleCobrarMem}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loadingPagoMem ? "Registrando Pago..." : "Confirmar Cobro de Membresía"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ticket de Venta */}
      {ticketVenta && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-900 p-4 text-white text-center relative">
              <button
                onClick={() => setTicketVenta(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <CheckCircle2 className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
              <h3 className="text-sm font-bold">Venta Registrada</h3>
              <p className="text-[11px] text-slate-300 font-mono">Ticket #{ticketVenta.id}</p>
            </div>

            <div className="p-4 space-y-3 font-mono text-xs text-slate-800">
              <div className="text-center pb-2 border-b border-dashed border-slate-200">
                <p className="font-bold text-slate-900">{ticketVenta.sucursal}</p>
                <p className="text-[10px] text-slate-500">{new Date(ticketVenta.fechaVenta).toLocaleString("es-AR")}</p>
              </div>

              <div className="space-y-0.5 text-[11px]">
                <p><strong>Cliente:</strong> {ticketVenta.cliente}</p>
                {ticketVenta.documento && <p><strong>DNI:</strong> {ticketVenta.documento}</p>}
                <p><strong>Pago:</strong> {ticketVenta.tipoPago.toUpperCase()}</p>
                <p><strong>Cajero:</strong> {ticketVenta.vendedor}</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-200 py-2 space-y-1">
                {ticketVenta.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between items-center text-[11px]">
                    <span className="truncate max-w-[170px]">{it.cantidad}x {it.nombre}</span>
                    <span className="font-bold">{formatMoney(it.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span>TOTAL:</span>
                <span className="text-sm text-slate-900">{formatMoney(ticketVenta.total)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-white border border-slate-300 text-slate-800 rounded-lg font-medium text-xs hover:bg-slate-50 flex items-center justify-center gap-1 shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-cyan-600" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setTicketVenta(null)}
                className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-semibold text-xs hover:bg-slate-800 shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
