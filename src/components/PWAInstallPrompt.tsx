"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

interface PWAInstallPromptProps {
  variant?: "button" | "card" | "sidebar";
  appName?: string;
}

export default function PWAInstallPrompt({ variant = "button", appName = "OnlyGym" }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const installed = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
    setIsInstalled(installed);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (isIOS || !deferredPrompt) {
      setShowHelp(true);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }

  if (isInstalled) return null;

  const helpModal = showHelp ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Instalar ${appName}`}>
      <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-950 text-cyan-300"><Smartphone className="h-5 w-5" /></span><div><h4 className="text-sm font-black">Instalar {appName}</h4><p className="mt-0.5 text-[11px] text-slate-400">Queda como una app en tu pantalla de inicio.</p></div></div>
          <button onClick={() => setShowHelp(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>
        {isIOS ? (
          <p className="mt-4 text-xs leading-relaxed text-slate-300">En Safari tocá <strong>Compartir</strong> <Share className="inline h-3.5 w-3.5 text-cyan-300" /> y después <strong>Agregar a pantalla de inicio</strong>.</p>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-slate-300">Abrí el menú del navegador y elegí <strong>Instalar app</strong> o <strong>Agregar a pantalla de inicio</strong>. El nombre puede variar según el navegador.</p>
        )}
        <button onClick={() => setShowHelp(false)} className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-black text-white">Entendido</button>
      </div>
    </div>
  ) : null;

  if (variant === "sidebar") {
    return <><button onClick={() => void install()} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"><Smartphone className="h-3.5 w-3.5 shrink-0 text-cyan-400" /><span className="truncate">Instalar como app</span></button>{helpModal}</>;
  }

  if (variant === "card") {
    return <><div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-white shadow-xl sm:flex-row"><div className="flex items-center gap-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800"><Smartphone className="h-5 w-5 text-cyan-400" /></span><div><h4 className="text-xs font-bold">Instalar {appName}</h4><p className="text-[11px] font-medium text-slate-400">Acceso rápido desde la pantalla de inicio, con experiencia de app.</p></div></div><button onClick={() => void install()} className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-slate-100 sm:w-auto"><Download className="h-3.5 w-3.5 text-cyan-600" />Instalar</button></div>{helpModal}</>;
  }

  return <><button onClick={() => void install()} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"><Download className="h-3 w-3 text-cyan-400" />Instalar</button>{helpModal}</>;
}
