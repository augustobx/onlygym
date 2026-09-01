import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";
import { canAccessMember } from "@/lib/staff-member-access";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { MAX_PROGRESS_PHOTO_BYTES, removeProgressPhoto, saveProgressPhoto } from "@/lib/progress-photo-storage";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const allowedTypes = new Set(["frente", "perfil", "espalda"]);

async function resolveActor(requestedClienteId: number | null) {
  try {
    const member = await requireMemberContext();
    if (requestedClienteId == null || requestedClienteId === member.clienteId) {
      await requireTenantModule(member.tenantId, "mediciones");
      return { tenantId: member.tenantId, clienteId: member.clienteId, actorClienteId: member.clienteId, actorUserId: null };
    }
  } catch {
    // Puede ser una sesión del personal; se valida a continuación.
  }

  if (!requestedClienteId) throw new Error("Seleccioná un socio");
  const staff = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.ENTRENADOR] });
  await requireTenantModule(staff.tenantId, "mediciones");
  if (!(await canAccessMember(staff, requestedClienteId))) throw new Error("Socio no autorizado");
  return { tenantId: staff.tenantId, clienteId: requestedClienteId, actorClienteId: null, actorUserId: staff.userId };
}

export async function POST(request: Request) {
  let objectKey: string | null = null;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_PROGRESS_PHOTO_BYTES + 512 * 1024) throw new Error("La imagen no puede superar 8 MB");
    const form = await request.formData();
    const requestedClienteId = form.get("clienteId") ? Number(form.get("clienteId")) : null;
    if (requestedClienteId != null && (!Number.isInteger(requestedClienteId) || requestedClienteId <= 0)) throw new Error("Socio inválido");
    const actor = await resolveActor(requestedClienteId);
    const tipo = String(form.get("tipo") || "").toLowerCase();
    if (!allowedTypes.has(tipo)) throw new Error("Elegí frente, perfil o espalda");
    const rawDate = String(form.get("fecha") || "");
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T12:00:00.000Z`) : new Date();
    if (Number.isNaN(fecha.getTime())) throw new Error("Fecha inválida");
    const file = form.get("foto");
    if (!(file instanceof File)) throw new Error("Seleccioná una imagen");
    const bytes = Buffer.from(await file.arrayBuffer());
    objectKey = await saveProgressPhoto(actor.tenantId, actor.clienteId, bytes, file.type);
    const photo = await prisma.fotoProgreso.create({ data: { tenantId: actor.tenantId, clienteId: actor.clienteId, fecha, tipo, objectKey, mimeType: file.type } });
    await writeAudit({ tenantId: actor.tenantId, actorUserId: actor.actorUserId, actorClienteId: actor.actorClienteId, accion: "foto_progreso.crear", entidad: "FotoProgreso", entidadId: photo.id, metadata: { clienteId: actor.clienteId, tipo, mimeType: file.type, bytes: bytes.length }, requestHeaders: request.headers });
    return Response.json({ success: true, data: { id: photo.id, fecha: photo.fecha, tipo: photo.tipo, mimeType: photo.mimeType } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (objectKey) await removeProgressPhoto(objectKey);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "No se pudo guardar la foto" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
