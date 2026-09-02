import { notFound, redirect } from "next/navigation";
import { isPlatformRequestHost } from "@/lib/request-tenant";
import { getRequestTenantLifecycle } from "@/lib/tenant-lifecycle";

export default async function HomePage() {
  if (await isPlatformRequestHost()) {
    redirect("/superadmin/login");
  }

  const lifecycle = await getRequestTenantLifecycle();
  if (lifecycle.status === "suspended") redirect("/suspendido");
  if (lifecycle.status === "operational") redirect("/portal/login");

  notFound();
}
