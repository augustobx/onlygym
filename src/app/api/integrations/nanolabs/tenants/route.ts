import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADER = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function authorized(req: Request): boolean {
  const expected = Buffer.from(process.env.HUB_INTEGRATION_TOKEN || "");
  const header = req.headers.get("authorization") || "";
  const supplied = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  return expected.length >= 32 && supplied.length === expected.length &&
    timingSafeEqual(expected, supplied);
}
function normalizeStatus(raw: unknown) {
  const value = String(raw || "").toUpperCase();
  if (["ACTIVE", "ACTIVO"].includes(value)) return "ACTIVE";
  if (["TRIAL", "PRUEBA", "TRIALING"].includes(value)) return "TRIAL";
  if (["SUSPENDED", "SUSPENDIDO"].includes(value)) return "SUSPENDED";
  if (["CANCELED", "CANCELLED", "CANCELADO", "INACTIVE", "INACTIVO"].includes(value)) return "CANCELED";
  return "UNKNOWN";
}
// Controlled GET only: no Prisma update/upsert/delete, migrations, credentials or PII exports.
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ success: false, error: "Unauthorized" }, { status: 401, headers: HEADER });
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) {
    return Response.json({ success: false, error: "Invalid offset" }, { status: 400, headers: HEADER });
  }
  try {
    const records = await prisma.tenant.findMany({
      skip: offset, take: 101,
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
      select: { id:true,slug:true,nombre:true,estado:true,creadoEn:true,plan:true },
    });
    const page = records.slice(0, 100).map(t => ({
      id: String(t.id),
      slug: t.slug,
      name: t.nombre,
      status: normalizeStatus(t.estado),
      rawStatus: String(t.estado),
      createdAt: t.creadoEn.toISOString(),
      plan: t.plan,
    }));
    return Response.json({
      success: true,
      contract: "nanolabs.saas.tenants.v1",
      product: "onlygym",
      capturedAt: new Date().toISOString(),
      tenants: page,
      nextOffset: records.length > 100 ? offset + 100 : null,
      capabilities: { tenantsRead: true, tenantWrite: false, moduleWrite: false }
    }, { headers: HEADER });
  } catch {
    // Never serialize Prisma errors: they may include SQL and infrastructure detail.
    return Response.json({ success: false, error: "Tenant read unavailable" }, { status: 503, headers: HEADER });
  }
}
