import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashMemberPassword, verifyMemberPassword } from "../src/lib/member-credentials";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("portal de socios aislado por tenant", () => {
  const suffix = randomUUID().slice(0, 8);
  const sharedDocument = `SOC-${suffix}`;
  const passwordA = `A-${suffix}-9!`;
  const passwordB = `B-${suffix}-9!`;
  let pool: Pool;
  let prisma: PrismaClient;
  let tenantAId = 0;
  let tenantBId = 0;
  let memberAId = 0;
  let memberBId = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { nombre: `Member A ${suffix}`, slug: `member-a-${suffix}` } }),
      prisma.tenant.create({ data: { nombre: `Member B ${suffix}`, slug: `member-b-${suffix}` } }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [memberA, memberB] = await Promise.all([
      prisma.cliente.create({ data: { tenantId: tenantAId, documento: sharedDocument, nombre: "Socio", apellido: "A" } }),
      prisma.cliente.create({ data: { tenantId: tenantBId, documento: sharedDocument, nombre: "Socio", apellido: "B" } }),
    ]);
    memberAId = memberA.id;
    memberBId = memberB.id;

    await Promise.all([
      prisma.usuarioCliente.create({
        data: {
          tenantId: tenantAId,
          clienteId: memberAId,
          usuario: sharedDocument,
          password: await hashMemberPassword(passwordA),
        },
      }),
      prisma.usuarioCliente.create({
        data: {
          tenantId: tenantBId,
          clienteId: memberBId,
          usuario: sharedDocument,
          password: await hashMemberPassword(passwordB),
        },
      }),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.sesionSocio.deleteMany({ where: { clienteId: { in: [memberAId, memberBId] } } });
    await prisma.usuarioCliente.deleteMany({ where: { clienteId: { in: [memberAId, memberBId] } } });
    await prisma.cliente.deleteMany({ where: { id: { in: [memberAId, memberBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
    await pool.end();
  });

  async function findCredential(tenantId: number) {
    return prisma.usuarioCliente.findFirst({
      where: {
        tenantId,
        cliente: { tenantId },
        OR: [{ usuario: sharedDocument }, { cliente: { documento: sharedDocument, tenantId } }],
      },
      include: { cliente: true },
    });
  }

  it("el mismo DNI puede existir en dos gimnasios sin mezclar credenciales", async () => {
    const [recordA, recordB] = await Promise.all([findCredential(tenantAId), findCredential(tenantBId)]);
    expect(recordA?.clienteId).toBe(memberAId);
    expect(recordB?.clienteId).toBe(memberBId);
  });

  it("la contraseña del tenant A sólo valida la credencial del tenant A", async () => {
    const [recordA, recordB] = await Promise.all([findCredential(tenantAId), findCredential(tenantBId)]);
    expect(recordA).not.toBeNull();
    expect(recordB).not.toBeNull();
    await expect(verifyMemberPassword(recordA!.password, passwordA)).resolves.toBe(true);
    await expect(verifyMemberPassword(recordB!.password, passwordA)).resolves.toBe(false);
  });

  it("la contraseña del tenant B sólo valida la credencial del tenant B", async () => {
    const [recordA, recordB] = await Promise.all([findCredential(tenantAId), findCredential(tenantBId)]);
    expect(recordA).not.toBeNull();
    expect(recordB).not.toBeNull();
    await expect(verifyMemberPassword(recordB!.password, passwordB)).resolves.toBe(true);
    await expect(verifyMemberPassword(recordA!.password, passwordB)).resolves.toBe(false);
  });
});
