"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

export default function MemberAccessQr() {
  const [version, setVersion] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setVersion(Date.now());
          return 45;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = () => {
    setVersion(Date.now());
    setSeconds(45);
  };

  return (
    <div className="rounded-[32px] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Acceso seguro
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-600">
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100 bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={version}
          src={`/api/portal/access-qr?v=${version}`}
          alt="Código QR de acceso al gimnasio"
          className="mx-auto aspect-square w-full max-w-[320px]"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-500">
        <span>El código cambia automáticamente.</span>
        <span className="tabular-nums">{seconds}s</span>
      </div>
    </div>
  );
}
