"use client";

import { useState, useEffect, useRef } from "react";
import { createCliente } from "@/app/actions/clientes";
import { getSucursales } from "@/app/actions/sucursales";
import { useRouter } from "next/navigation";
import { 
  Save, 
  ArrowLeft, 
  Camera, 
  Upload, 
  User, 
  ShieldCheck, 
  X,
  CreditCard,
  Building2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [selectedSucursales, setSelectedSucursales] = useState<number[]>([]);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSucursales() {
      const res = await getSucursales();
      if (res.success && res.data) {
        setSucursales(res.data);
        if (res.data.length > 0) {
          const activeSId = localStorage.getItem("activeSucursalId");
          const defaultId = activeSId ? parseInt(activeSId) : res.data[0].id;
          setSelectedSucursales([defaultId]);
        }
      }
    }
    loadSucursales();
  }, []);

  const handleCheckboxChange = (id: number) => {
    setSelectedSucursales(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError("La imagen no debe superar los 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setFotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (selectedSucursales.length === 0) {
      setError("Debes seleccionar al menos una sucursal autorizada.");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    const data = {
      documento: (formData.get("documento") as string).trim(),
      nombre: (formData.get("nombre") as string).trim(),
      apellido: (formData.get("apellido") as string).trim(),
      telefono: (formData.get("telefono") as string)?.trim() || undefined,
      email: (formData.get("email") as string)?.trim() || undefined,
      direccion: (formData.get("direccion") as string)?.trim() || undefined,
      foto: fotoBase64 || undefined,
      estado: "activo" as const,
      sucursalesIds: selectedSucursales,
    };

    const res = await createCliente(data);

    if (!res.success) {
      setError(res.error || "Ocurrió un error inesperado al dar de alta al socio.");
      setLoading(false);
    } else {
      setTemporaryPassword(res.temporaryPassword || null);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 font-sans max-w-4xl mx-auto">
      {temporaryPassword && <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950"><p className="font-black">Socio creado correctamente</p><p className="mt-2 text-sm">Contraseña temporal: <code className="rounded bg-white px-2 py-1 font-black">{temporaryPassword}</code></p><p className="mt-2 text-xs">Copiala ahora y entregásela al socio por un canal seguro. Deberá cambiarla al ingresar.</p><button onClick={() => router.push("/dashboard/clientes")} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Volver a socios</button></div>}
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/clientes"
            className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Alta de Nuevo Socio</h2>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Crea el perfil del socio, habilita sus credenciales PWA y su cuenta corriente automáticamente.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-700" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-5">
        
        {/* Foto & Upload Box */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="relative flex-shrink-0">
            {fotoBase64 ? (
              <img
                src={fotoBase64}
                alt="Foto socio"
                className="w-16 h-16 rounded-lg object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200">
                <Camera className="w-6 h-6" />
              </div>
            )}
            {fotoBase64 && (
              <button
                type="button"
                onClick={() => setFotoBase64(null)}
                className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900">Fotografía de Reconocimiento</p>
            <p className="text-[11px] text-slate-600">Visible en pantalla de molinete y credencial del socio.</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-md text-xs font-medium shadow-2xs transition"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-600" />
              <span>{fotoBase64 ? "Cambiar Foto" : "Subir Foto"}</span>
            </button>
          </div>
        </div>

        {/* Datos Personales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ej: Juan"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Apellido *</label>
            <input
              type="text"
              name="apellido"
              required
              placeholder="Ej: Pérez"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">DNI (Documento) *</label>
            <input
              type="text"
              name="documento"
              required
              placeholder="Ej: 38450123"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg font-mono font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
            <input
              type="text"
              name="telefono"
              placeholder="Ej: 1123456789"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              placeholder="Ej: juan@email.com"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Dirección</label>
            <input
              type="text"
              name="direccion"
              placeholder="Ej: Av. San Martín 123"
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Sedes Autorizadas */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Sedes Habilitadas para Acceso
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {sucursales.map(s => (
              <label
                key={s.id}
                className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition"
              >
                <input
                  type="checkbox"
                  checked={selectedSucursales.includes(s.id)}
                  onChange={() => handleCheckboxChange(s.id)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-900">{s.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/dashboard/clientes"
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{loading ? "Guardando socio..." : "Crear Socio (3-en-1)"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
