"use client";

import { useEffect, useState } from "react";
import { getMisSucursales } from "@/app/actions/auth-actions";
import { useRouter } from "next/navigation";
import { MapPin, LogOut, ChevronRight, Building2 } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export default function SeleccionarSucursalPage() {
  const router = useRouter();
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const res = await getMisSucursales();
      if (res.success && res.data) {
        setSucursales(res.data);
        setUserName(res.userName || "Administrador");
        
        if (res.data.length === 1) {
          seleccionar(res.data[0].id, res.data[0].nombre);
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    }
    load();
  }, []);

  const seleccionar = (id: number, nombre: string) => {
    localStorage.setItem("activeSucursalId", id.toString());
    localStorage.setItem("activeSucursalName", nombre);
    router.push("/dashboard");
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-xs font-medium text-slate-400">Verificando sucursales asignadas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <div className="inline-flex h-10 w-10 rounded-xl bg-indigo-600 items-center justify-center text-white font-bold shadow-xs">
          <Building2 className="h-5 w-5" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          ¡Hola, {userName}!
        </h2>
        <p className="text-xs text-slate-400">
          Selecciona la sede o sucursal donde vas a operar la caja y accesos hoy:
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-6 px-5 sm:px-6 rounded-xl border border-slate-800 shadow-xl space-y-3">
          {sucursales.length === 0 ? (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 text-rose-200 rounded-lg text-xs font-medium text-center">
              No tienes acceso asignado a ninguna sucursal. Contacta al administrador general.
            </div>
          ) : (
            <div className="space-y-2">
              {sucursales.map(s => (
                <button
                  key={s.id}
                  onClick={() => seleccionar(s.id, s.nombre)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-md bg-slate-900 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white transition">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">{s.nombre}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Sede Habilitada</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-400 text-xs font-medium transition">
                    <span>Ingresar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-400 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
