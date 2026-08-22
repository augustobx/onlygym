"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Share, X } from "lucide-react";

interface PWAInstallPromptProps {
  variant?: "button" | "card" | "sidebar";
  appName?: string;
}

export default function PWAInstallPrompt({
  variant = "button",
  appName = "GymLink App",
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      alert("Para instalar en tu dispositivo, haz clic en el ícono de instalación '➕' en la barra de direcciones de tu navegador.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  if (variant === "sidebar") {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition border border-slate-800"
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="truncate">Instalar como App</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white rounded-xl p-5 max-w-xs w-full space-y-3 shadow-2xl border border-slate-800 text-center">
              <Smartphone className="w-8 h-8 text-indigo-400 mx-auto" />
              <h4 className="text-sm font-bold">Instalar en iPhone / iPad</h4>
              <p className="text-xs text-slate-400 text-left leading-relaxed">
                1. Toca <strong>Compartir</strong> <Share className="inline w-3 h-3 text-indigo-400" /> en Safari.<br />
                2. Selecciona <strong>&quot;Agregar a inicio&quot;</strong>.
              </p>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === "card") {
    return (
      <>
        <div className="bg-slate-900 rounded-xl p-4 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-slate-800 rounded-lg flex-shrink-0">
              <Smartphone className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Instalar App en el Teléfono</h4>
              <p className="text-[11px] text-slate-400">
                Accede a tu carnet QR al instante y sin conexión a internet.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
            <span>Instalar</span>
          </button>
        </div>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white rounded-xl p-5 max-w-xs w-full space-y-3 shadow-2xl border border-slate-800 text-center">
              <Smartphone className="w-8 h-8 text-indigo-400 mx-auto" />
              <h4 className="text-sm font-bold">Instalar en iPhone / iPad</h4>
              <p className="text-xs text-slate-400 text-left leading-relaxed">
                1. Toca <strong>Compartir</strong> <Share className="inline w-3 h-3 text-indigo-400" /> en Safari.<br />
                2. Selecciona <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
              </p>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Variant "button"
  return (
    <button
      onClick={handleInstallClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 transition"
    >
      <Download className="w-3 h-3 text-slate-400" />
      <span>Instalar</span>
    </button>
  );
}
