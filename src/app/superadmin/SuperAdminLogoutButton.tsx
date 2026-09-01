"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { logoutSuperAdmin } from "@/app/actions/superadmin";

export default function SuperAdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await logoutSuperAdmin();
    router.replace("/superadmin/login");
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50 cursor-pointer"
      title="Cerrar sesión SuperAdmin"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
    </button>
  );
}
