"use client";

import { useEffect, useRef, useState } from "react";
import { createCliente } from "@/app/actions/clientes";
import { getSucursales } from "@/app/actions/sucursales";
import { buildMemberWelcomeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  MessageCircle,
  Save,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";

type CreatedMember = {
  id: number;
  name: string;
  document: string;
  phone?: string;
  temporaryPassword: string;
};

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMember, setCreatedMember] = useState<CreatedMember | null>(null);
  const [copied, setCopied] = useState(false);

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
          const validDefault = res.data.some((branch: any) => branch.id === defaultId) ? defaultId : res.data[0].id;
          setSelectedSucursales([validDefault]);
        }
      }
    }
    loadSucursales();
  }, []);

  const handleCheckboxChange = (id: number) => {
    setSelectedSucursales((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
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

    if (!res.success || !res.data || !res.temporaryPassword) {
      setError(res.error || "Ocurrió un error inesperado al dar de alta al socio.");
      setLoading(false);
      return;
    }

    setCreatedMember({
      id: res.data.id,
      name: `${data.nombre} ${data.apellido}`.trim(),
      document: data.documento,
      phone: data.telefono,
      temporaryPassword: res.temporaryPassword,
    });
    setLoading(false);
  }

  if (createdMember) {
    const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";
    const welcomeMessage = buildMemberWelcomeMessage({
      name: createdMember.name,
      document: createdMember.document,
      temporaryPassword: createdMember.temporaryPassword,
      portalUrl,
    });
    const whatsappUrl = buildWhatsAppUrl(createdMember.phone, welcomeMessage);

    const copyCredentials = async () => {
      await navigator.clipboard.writeText(welcomeMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="mx-auto max-w-3xl space-y-5 font-sans">
        <div className="rounded-2xl border border-emerald-300 bg-white shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 p-5">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-emerald-950">Socio creado correctamente</h2>
              <p className="mt-1 text-xs font-medium text-emerald-800">
                El perfil, el acceso al portal y la cuenta corriente ya quedaron habilitados.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{createdMember.name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">DNI {createdMember.document}</p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                  Clave de un solo uso
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Usuario</p>
                  <code className="mt-1 block text-sm font-black text-slate-950">{createdMember.document}</code>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contraseña temporal</p>
                  <code className="mt-1 block text-sm font-black text-slate-950">{createdMember.temporaryPassword}</code>
                </div>
              </div>

              <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-600">
                Esta contraseña se muestra ahora para que puedas entregársela al socio. Al iniciar sesión deberá reemplazarla por una propia.
              </p>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Entregar acceso</p>
              <div className="flex flex-wrap gap-2">
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar por WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500">
                    Sin WhatsApp registrado
                  </span>
                )}

                <button
                  type="button"
                  onClick={copyCredentials}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copiado" : "Copiar mensaje"}
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setCreatedMember(null);
                  setCopied(false);
                  setFotoBase64(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4" />
                Crear otro socio
              </button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/clientes")}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Volver a socios
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/clientes/${createdMember.id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800"
                >
                  Abrir ficha del socio
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/clientes"
            className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Nuevo socio</h2>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Cargá sus datos y el sistema preparará automáticamente el portal y la cuenta corriente.
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

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-5">
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
            <p className="text-xs font-bold text-slate-900">Foto del socio</p>
            <p className="text-[11px] text-slate-600">Se usa en la ficha y en el control de ingreso.</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-md text-xs font-medium shadow-2xs transition"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-600" />
              <span>{fotoBase64 ? "Cambiar foto" : "Subir foto"}</span>
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Datos personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre *</label>
              <input type="text" name="nombre" required placeholder="Ej: Juan" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Apellido *</label>
              <input type="text" name="apellido" required placeholder="Ej: Pérez" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">DNI *</label>
              <input type="text" name="documento" required placeholder="Ej: 38450123" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg font-mono font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
              <input type="text" name="telefono" placeholder="Ej: +54 9 11 2345-6789" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-mono" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <input type="email" name="email" placeholder="Ej: juan@email.com" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dirección</label>
              <input type="text" name="direccion" placeholder="Ej: Av. San Martín 123" className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
            Sedes habilitadas para acceso
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {sucursales.map((s) => (
              <label key={s.id} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input type="checkbox" checked={selectedSucursales.includes(s.id)} onChange={() => handleCheckboxChange(s.id)} className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4" />
                <span className="font-semibold text-slate-900">{s.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <Link href="/dashboard/clientes" className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
            Cancelar
          </Link>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition">
            <Save className="h-3.5 w-3.5" />
            <span>{loading ? "Guardando socio..." : "Crear socio"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
