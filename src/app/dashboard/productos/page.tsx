"use client";

import { useEffect, useState } from "react";
import { getProductos, createProducto, updateProducto, toggleProductoEstado } from "@/app/actions/productos";
import { Package, Plus, Search, Edit2, X, CheckCircle2, AlertCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";

function formatMoney(n: any) { 
  const val = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("activo");
  const [buscar, setBuscar] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ codigo: "", nombre: "", descripcion: "", precio: "", stock: "", stockMinimo: "5", categoria: "" });
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const load = () => {
    getProductos(filtro, buscar).then(r => r.success && setProductos(r.data!));
  };

  useEffect(() => { load(); }, [filtro, buscar]);

  const openNew = () => {
    setEditando(null);
    setForm({ codigo: "", nombre: "", descripcion: "", precio: "", stock: "", stockMinimo: "5", categoria: "" });
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditando(p);
    setForm({ codigo: p.codigo || "", nombre: p.nombre, descripcion: p.descripcion || "", precio: String(p.precio), stock: String(p.stock), stockMinimo: String(p.stockMinimo), categoria: p.categoria || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { codigo: form.codigo || undefined, nombre: form.nombre, descripcion: form.descripcion || undefined, precio: Number(form.precio), stock: Number(form.stock), stockMinimo: Number(form.stockMinimo), categoria: form.categoria || undefined };
    const result = editando ? await updateProducto(editando.id, data) : await createProducto(data);
    if (result.success) { 
      setShowModal(false); 
      setMsg({ type: "success", text: editando ? "Producto actualizado" : "Producto creado con éxito" }); 
      load(); 
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: result.error || "Error" });
    }
  };

  const handleToggle = async (p: any) => {
    await toggleProductoEstado(p.id, p.estado);
    load();
  };

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-cyan-600" />
            Inventario & Stock de Cantina
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Control de productos, reposición y precios de venta en mostrador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/caja"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium shadow-2xs transition"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-cyan-600" />
            <span>Punto de Venta</span>
          </Link>

          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Producto</span>
          </button>
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

      {/* Filtros */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre, código o categoría..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        <select
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
        >
          <option value="activo">Solo Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="todos">Todos los productos</option>
        </select>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left">Código</th>
                <th className="px-4 py-2.5 text-left">Producto</th>
                <th className="px-4 py-2.5 text-left">Categoría</th>
                <th className="px-4 py-2.5 text-right">Precio</th>
                <th className="px-4 py-2.5 text-center">Stock</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {productos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-medium">
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                productos.map(p => {
                  const bajoStock = p.stock <= p.stockMinimo;
                  const sinStock = p.stock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 font-semibold">{p.codigo || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-slate-600 font-medium">{p.categoria || "Cantina"}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-900 tabular-nums">{formatMoney(Number(p.precio))}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            sinStock
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : bajoStock
                              ? "bg-amber-50 text-amber-900 border-amber-300"
                              : "bg-emerald-50 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          {p.stock} un.
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.estado === "activo" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                          {p.estado === "activo" ? "● Activo" : "● Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-2 py-1 bg-white hover:bg-cyan-50 hover:text-cyan-800 text-slate-800 rounded-md text-xs font-semibold border border-slate-300 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggle(p)}
                          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-300 transition"
                        >
                          {p.estado === "activo" ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editando ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código / Barras</label>
                  <input
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value })}
                    placeholder="Ej: 779123456"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <input
                    value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Ej: Bebidas, Suplementos"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Producto *</label>
                <input
                  required
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Bebida Isotónica 500ml"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.precio}
                    onChange={e => setForm({ ...form, precio: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Actual *</label>
                  <input
                    type="number"
                    required
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={form.stockMinimo}
                    onChange={e => setForm({ ...form, stockMinimo: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
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
                  {editando ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
