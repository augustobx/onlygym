"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("OnlyGym Service Worker registrado con éxito:", reg.scope);
        })
        .catch((err) => {
          console.error("Error al registrar Service Worker:", err);
        });
    }
  }, []);

  return null;
}
