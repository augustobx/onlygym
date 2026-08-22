"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  text?: string;
  value?: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({ text, value, size = 200, className = "" }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const content = text || value || "";

  useEffect(() => {
    if (!content) return;
    QRCode.toDataURL(content, {
      width: size,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then(url => setDataUrl(url))
      .catch(err => console.error("Error generando QR:", err));
  }, [content, size]);

  if (!dataUrl) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`flex items-center justify-center bg-gray-100 rounded-2xl animate-pulse ${className}`}
      >
        <span className="text-xs text-gray-400 font-medium">Generando QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Código QR de Acceso"
      width={size}
      height={size}
      className={`rounded-2xl shadow-sm ${className}`}
    />
  );
}
