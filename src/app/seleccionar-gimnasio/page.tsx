"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SeleccionarGimnasioPage() {
  const router = useRouter();

  useEffect(() => {
    // Cada subdominio de OnlyGym representa un único tenant. La única selección operativa necesaria es la sede.
    router.replace("/seleccionar-sucursal");
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-bold text-slate-400">
      Preparando tu sede de trabajo…
    </div>
  );
}
