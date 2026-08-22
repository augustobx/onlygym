import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#4338ca",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "GymLink Pro - Sistema Integral de Gestión & App de Socios",
  description: "Plataforma profesional para gimnasios, control de acceso, POS cantina y portal digital de socios",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymLink Pro",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-900 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
