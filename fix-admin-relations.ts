import { prisma } from "./src/lib/prisma";

async function main() {
  const admin = await prisma.user.findFirst({ where: { username: "admin" } });
  
  if (admin) {
    const s1 = await prisma.sucursal.findFirst({ where: { id: 1 } });
    const s2 = await prisma.sucursal.findFirst({ where: { id: 2 } });
    
    if (s1 && s2) {
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          nivel: "admin",
          sucursales: {
            connect: [{ id: 1 }, { id: 2 }]
          }
        }
      });
      console.log("Relaciones y permisos de admin corregidos.");
    }
  }
}
main().finally(() => prisma.$disconnect());
