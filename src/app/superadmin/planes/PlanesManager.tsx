"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Layers, Users, Store, UserRound, Save, Loader2, Plus } from "lucide-react";
import { crearPlanSaaS, actualizarPlanSaaS } from "@/app/actions/superadmin";

const MODULE_KEYS = [
  "socios", "membresias", "accesos", "caja", "entrenamiento", "clases", "mediciones", "puntos", "reportes",
];
const inputClass = "mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none";

export default function PlanesManager({ initialPlanes }: { initialPlanes: any[] }) {
  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Layers className="w-6 h-6 text-emerald-400" />Planes SaaS</h1>
      <p className="text-sm text-slate-400 mt-1">Configuración comercial, límites y módulos incluidos en cada plan.</p>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">{initialPlanes.map(plan => <PlanEditor key={plan.id} plan={plan} />)}</div>
    <CreatePlan />
  </div>;
}

function PlanEditor({ plan }: { plan: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name,setName]=useState(plan.nombre);
  const [description,setDescription]=useState(plan.descripcion || "");
  const [price,setPrice]=useState(Number(plan.precioMensual));
  const [users,setUsers]=useState(Number(plan.limiteUsuarios || 0));
  const [branches,setBranches]=useState(Number(plan.limiteSucursales || 0));
  const [members,setMembers]=useState(plan.limiteSocios == null ? 0 : Number(plan.limiteSocios));
  const [active,setActive]=useState(Boolean(plan.activo));
  const [modules,setModules]=useState<Record<string,boolean>>(() => ({...Object.fromEntries(MODULE_KEYS.map(k=>[k,true])), ...(plan.modulos || {})}));

  const toggle=(key:string)=>setModules(v=>({...v,[key]:!v[key]}));
  async function save(){
    setLoading(true); setError("");
    try {
      const res=await actualizarPlanSaaS(plan.id,{nombre:name.trim(),descripcion:description || undefined,precioMensual:Number(price),limiteUsuarios:Number(users),limiteSucursales:Number(branches),limiteSocios:members > 0 ? Number(members) : null,modulos:modules,activo:active});
      if(!res.success) setError(res.error || "No se pudo actualizar"); else router.refresh();
    } finally { setLoading(false); }
  }

  return <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
    <div className="flex justify-between items-start"><div><span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">{plan.codigo}</span><p className="text-xs text-slate-500 mt-3">{plan._count?.tenants || 0} gimnasio(s)</p></div><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />Activo</label></div>
    <Field label="Nombre"><input value={name} onChange={e=>setName(e.target.value)} className={inputClass} /></Field>
    <Field label="Descripción"><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} /></Field>
    <Field label="Precio mensual"><input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} className={inputClass} /></Field>
    <div className="grid grid-cols-3 gap-2"><Limit icon={<Users className="w-3 h-3" />} label="Usuarios" value={users} setValue={setUsers}/><Limit icon={<Store className="w-3 h-3" />} label="Sedes" value={branches} setValue={setBranches}/><Limit icon={<UserRound className="w-3 h-3" />} label="Socios" value={members} setValue={setMembers}/></div>
    <div className="border-t border-slate-800 pt-4"><p className="text-xs font-semibold text-slate-400 uppercase mb-3">Módulos incluidos</p><div className="grid grid-cols-2 gap-2">{MODULE_KEYS.map(key=><label key={key} className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2"><input type="checkbox" checked={Boolean(modules[key])} onChange={()=>toggle(key)} />{key.toUpperCase()}</label>)}</div></div>
    {error && <p className="text-xs text-red-400">{error}</p>}
    <button onClick={save} disabled={loading} className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Guardar Plan</button>
  </div>;
}

function CreatePlan(){
  const router=useRouter(); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function submit(formData:FormData){
    setLoading(true); setError("");
    try{const res=await crearPlanSaaS({codigo:String(formData.get("codigo")||"").toUpperCase(),nombre:String(formData.get("nombre")||""),descripcion:String(formData.get("descripcion")||"")||undefined,precioMensual:Number(formData.get("precioMensual")||0),limiteUsuarios:Number(formData.get("limiteUsuarios")||1),limiteSucursales:Number(formData.get("limiteSucursales")||1),limiteSocios:Number(formData.get("limiteSocios")||0)||null,modulos:Object.fromEntries(MODULE_KEYS.map(k=>[k,true])),activo:true}); if(!res.success)setError(res.error||"No se pudo crear"); else router.refresh();}finally{setLoading(false)}
  }
  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6"><h2 className="font-bold text-white flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-emerald-400"/>Crear nuevo plan</h2><form action={submit} className="grid md:grid-cols-4 gap-3"><input name="codigo" required placeholder="Código" className={inputClass}/><input name="nombre" required placeholder="Nombre" className={inputClass}/><input name="precioMensual" required type="number" min="0" placeholder="Precio" className={inputClass}/><input name="descripcion" placeholder="Descripción" className={inputClass}/><input name="limiteUsuarios" type="number" min="1" defaultValue="5" placeholder="Usuarios" className={inputClass}/><input name="limiteSucursales" type="number" min="1" defaultValue="1" placeholder="Sedes" className={inputClass}/><input name="limiteSocios" type="number" min="0" placeholder="Socios (0 ilimitado)" className={inputClass}/><button disabled={loading} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 py-3 font-bold">{loading?"Creando...":"Crear plan"}</button></form>{error&&<p className="text-xs text-red-400 mt-3">{error}</p>}</section>
}

function Field({label,children}:{label:string;children:ReactNode}){return <div><label className="text-xs text-slate-400">{label}</label>{children}</div>}
function Limit({icon,label,value,setValue}:{icon:ReactNode;label:string;value:number;setValue:(n:number)=>void}){return <div><label className="text-[11px] text-slate-500 flex gap-1">{icon}{label}</label><input type="number" value={value} onChange={e=>setValue(Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white" /></div>}
