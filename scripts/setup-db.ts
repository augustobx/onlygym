import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Iniciando inicialización de base de datos y usuario admin...");

  // 1. Crear Sede Principal si no existe
  const sucursal = await prisma.sucursal.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: "Sede Principal",
      direccion: "Av. San Martín 123",
      estado: "activo",
    },
  });
  console.log("Sede asegurada:", sucursal.nombre);

  // 2. Limpiar admin previo si existe
  await prisma.user.deleteMany({
    where: {
      OR: [
        { username: "admin" },
        { email: "admin@gymlink.local" }
      ]
    }
  });

  // 3. Crear usuario admin a través del motor nativo de Better Auth
  const headers = new Headers();
  const res = await auth.api.signUpEmail({
    body: {
      name: "Administrador General",
      email: "admin@gymlink.local",
      username: "admin",
      password: "admin123",
    } as any,
    headers,
  });

  console.log("Usuario creado en Better Auth:", res?.user?.email || "OK");

  // 4. Asignar rol admin y vincular con la Sede 1
  const adminUser = await prisma.user.findFirst({
    where: { username: "admin" }
  });

  if (adminUser) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        nivel: "admin",
        estado: "activo",
        sucursales: {
          connect: [{ id: 1 }]
        }
      }
    });
    console.log("✅ Permisos de administrador y Sede 1 vinculados con éxito.");
  }

  console.log("\n========================================");
  console.log("  USUARIO ADMINISTRADOR LISTO");
  console.log("  Usuario:    admin");
  console.log("  Contraseña: admin123");
  console.log("========================================\n");
}

main()
  .catch((err) => {
    console.error("Error al inicializar admin:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
