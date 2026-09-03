"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, RefreshCw } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

type PushState = {
  available: boolean;
  publicKey: string | null;
  serverSubscribed: boolean;
  localSubscribed: boolean;
};

export default function PortalPushControl() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/push/subscribe", { cache: "no-store" });
        const data = await response.json();
        const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        let localSubscribed = false;
        if (supported) {
          const registration = await navigator.serviceWorker.ready;
          localSubscribed = Boolean(await registration.pushManager.getSubscription());
        }
        setState({
          available: Boolean(data.available) && supported,
          publicKey: typeof data.publicKey === "string" ? data.publicKey : null,
          serverSubscribed: Boolean(data.subscribed),
          localSubscribed,
        });
      } catch {
        setState({ available: false, publicKey: null, serverSubscribed: false, localSubscribed: false });
      }
    })();
  }, []);

  async function enable() {
    if (!state?.available || !state.publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("El navegador no autorizó las notificaciones.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        });
      }
      const response = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("No se pudo registrar este dispositivo");
      setState((current) => current ? { ...current, localSubscribed: true, serverSubscribed: true } : current);
      setMessage("Notificaciones activadas en este dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!state) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/v1/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState((current) => current ? { ...current, localSubscribed: false } : current);
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch {
      setMessage("No se pudieron desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <div className="flex h-24 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.035]"><RefreshCw className="h-4 w-4 animate-spin text-slate-500" /></div>;
  }

  return (
    <section className="rounded-3xl border border-white/8 bg-[#11151c] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-black"><Bell className="h-4 w-4 text-lime-300" /> Notificaciones</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Recibí avisos de clases, vencimientos y novedades del gimnasio en este dispositivo.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${state.localSubscribed ? "bg-lime-300/10 text-lime-300" : "bg-white/5 text-slate-500"}`}>
          {state.localSubscribed ? "Activas" : "Inactivas"}
        </span>
      </div>

      {!state.available ? (
        <p className="mt-4 rounded-2xl bg-amber-300/10 p-3 text-xs font-semibold text-amber-100">
          Las notificaciones push todavía no están configuradas para este entorno o el navegador no las soporta.
        </p>
      ) : (
        <button
          onClick={() => void (state.localSubscribed ? disable() : enable())}
          disabled={busy}
          className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-xs font-black disabled:opacity-50 ${state.localSubscribed ? "border border-rose-300/20 text-rose-300" : "bg-lime-300 text-slate-950"}`}
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : state.localSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {state.localSubscribed ? "Desactivar en este dispositivo" : "Activar notificaciones"}
        </button>
      )}

      {state.serverSubscribed && !state.localSubscribed && (
        <p className="mt-2 text-[10px] text-slate-600">Tu cuenta ya tiene notificaciones activas en otro dispositivo.</p>
      )}
      {message && <p className="mt-3 text-xs font-semibold text-slate-400">{message}</p>}
    </section>
  );
}
