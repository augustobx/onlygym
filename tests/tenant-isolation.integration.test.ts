import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, RolTenant } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { tenantOwnedId, trainerMemberScope } from "../src/lib/access-policy";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("aislamiento IDOR con PostgreSQL", () => {
  const suffix = randomUUID().slice(0, 8);
  let pool: Pool;
  let prisma: PrismaClient;
  let tenantAId = 0;
  let tenantBId = 0;
  let memberAId = 0;
  let memberBId = 0;
  let trainerAId = 0;
  let trainerBId = 0;
  let userAId = "";
  let userBId = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { nombre: `Security A ${suffix}`, slug: `security-a-${suffix}` } }),
      prisma.tenant.create({ data: { nombre: `Security B ${suffix}`, slug: `security-b-${suffix}` } }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { name: "Trainer A", email: `trainer-a-${suffix}@test.local`, username: `trainer-a-${suffix}` } }),
      prisma.user.create({ data: { name: "Trainer B", email: `trainer-b-${suffix}@test.local`, username: `trainer-b-${suffix}` } }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const [profileA, profileB] = await Promise.all([
      prisma.perfilEntrenador.create({ data: { tenantId: tenantAId, userId: userA.id, especialidades: [] } }),
      prisma.perfilEntrenador.create({ data: { tenantId: tenantBId, userId: userB.id, especialidades: [] } }),
    ]);
    trainerAId = profileA.id;
    trainerBId = profileB.id;
    const [memberA, memberB] = await Promise.all([
      prisma.cliente.create({ data: { tenantId: tenantAId, documento: `A-${suffix}`, nombre: "Socio", apellido: "A", entrenadorId: trainerAId } }),
      prisma.cliente.create({ data: { tenantId: tenantBId, documento: `B-${suffix}`, nombre: "Socio", apellido: "B", entrenadorId: trainerBId } }),
    ]);
    memberAId = memberA.id;
    memberBId = memberB.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.cliente.deleteMany({ where: { id: { in: [memberAId, memberBId] } } });
    await prisma.perfilEntrenador.deleteMany({ where: { id: { in: [trainerAId, trainerBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("un ID válido de Tenant B no puede consultarse con el contexto de Tenant A", async () => {
    const leaked = await prisma.cliente.findFirst({ where: tenantOwnedId(tenantAId, memberBId) });
    expect(leaked).toBeNull();
  });

  it("un entrenador no puede consultar al socio de otro entrenador", async () => {
    const leaked = await prisma.cliente.findFirst({ where: { tenantId: tenantAId, id: memberAId, ...trainerMemberScope(RolTenant.ENTRENADOR, trainerBId) } });
    expect(leaked).toBeNull();
  });

  it("el mismo filtro permite el recurso legítimo", async () => {
    const owned = await prisma.cliente.findFirst({ where: { tenantId: tenantAId, id: memberAId, ...trainerMemberScope(RolTenant.ENTRENADOR, trainerAId) } });
    expect(owned?.id).toBe(memberAId);
  });
});
