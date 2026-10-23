import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { assertTenantCapacity } from "../src/lib/tenant-capacity";
function transaction(count = 1, plan: { limiteUsuarios: number; limiteSucursales: number; limiteSocios: number | null } | null = { limiteUsuarios: 2, limiteSucursales: 2, limiteSocios: 2 }) {
  return { $queryRaw: vi.fn().mockResolvedValue([]), tenant: { findUnique: vi.fn().mockResolvedValue({ planSaaS: plan }) }, tenantUsuario: { count: vi.fn().mockResolvedValue(count) }, sucursal: { count: vi.fn().mockResolvedValue(count) }, cliente: { count: vi.fn().mockResolvedValue(count) } };
}
describe("plan capacity", () => {
  it("checks the appropriate tenant-scoped active count and locks the tenant", async () => {
    for (const resource of ["users", "branches", "members"] as const) {
      const tx = transaction(); await expect(assertTenantCapacity(tx as unknown as Prisma.TransactionClient, 7, resource)).resolves.toBeUndefined();
      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      const counter = resource === "users" ? tx.tenantUsuario : resource === "branches" ? tx.sucursal : tx.cliente;
      expect(counter.count).toHaveBeenCalledWith({ where: { tenantId: 7, estado: "activo" } });
    }
  });
  it("rejects additions at the limit and preserves legacy/unlimited plans", async () => {
    const full = transaction(2); await expect(assertTenantCapacity(full as unknown as Prisma.TransactionClient, 7, "members")).rejects.toThrow("Límite del plan");
    for (const plan of [null, { limiteUsuarios: 1, limiteSucursales: 1, limiteSocios: null }]) {
      const tx = transaction(100, plan); await expect(assertTenantCapacity(tx as unknown as Prisma.TransactionClient, 7, "members")).resolves.toBeUndefined();
      expect(tx.cliente.count).not.toHaveBeenCalled();
    }
  });
});

