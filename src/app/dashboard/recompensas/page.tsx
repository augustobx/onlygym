"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Gift,
  Plus,
  Sparkles,
  Trophy,
  X,
  Layers,
  CheckCircle2,
  Clock,
  Tag,
  Store,
  Check,
  Ban,
  Calendar,
  Image as ImageIcon,
  Flame,
} from "lucide-react";
import {
  crearPremio,
  getRecompensasAdmin,
} from "@/app/actions/gestion-fitness";
import {
  getReglasPuntosAdmin,
  guardarReglaPuntos,
  getDesafiosAdmin,
  crearDesafio,
  getBeneficiosAdmin,
  crearBeneficio,
  archivarBeneficio,
  getCanjesAdmin,
  gestionarCanjeAdmin,
} from "@/app/actions/fidelizacion";

export default function RewardsPage() {
  const [tab, setTab] = useState<"premios" | "canjes" | "reglas" | "beneficios">("premios");

  const [data, setData] = useState<any>({ rewards: [], benefits: [], movements: { _sum: {}, _count: 0 } });
  const [canjes, setCanjes] = useState<any[]>([]);
  const [reglas, setReglas] = useState<any[]>([]);
  const [desafios, setDesafios] = useState<any[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);

  // Modals
  const [modalPremio, setModalPremio] = useState(false);
  const [modalDesafio, setModalDesafio] = useState(false);
  const [modalBeneficio, setModalBeneficio] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [resRec, resCanjes, resReglas, resDesafios, resBeneficios] = await Promise.all([
      getRecompensasAdmin(),
      getCanjesAdmin(),
      getReglasPuntosAdmin(),
      getDesafiosAdmin(),
      getBeneficiosAdmin(),
    ]);

    if (resRec.success) setData(resRec.data);
    if (resCanjes.success) setCanjes(resCanjes.data as any[]);
    if (resReglas.success) setReglas(resReglas.data as any[]);
    if (resDesafios.success) setDesafios(resDesafios.data as any[]);
    if (resBeneficios.success) setBeneficios(resBeneficios.data as any[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleCrearPremio = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await crearPremio({
      nombre: String(form.get("nombre") || ""),
      descripcion: String(form.get("descripcion") || ""),
      puntos: Number(form.get("puntos")),
      stock: form.get("stock") ? Number(form.get("stock")) : null,
    });
    setMessage(result.success ? "Premio creado con éxito" : result.error || "Error al crear premio");
    if (result.success) {
      setModalPremio(false);
      await loadAll();
    }
  };

  const handleCrearDesafio = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await crearDesafio({
      titulo: String(form.get("titulo") || ""),
      descripcion: String(form.get("descripcion") || ""),
      tipo: form.get("tipo") as any,
      meta: Number(form.get("meta")),
      puntosRecompensa: Number(form.get("puntosRecompensa")),
    });
    setMessage(result.success ? "Desafío publicado" : result.error || "Error al crear desafío");
    if (result.success) {
      setModalDesafio(false);
      await loadAll();
    }
  };

  const handleCrearBeneficio = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await crearBeneficio({
      titulo: String(form.get("titulo") || ""),
      descripcion: String(form.get("descripcion") || ""),
      comercio: String(form.get("comercio") || ""),
      imagenUrl: String(form.get("imagenUrl") || ""),
      condiciones: String(form.get("condiciones") || ""),
      vigenteHasta: form.get("vigenteHasta") ? new Date(String(form.get("vigenteHasta"))) : undefined,
    });
    setMessage(result.success ? "Beneficio publicado" : result.error || "Error al crear beneficio");
    if (result.success) {
      setModalBeneficio(false);
      await loadAll();
    }
  };

  const handleToggleBeneficio = async (id: number, currentActive: boolean) => {
    const result = await archivarBeneficio(id, !currentActive);
    if (result.success) await loadAll();
  };

  const handleGestionarCanje = async (canjeId: number, accion: "entregar" | "rechazar") => {
    const result = await gestionarCanjeAdmin(canjeId, accion);
    setMessage(result.success ? (accion === "entregar" ? "Entrega confirmada" : "Canje rechazado y puntos devueltos") : result.error || "Error");
    if (result.success) await loadAll();
  };

  const handleUpdateRegla = async (evento: string, puntos: number, activo: boolean) => {
    await guardarReglaPuntos({ evento, puntos, activo });
    await loadAll();
  };

  const pendientesCanje = canjes.filter((c) => c.estado === "pendiente");

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Fase 9 · Fidelización & Recompensas</p>
          <h1 className="text-2xl font-black text-slate-900">Puntos, Premios y Beneficios</h1>
          <p className="text-sm text-slate-500">
            Recompensá asistencia, rachas de entrenamiento y convenios comerciales exclusivos.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setTab("premios")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "premios" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Premios ({data.rewards?.length || 0})
          </button>
          <button
            onClick={() => setTab("canjes")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition relative ${
              tab === "canjes" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Canjes Pendientes
            {pendientesCanje.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                {pendientesCanje.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("reglas")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "reglas" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Reglas & Desafíos
          </button>
          <button
            onClick={() => setTab("beneficios")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              tab === "beneficios" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Beneficios / Convenios
          </button>
        </div>
      </div>

      {message && (
        <button
          onClick={() => setMessage(null)}
          className="w-full rounded-xl bg-cyan-50 p-3 text-left text-sm font-bold text-cyan-800 flex items-center justify-between"
        >
          <span>{message}</span>
          <span className="text-xs underline font-normal">Descartar</span>
        </button>
      )}

      {/* KPI Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Trophy} value={String(data.movements?._sum?.puntos || 0)} label="Puntos Netos Otorgados" />
        <Stat icon={Sparkles} value={String(data.movements?._count || 0)} label="Movimientos de Puntos" />
        <Stat icon={Gift} value={String(canjes.length)} label="Canjes Totales" />
      </div>

      {/* TAB 1: Premios Disponibles */}
      {tab === "premios" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setModalPremio(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nuevo Premio
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.rewards?.map((reward: any) => (
              <article key={reward.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 grid place-items-center">
                      <Gift className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                      {reward.puntos} pts
                    </span>
                  </div>
                  <h3 className="mt-4 font-black text-slate-900 text-base">{reward.nombre}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed min-h-[36px]">
                    {reward.descripcion || "Premio canjeable en recepción."}
                  </p>
                </div>

                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 font-medium">
                  <span className={reward.stock === 0 ? "text-red-600 font-bold" : ""}>
                    {reward.stock == null ? "Stock ilimitado" : `${reward.stock} disponibles`}
                  </span>
                  <span>{reward._count?.canjes || 0} canjeados</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Canjes Pendientes & Historial */}
      {tab === "canjes" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">Solicitudes de Canje de Socios</h3>
            <span className="text-xs text-slate-400 font-medium">{canjes.length} canjes en total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Premio Solicitado</th>
                  <th className="px-4 py-3">Puntos</th>
                  <th className="px-4 py-3">Fecha Solicitud</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {canjes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No hay solicitudes de canje registradas.
                    </td>
                  </tr>
                ) : (
                  canjes.map((canje) => (
                    <tr key={canje.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {canje.cliente.nombre} {canje.cliente.apellido}
                        <span className="text-[10px] text-slate-400 font-normal block">
                          DNI {canje.cliente.documento} · {canje.cliente.telefono || ""}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-800">{canje.premio.nombre}</td>

                      <td className="px-4 py-3 font-mono font-bold text-amber-700">{canje.puntos} pts</td>

                      <td className="px-4 py-3 text-slate-500">
                        {new Date(canje.creadoEn).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            canje.estado === "entregado"
                              ? "bg-emerald-100 text-emerald-800"
                              : canje.estado === "rechazado"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800 animate-pulse"
                          }`}
                        >
                          {canje.estado}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {canje.estado === "pendiente" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleGestionarCanje(canje.id, "entregar")}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Entregar
                            </button>
                            <button
                              onClick={() => handleGestionarCanje(canje.id, "rechazar")}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition"
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Finalizado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Reglas de Puntos & Desafíos */}
      {tab === "reglas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reglas automáticas */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-700" /> Reglas Configurables de Puntos
            </h3>
            <p className="text-xs text-slate-500">
              Define cuántos puntos gana un socio automáticamente ante cada evento.
            </p>

            <div className="space-y-2.5">
              {reglas.map((regla) => (
                <div key={regla.evento} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900">{regla.descripcion || regla.evento}</p>
                    <span className="text-[10px] font-mono text-slate-400">{regla.evento}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      defaultValue={regla.puntos}
                      onBlur={(e) => handleUpdateRegla(regla.evento, Number(e.target.value), regla.activo)}
                      className="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold font-mono bg-white"
                    />
                    <span className="text-[10px] font-bold text-slate-500">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desafíos Activos */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-600" /> Desafíos y Retos para Socios
              </h3>
              <button
                onClick={() => setModalDesafio(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Reto
              </button>
            </div>

            <div className="space-y-3">
              {desafios.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No hay desafíos activos programados.</p>
              ) : (
                desafios.map((desafio) => (
                  <div key={desafio.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{desafio.titulo}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                        +{desafio.puntosRecompensa} pts
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{desafio.descripcion}</p>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 font-medium">
                      <span>Meta: {desafio.meta} {desafio.tipo.replace("_", " ")}</span>
                      <span>{desafio._count?.participaciones || 0} participantes</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Beneficios y Convenios */}
      {tab === "beneficios" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setModalBeneficio(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nuevo Beneficio
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {beneficios.map((b) => (
              <article key={b.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 grid place-items-center">
                      <Store className="w-5 h-5" />
                    </div>
                    <button
                      onClick={() => handleToggleBeneficio(b.id, b.activo)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        b.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {b.activo ? "Activo" : "Archivado"}
                    </button>
                  </div>

                  <h3 className="font-black text-slate-900 text-base">{b.titulo}</h3>
                  <p className="text-xs font-bold text-cyan-700 mt-0.5">{b.comercio || "Convenio OnlyGym"}</p>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{b.descripcion}</p>

                  {b.condiciones && (
                    <p className="mt-2 text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg font-mono">
                      {b.condiciones}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                  <span>
                    {b.vigenteHasta ? `Válido hasta ${new Date(b.vigenteHasta).toLocaleDateString("es-AR")}` : "Sin vencimiento"}
                  </span>
                  <button onClick={() => handleToggleBeneficio(b.id, b.activo)} className="font-bold underline text-slate-600">
                    {b.activo ? "Archivar" : "Reactivar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nuevo Premio */}
      {modalPremio && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={handleCrearPremio} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-base font-black">Nuevo Premio Fidelización</h2>
              <button type="button" onClick={() => setModalPremio(false)}>
                <X />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Premio</label>
              <input name="nombre" required placeholder="Ej. Shaker Pro 700ml" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Puntos Requeridos</label>
                <input name="puntos" type="number" required min={1} defaultValue={100} className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Stock (Vacío = Ilimitado)</label>
                <input name="stock" type="number" min={0} placeholder="Ilimitado" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
              <textarea name="descripcion" rows={2} placeholder="Descripción del producto y entrega..." className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
            </div>
            <button className="h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 transition">
              Publicar Premio
            </button>
          </form>
        </div>
      )}

      {/* Modal Nuevo Desafío */}
      {modalDesafio && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={handleCrearDesafio} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-base font-black">Nuevo Desafío</h2>
              <button type="button" onClick={() => setModalDesafio(false)}>
                <X />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Título del Reto</label>
              <input name="titulo" required placeholder="Ej. 4 Asistencias esta Semana" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Meta</label>
              <select name="tipo" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm">
                <option value="asistencias_semana">Asistencias en la semana</option>
                <option value="entrenamientos_mes">Entrenamientos finalizados en el mes</option>
                <option value="visitas_mes">Visitas totales en el mes</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Cantidad Meta</label>
                <input name="meta" type="number" min={1} defaultValue={4} required className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Puntos Recompensa</label>
                <input name="puntosRecompensa" type="number" min={1} defaultValue={50} required className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Descripción motivacional</label>
              <textarea name="descripcion" rows={2} required placeholder="Completa 4 visitas de lunes a domingo y gana puntos extra." className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
            </div>
            <button className="h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 transition">
              Lanzar Desafío
            </button>
          </form>
        </div>
      )}

      {/* Modal Nuevo Beneficio */}
      {modalBeneficio && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={handleCrearBeneficio} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-base font-black">Nuevo Beneficio o Convenio</h2>
              <button type="button" onClick={() => setModalBeneficio(false)}>
                <X />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Título del Descuento / Beneficio</label>
              <input name="titulo" required placeholder="Ej. 20% OFF en Suplementos NutriFit" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Comercio Asociado</label>
              <input name="comercio" placeholder="NutriFit Suplementos" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
              <textarea name="descripcion" rows={2} required placeholder="Presentando tu carnet digital del socio accedes a 20% de descuento en proteínas..." className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Código Promocional / Condiciones</label>
              <input name="condiciones" placeholder="Código: ONLYGYM20 (Válido de lunes a viernes)" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Límite Vigencia (Opcional)</label>
              <input name="vigenteHasta" type="date" className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm" />
            </div>
            <button className="h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 transition">
              Publicar Beneficio
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Icon className="h-5 w-5 text-cyan-600" />
      <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 font-bold">{label}</p>
    </div>
  );
}
