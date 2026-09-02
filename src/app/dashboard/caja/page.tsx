"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CreditCard,
  DollarSign,
  History,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { getProductosPOS, ItemVentaInput, procesarVentaPOS, searchClientesPOS } from "@/app/actions/pos";

function formatMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value) || 0;
  return "$" + amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PaymentType = "efectivo" | "cuenta_corriente" | "tarjeta" | "transferencia";

export default function CajaPage() {
  const [activeSucursal, setActiveSucursal] = useState<number | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("Sucursal activa");
  const [branchReady, setBranchReady] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [buscarProducto, setBuscarProducto] = useState("");
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [cart, setCart] = useState<ItemVentaInput[]>([]);
  const [buscarCliente, setBuscarCliente] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [tipoPago, setTipoPago] = useState<PaymentType>("efectivo");
  const [notas, setNotas] = useState("");
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketVenta, setTicketVenta] = useState<any | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadProductos = async (branchId: number, categoria = categoriaSeleccionada, query = buscarProducto) => {
    setLoadingProductos(true);
    const result = await getProductosPOS(branchId, categoria === "todas" ? undefined : categoria, query || undefined);
    if (result.success && result.data) {
      setProductos(result.data.productos);
      setCategorias(result.data.categorias);
    } else {
      setError(result.error || "No se pudo cargar el catálogo");
    }
    setLoadingProductos(false);
  };

  useEffect(() => {
    const storedId = Number(localStorage.getItem("activeSucursalId") || 0);
    const storedName = localStorage.getItem("activeSucursalName");
    if (storedName) setSucursalNombre(storedName);
    if (!Number.isInteger(storedId) || storedId <= 0) {
      setBranchReady(true);
      setLoadingProductos(false);
      return;
    }
    setActiveSucursal(storedId);
    setBranchReady(true);
    void loadProductos(storedId, "todas", "");
  }, []);

  useEffect(() => {
    if (buscarCliente.trim().length < 2 || clienteSeleccionado) {
      setClientes([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingClientes(true);
      const result = await searchClientesPOS(buscarCliente);
      if (result.success && result.data) setClientes(result.data);
      setLoadingClientes(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [buscarCliente, clienteSeleccionado]);

  const handleCategoriaChange = (categoria: string) => {
    if (!activeSucursal) return;
    setCategoriaSeleccionada(categoria);
    void loadProductos(activeSucursal, categoria, buscarProducto);
  };

  const handleBuscarProducto = (value: string) => {
    setBuscarProducto(value);
    if (activeSucursal) void loadProductos(activeSucursal, categoriaSeleccionada, value);
  };

  const addToCart = (producto: any) => {
    if (producto.stock <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.productoId === producto.id);
      if (existing) {
        if (existing.cantidad >= producto.stock) return current;
        return current.map((item) => item.productoId === producto.id
          ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precioUnitario }
          : item);
      }
      return [...current, {
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: Number(producto.precio),
        cantidad: 1,
        subtotal: Number(producto.precio),
      }];
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !buscarProducto.trim()) return;
    event.preventDefault();
    const code = buscarProducto.trim().toLowerCase();
    const exact = productos.find((producto) => producto.codigo?.toLowerCase() === code);
    if (exact && exact.stock > 0) {
      addToCart(exact);
      setBuscarProducto("");
      if (activeSucursal) void loadProductos(activeSucursal, categoriaSeleccionada, "");
    }
  };

  const updateQuantity = (productoId: number, delta: number) => {
    const producto = productos.find((item) => item.id === productoId);
    setCart((current) => current
      .map((item) => {
        if (item.productoId !== productoId) return item;
        const cantidad = item.cantidad + delta;
        if (cantidad <= 0) return null;
        if (producto && cantidad > producto.stock) return item;
        return { ...item, cantidad, subtotal: cantidad * item.precioUnitario };
      })
      .filter((item): item is ItemVentaInput => item !== null));
  };

  const clearSale = () => {
    setCart([]);
    setClienteSeleccionado(null);
    setBuscarCliente("");
    setNotas("");
    setError(null);
    setTipoPago("efectivo");
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const articulos = cart.reduce((sum, item) => sum + item.cantidad, 0);

  const processSale = async () => {
    if (!activeSucursal || cart.length === 0) return;
    if (tipoPago === "cuenta_corriente" && !clienteSeleccionado) {
      setError("Para vender a cuenta corriente primero seleccioná un socio.");
      return;
    }
    if (tipoPago === "cuenta_corriente" && clienteSeleccionado) {
      const nuevoSaldo = Number(clienteSeleccionado.saldoCuenta) + total;
      if (nuevoSaldo > Number(clienteSeleccionado.limiteCredito)) {
        setError(`La compra supera el límite disponible de ${formatMoney(clienteSeleccionado.disponibleCredito)}.`);
        return;
      }
    }

    setProcesandoVenta(true);
    setError(null);
    const result = await procesarVentaPOS({
      items: cart,
      clienteId: clienteSeleccionado?.id || null,
      sucursalId: activeSucursal,
      tipoPago,
      notas: notas.trim() || undefined,
    });

    if (result.success && result.data) {
      setTicketVenta(result.data);
      clearSale();
      void loadProductos(activeSucursal, categoriaSeleccionada, "");
      setBuscarProducto("");
      window.setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setError(result.error || "No se pudo procesar la venta");
    }
    setProcesandoVenta(false);
  };

  if (!branchReady) return <div className="py-20 text-center text-sm font-semibold text-slate-500">Preparando punto de venta…</div>;

  if (!activeSucursal) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MapPin className="mx-auto h-7 w-7 text-amber-700" />
        <h1 className="mt-2 text-lg font-black text-amber-950">Seleccioná una sucursal</h1>
        <p className="mt-1 text-sm text-amber-800">Las ventas y el arqueo siempre pertenecen a una sede concreta.</p>
        <Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Seleccionar sucursal</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 font-sans">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Operación de sede</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950"><Store className="h-5 w-5 text-cyan-600" />Ventas de productos</h1>
          <p className="mt-1 text-xs font-medium text-slate-600">Cantina, tienda y consumos. Las membresías se cobran desde <strong>Cobros</strong>.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-950"><MapPin className="h-3.5 w-3.5 text-cyan-600" />{sucursalNombre}</span>
          <Link href="/dashboard/pagos" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50">Cobrar membresía</Link>
          <Link href="/dashboard/caja/movimientos" className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><History className="h-3.5 w-3.5" />Arqueo</Link>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-7 xl:col-span-8">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input ref={searchInputRef} value={buscarProducto} onChange={(event) => handleBuscarProducto(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Buscar producto o escanear código…" className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-xs font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" autoFocus />
            </div>
            <span className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-[11px] font-bold text-cyan-900"><Barcode className="h-3.5 w-3.5" />Lector listo</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {["todas", ...categorias].map((categoria) => (
              <button key={categoria} onClick={() => handleCategoriaChange(categoria)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${categoriaSeleccionada === categoria ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {categoria === "todas" ? "Todos" : categoria}
              </button>
            ))}
          </div>

          {loadingProductos ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs font-semibold text-slate-500">Cargando catálogo…</div>
          ) : productos.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-2 text-sm font-black text-slate-900">Sin productos para mostrar</p><p className="text-xs text-slate-500">Probá otra búsqueda o categoría.</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {productos.map((producto) => {
                const enCarrito = cart.find((item) => item.productoId === producto.id);
                const sinStock = producto.stock <= 0;
                const stockBajo = producto.stock > 0 && producto.stock <= producto.stockMinimo;
                return (
                  <button key={producto.id} onClick={() => addToCart(producto)} disabled={sinStock} className={`relative flex min-h-28 flex-col justify-between rounded-xl border p-3 text-left transition ${sinStock ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-55" : enCarrito ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}>
                    {enCarrito && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-cyan-600 text-[10px] font-black text-white">{enCarrito.cantidad}</span>}
                    <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{producto.categoria || "Producto"}</p><h2 className="mt-1 line-clamp-2 text-xs font-black leading-tight text-slate-950">{producto.nombre}</h2></div>
                    <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2"><strong className="font-mono text-xs text-slate-950">{formatMoney(producto.precio)}</strong><span className={`rounded border px-1.5 py-0.5 text-[9px] font-black ${sinStock ? "border-rose-200 bg-rose-50 text-rose-700" : stockBajo ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{sinStock ? "Sin stock" : `${producto.stock} disp.`}</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="sticky top-20 space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs lg:col-span-5 xl:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-cyan-600" /><h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Venta actual</h2><span className="text-[11px] font-bold text-slate-500">{articulos} ítems</span></div>
            {cart.length > 0 && <button onClick={clearSale} className="text-[11px] font-bold text-rose-600 hover:underline">Vaciar</button>}
          </div>

          {error && <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs font-semibold text-rose-950"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />{error}</div>}

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-500"><ShoppingCart className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-1 text-xs font-black text-slate-800">Carrito vacío</p><p className="text-[10px]">Elegí un producto para empezar.</p></div>
            ) : cart.map((item) => (
              <div key={item.productoId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-950">{item.nombre}</p><p className="text-[10px] font-mono text-slate-500">{formatMoney(item.precioUnitario)} c/u</p></div>
                <div className="flex items-center rounded-md border border-slate-300 bg-white"><button onClick={() => updateQuantity(item.productoId, -1)} className="p-1 text-slate-600"><Minus className="h-3 w-3" /></button><span className="w-6 text-center text-xs font-black">{item.cantidad}</span><button onClick={() => updateQuantity(item.productoId, 1)} className="p-1 text-slate-600"><Plus className="h-3 w-3" /></button></div>
                <div className="text-right"><p className="font-mono text-xs font-black text-slate-950">{formatMoney(item.subtotal)}</p><button onClick={() => setCart((current) => current.filter((row) => row.productoId !== item.productoId))} className="text-slate-400 hover:text-rose-600"><Trash2 className="ml-auto h-3 w-3" /></button></div>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between"><label className="text-xs font-black uppercase tracking-wider text-slate-700">Socio <span className="font-medium text-slate-400">(opcional)</span></label>{clienteSeleccionado && <button onClick={() => { setClienteSeleccionado(null); setBuscarCliente(""); }} className="text-[11px] font-bold text-cyan-700">Cambiar</button>}</div>
            {clienteSeleccionado ? (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-2.5"><p className="text-xs font-black text-slate-950">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</p><div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-600"><span>DNI {clienteSeleccionado.documento}</span><span>Disponible {formatMoney(clienteSeleccionado.disponibleCredito)}</span></div></div>
            ) : (
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={buscarCliente} onChange={(event) => setBuscarCliente(event.target.value)} placeholder={loadingClientes ? "Buscando…" : "DNI o nombre"} className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-xs outline-none focus:border-cyan-500" />{clientes.length > 0 && <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">{clientes.map((cliente) => <button key={cliente.id} onClick={() => { setClienteSeleccionado(cliente); setClientes([]); setBuscarCliente(""); }} className="flex w-full items-center justify-between border-b border-slate-100 p-2 text-left last:border-0 hover:bg-cyan-50"><div><p className="text-xs font-black text-slate-950">{cliente.nombre} {cliente.apellido}</p><p className="text-[10px] text-slate-500">DNI {cliente.documento}</p></div><span className="text-[10px] font-bold text-slate-600">Disp. {formatMoney(cliente.disponibleCredito)}</span></button>)}</div>}</div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">Medio de pago</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: "efectivo", label: "Efectivo", icon: DollarSign },
                { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
                { id: "transferencia", label: "Transferencia", icon: Receipt },
                { id: "cuenta_corriente", label: "Cuenta corriente", icon: History },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTipoPago(id)} className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-[11px] font-bold ${tipoPago === id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
              ))}
            </div>
          </div>

          <div><label className="text-xs font-black uppercase tracking-wider text-slate-700">Nota <span className="font-medium text-slate-400">(opcional)</span></label><input value={notas} onChange={(event) => setNotas(event.target.value)} placeholder="Detalle de la venta…" className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-cyan-500" /></div>

          <div className="space-y-3 border-t border-slate-100 pt-3"><div className="flex items-center justify-between"><span className="text-sm font-black text-slate-800">Total</span><strong className="font-mono text-xl text-slate-950">{formatMoney(total)}</strong></div><button onClick={processSale} disabled={cart.length === 0 || procesandoVenta} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{procesandoVenta ? "Procesando…" : `Cobrar ${formatMoney(total)}`}</button></div>
        </aside>
      </div>

      {ticketVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="relative bg-slate-950 p-4 text-center text-white"><button onClick={() => setTicketVenta(null)} className="absolute right-3 top-3 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button><CheckCircle2 className="mx-auto h-6 w-6 text-cyan-400" /><h2 className="mt-1 text-sm font-black">Venta registrada</h2><p className="text-[10px] font-mono text-slate-400">Ticket #{ticketVenta.id}</p></div>
            <div className="space-y-3 p-4 font-mono text-xs text-slate-800"><div className="border-b border-dashed border-slate-200 pb-2 text-center"><p className="font-black text-slate-950">{ticketVenta.sucursal}</p><p className="text-[10px] text-slate-500">{new Date(ticketVenta.fechaVenta).toLocaleString("es-AR")}</p></div><div className="text-[11px]"><p><strong>Cliente:</strong> {ticketVenta.cliente}</p><p><strong>Pago:</strong> {ticketVenta.tipoPago.toUpperCase()}</p><p><strong>Cajero:</strong> {ticketVenta.vendedor}</p></div><div className="space-y-1 border-y border-dashed border-slate-200 py-2">{ticketVenta.items.map((item: any) => <div key={item.id} className="flex justify-between gap-2 text-[11px]"><span className="truncate">{item.cantidad}x {item.nombre}</span><strong>{formatMoney(item.subtotal)}</strong></div>)}</div><div className="flex justify-between font-black"><span>TOTAL</span><span className="text-sm">{formatMoney(ticketVenta.total)}</span></div></div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3"><button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold"><Printer className="h-3.5 w-3.5" />Imprimir</button><button onClick={() => setTicketVenta(null)} className="flex-1 rounded-lg bg-slate-950 py-2 text-xs font-bold text-white">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
