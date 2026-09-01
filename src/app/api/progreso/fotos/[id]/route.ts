import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";
import { canAccessMember } from "@/lib/staff-member-access";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { readProgressPhoto } from "@/lib/progress-photo-storage";

export const runtime = "nodejs";

async function findAccessiblePhoto(id: number) {
  try {
    const member = await requireMemberContext();
    await requireTenantModule(member.tenantId, "mediciones");
    const photo = await prisma.fotoProgreso.findFirst({ where: { id, tenantId: member.tenantId, clienteId: member.clienteId } });
    if (photo) return photo;
  } catch {
    // Puede ser una sesión del personal; se valida a continuación.
  }

  const staff = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
  await requireTenantModule(staff.tenantId, "mediciones");
  const photo = await prisma.fotoProgreso.findFirst({ where: { id, tenantId: staff.tenantId } });
  if (!photo || !(await canAccessMember(staff, photo.clienteId))) throw new Error("Foto no encontrada");
  return photo;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Foto inválida");
    const photo = await findAccessiblePhoto(id);
    const bytes = await readProgressPhoto(photo.objectKey);
    return new Response(bytes, { headers: { "Content-Type": photo.mimeType, "Content-Disposition": `inline; filename=progreso-${photo.id}`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ success: false, error: "Foto no encontrada" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
