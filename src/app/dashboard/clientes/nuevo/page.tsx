"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStaffNavigationContext } from "@/app/actions/auth-actions";
import { createCliente } from "@/app/actions/clientes";
import { getSucursales } from "@/app/actions/sucursales";
import { buildMemberWelcomeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  CreditCard,
  MapPin,
  MessageCircle,
  Save,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

type CreatedMember = {
  id: number;
  name: string;
  document: string;
  phone?: string;
  temporaryPassword: string;
};

export default function NuevoClientePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [branchReady, setBranchReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMember, setCreatedMember] = useState<CreatedMember | null>(null);
  const [copied, setCopied] = useState(false);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [selectedSucursales, setSelectedSucursales] = useState<number[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [activeBranchName, setActiveBranchName] = useState("Sucursal activa");
  const [role, setRole] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [navigation, branches] = await Promise.all([getStaffNavigationContext(), getSucursales()]);

      if (navigation.success && navigation.data) {
        setRole(navigation.data.role);
        setActiveBranchId(navigation.data.branchId);
        setActiveBranchName(navigation.data.branchName || "Sucursal activa");
        if (navigation.data.branchId) setSelectedSucursales([navigation.data.branchId]);
        else setError("Seleccioná una sucursal antes de dar de alta un socio.");
      } else {
        setError("No se pudo validar la sede activa.");
      }

      if (branches.success && branches.data) setSucursales(branches.data);
      else if (!branches.success) setError(branches.error || "No se pudieron cargar las sedes disponibles.");
      setBranchReady(true);
    })();
  }, []);

  const handleCheckboxChange = (id: number) => {
    if (!activeBranchId || id === activeBranchId || role === "RECEPCION") return;
    setSelectedSucursales((current) => current.includes(id) ? current.filter((branchId) => branchId !== id) : [...current, id]);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("La imagen no debe superar los 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBranchId || selectedSucursales.length === 0) {
      setError("Seleccioná una sede activa antes de crear el socio.");
      return;
    }

    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const data = {
      documento: String(formData.get("documento") || "").trim(),
      nombre: String(formData.get("nombre") || "").trim(),
      apellido: String(formData.get("apellido") || "").trim(),
      telefono: String(formData.get("telefono") || "").trim() || undefined,
      email: String(formData.get("email") || "").trim() || undefined,
      direccion: String(formData.get("direccion") || "").trim() || undefined,
      foto: fotoBase64 || undefined,
      estado: "activo" as const,
      sucursalesIds: selectedSucursales,
    };

    const result = await createCliente(data);
    if (!result.success || !result.data || !result.temporaryPassword) {
      setError(result.error || "Ocurrió un error inesperado al dar de alta al socio.");
      setLoading(false);
      return;
    }

    setCreatedMember({
      id: result.data.id,
      name: `${data.nombre} ${data.apellido}`.trim(),
      document: data.documento,
      phone: data.telefono,
      temporaryPassword: result.temporaryPassword,
    });
    setLoading(false);
  }

  if (!branchReady) return <p className="py-20 text-center text-sm font-semibold text-slate-500">Preparando alta de socio…</p>;

  if (!activeBranchId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MapPin className="mx-auto h-7 w-7 text-amber-700" />
        <h1 className="mt-2 text-lg font-black text-amber-950">Seleccioná una sucursal</h1>
        <p className="mt-1 text-sm text-amber-800">Cada alta se origina desde una sede activa y validada por el servidor.</p>
        <Link href="/seleccionar-sucursal" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Seleccionar sucursal</Link>
      </div>
    );
  }

  if (createdMember) {
    const portalUrl = `${window.location.origin}/portal/login`;
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
        <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 p-5">
            <div className="rounded-xl bg-emerald-600 p-2 text-white"><CheckCircle2 className="h-5 w-5" /></div>
            <div><h1 className="text-lg font-black text-emerald-950">Socio creado correctamente</h1><p className="mt-1 text-xs font-medium text-emerald-800">Perfil y portal listos. La cuenta corriente quedó creada sin crédito preautorizado.</p></div>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{createdMember.name}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">DNI {createdMember.document} · {activeBranchName}</p></div><span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">Mostrar una sola vez</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><Credential label="Usuario" value={createdMember.document} /><Credential label="Contraseña temporal" value={createdMember.temporaryPassword} /></div>
              <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-600">Entregá estos datos ahora. En el primer ingreso el socio deberá reemplazar la contraseña temporal.</p>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Entregar acceso</p>
              <div className="flex flex-wrap gap-2">
                {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</a> : <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500">Sin WhatsApp registrado</span>}
                <button type="button" onClick={copyCredentials} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"><Copy className="h-4 w-4" />{copied ? "Copiado" : "Copiar mensaje"}</button>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-xs font-black text-cyan-950">Siguiente paso recomendado</p>
              <p className="mt-1 text-[11px] font-medium text-cyan-800">Asigná y cobrá la primera membresía para que el socio quede listo para ingresar.</p>
              <div className="mt-3 flex flex-wrap gap-2"><Link href={`/dashboard/pagos?clienteId=${createdMember.id}`} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-black text-white"><CreditCard className="h-4 w-4" />Cobrar primera membresía</Link><Link href={`/dashboard/clientes/${createdMember.id}`} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2.5 text-xs font-black text-cyan-900">Abrir ficha<ArrowRight className="h-4 w-4" /></Link></div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => { setCreatedMember(null); setCopied(false); setFotoBase64(null); setSelectedSucursales([activeBranchId]); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"><UserPlus className="h-4 w-4" />Crear otro socio</button>
              <button type="button" onClick={() => router.push("/dashboard/clientes")} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Volver a socios</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 font-sans">
      <header className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-3"><Link href="/dashboard/clientes" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700"><ArrowLeft className="h-4 w-4" /></Link><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Socios · {activeBranchName}</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">Nuevo socio</h1><p className="mt-0.5 text-xs font-medium text-slate-600">Alta, acceso al portal y próximo paso de membresía en un único recorrido.</p></div></div>
      </header>

      {error && <button onClick={() => setError(null)} className="flex w-full items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-left text-xs font-semibold text-rose-900"><AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />{error}</button>}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="relative shrink-0">{fotoBase64 ? <img src={fotoBase64} alt="Foto socio" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400"><Camera className="h-6 w-6" /></div>}{fotoBase64 && <button type="button" onClick={() => setFotoBase64(null)} className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 p-1 text-white"><X className="h-3 w-3" /></button>}</div>
          <div className="space-y-1"><p className="text-xs font-bold text-slate-900">Foto del socio</p><p className="text-[11px] text-slate-600">Se usa en la ficha y en el control de ingreso.</p><input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"><Upload className="h-3.5 w-3.5 text-cyan-600" />{fotoBase64 ? "Cambiar foto" : "Subir foto"}</button></div>
        </div>

        <div><p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Datos personales</p><div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2"><Input label="Nombre *" name="nombre" placeholder="Ej: Juan" required /><Input label="Apellido *" name="apellido" placeholder="Ej: Pérez" required /><Input label="DNI *" name="documento" placeholder="Ej: 38450123" required mono /><Input label="Teléfono / WhatsApp" name="telefono" placeholder="Ej: +54 9 11 2345-6789" mono /><Input label="Email" name="email" placeholder="Ej: juan@email.com" type="email" /><Input label="Dirección" name="direccion" placeholder="Ej: Av. San Martín 123" /></div></div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sedes habilitadas para acceso</p><p className="mt-1 text-[11px] text-slate-500">La sede activa siempre queda incluida. {role === "RECEPCION" ? "Recepción sólo puede dar de alta en esta sede." : "Podés sumar otras sedes si el socio también las utilizará."}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-black text-cyan-900"><MapPin className="h-3 w-3" />{activeBranchName}</span></div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">{sucursales.map((branch) => { const locked = branch.id === activeBranchId || role === "RECEPCION"; return <label key={branch.id} className={`flex items-center gap-2 rounded-lg border p-2.5 ${selectedSucursales.includes(branch.id) ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50"} ${locked ? "cursor-default" : "cursor-pointer hover:bg-slate-100"}`}><input type="checkbox" checked={selectedSucursales.includes(branch.id)} disabled={locked} onChange={() => handleCheckboxChange(branch.id)} className="h-4 w-4 rounded text-cyan-600" /><span className="font-semibold text-slate-900">{branch.nombre}</span>{branch.id === activeBranchId && <span className="ml-auto text-[9px] font-black uppercase text-cyan-700">Activa</span>}</label>; })}</div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4"><Link href="/dashboard/clientes" className="px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</Link><button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{loading ? "Guardando socio…" : "Crear socio"}</button></div>
      </form>
    </div>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><code className="mt-1 block text-sm font-black text-slate-950">{value}</code></div>;
}

function Input({ label, name, placeholder, type = "text", required = false, mono = false }: { label: string; name: string; placeholder: string; type?: string; required?: boolean; mono?: boolean }) {
  return <label className="block font-bold text-slate-700">{label}<input type={type} name={name} required={required} placeholder={placeholder} className={`mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 ${mono ? "font-mono" : ""}`} /></label>;
}
