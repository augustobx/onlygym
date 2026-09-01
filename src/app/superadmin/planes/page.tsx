import { getPlanesSaaS } from "@/app/actions/superadmin";
import PlanesManager from "./PlanesManager";

export const dynamic = "force-dynamic";

export default async function SuperAdminPlanesPage() {
  const result = await getPlanesSaaS();
  const planes = result.success && result.data ? result.data as any[] : [];
  return <PlanesManager initialPlanes={planes} />;
}
