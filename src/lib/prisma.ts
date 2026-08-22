import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Crear conexión usando el módulo pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Instanciar el adaptador
const adapter = new PrismaPg(pool);

// Asegurarse de que en desarrollo no se creen múltiples instancias de Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
