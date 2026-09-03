import type { Metadata, Viewport } from "next";
import PortalQuickAccess from "@/components/PortalQuickAccess";

export const metadata: Metadata = {
  title: "OnlyGym Socio",
  description: "Tu membresía, entrenamientos, reservas, progreso, cuenta y carnet digital en un solo lugar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OnlyGym Socio",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PortalQuickAccess />
    </>
  );
}
