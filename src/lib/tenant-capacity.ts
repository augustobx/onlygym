import type { Prisma } from "@prisma/client";

export async function lockTenantCapacity(tx: Prisma.TransactionClient, tenantId: number) {
  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;
}
export async function assertTenantCapacity(tx: Prisma.TransactionClient, tenantId: number, resource: "users" | "branches" | "members") {
  await lockTenantCapacity(tx, tenantId);
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { planSaaS: { select: { limiteUsuarios: true, limiteSucursales: true, limiteSocios: true } } } });
  if (!tenant?.planSaaS) return;
  const plan = tenant.planSaaS;
  const limit = resource === "users" ? plan.limiteUsuarios : resource === "branches" ? plan.limiteSucursales : plan.limiteSocios;
  if (limit === null) return;
  const count = resource === "users" ? await tx.tenantUsuario.count({ where: { tenantId, estado: "activo" } }) : resource === "branches" ? await tx.sucursal.count({ where: { tenantId, estado: "activo" } }) : await tx.cliente.count({ where: { tenantId, estado: "activo" } });
  if (count >= limit) throw new Error(`Límite del plan alcanzado para ${resource === "users" ? "usuarios" : resource === "branches" ? "sucursales" : "socios"} (${count}/${limit})`);
}

