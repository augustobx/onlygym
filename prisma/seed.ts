import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando inyección de datos semilla...");

  // 1. Crear Sucursal 1 y 2
  const sucursal1 = await prisma.sucursal.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "Sede Principal (Gym 1)",
      direccion: "Centro",
    },
  });
  const sucursal2 = await prisma.sucursal.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nombre: "Sede Norte (Gym 2)",
      direccion: "Zona Norte",
    },
  });
  console.log("✅ Sucursales 1 y 2 listas");

  // 2. Crear Admin
  // As Better Auth expects hashed passwords, we should hash it. Since we just want a seed, we will create the user via Better Auth or just insert it raw.
  const admin = await prisma.user.upsert({
    where: { email: "admin@gymlink.local" },
    update: {
      sucursales: {
        connect: [{ id: sucursal1.id }, { id: sucursal2.id }]
      }
    },
    create: {
      name: "Administrador Principal",
      email: "admin@gymlink.local",
      username: "admin",
      nivel: "admin",
      sucursales: {
        connect: [{ id: sucursal1.id }, { id: sucursal2.id }]
      }
    },
  });
  
  // Create account for password login
  const account = await prisma.account.findFirst({
    where: { userId: admin.id }
  });
  
  if (!account) {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    await prisma.account.create({
      data: {
        accountId: admin.id,
        providerId: "credential",
        userId: admin.id,
        password: hashedPassword,
        issuer: "local:credential",
      }
    });
  } else {
    // Si la cuenta existe, asegurarse de que tenga issuer
    await prisma.account.update({
      where: { id: account.id },
      data: { issuer: "local:credential" }
    });
  }
  
  console.log("✅ Administrador creado con acceso a ambas sedes");

  // 3. Crear Membresías
  const membresias = [
    { nombre: "Diaria", diasDuracion: 1, precio: 150.00, descripcion: "Acceso por un día" },
    { nombre: "Semanal", diasDuracion: 7, precio: 900.00, descripcion: "Acceso por una semana" },
    { nombre: "Mensual", diasDuracion: 30, precio: 3000.00, descripcion: "Acceso por un mes" },
  ];

  for (const m of membresias) {
    const mem = await prisma.membresia.findFirst({ where: { nombre: m.nombre } });
    if (!mem) {
      await prisma.membresia.create({ data: m });
    }
  }
  console.log("✅ Membresías listas");

  console.log("¡Semilla plantada correctamente!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
