import { auth } from "./src/lib/auth";
import { prisma } from "./src/lib/prisma";

async function main() {
  // 1. Borrar admin anterior para evitar conflictos
  await prisma.user.deleteMany({ where: { username: "admin" } });
  
  // 2. Crear admin a través del API nativa de Better Auth
  // para que gestione el providerId, hashes, issuers exactos y todo internamente.
  
  const headers = new Headers();
  
  const response = await auth.api.signUpEmail({
    body: {
      name: "Administrador Principal",
      email: "admin@gymlink.local",
      username: "admin",
      password: "admin123"
    } as any,
    headers
  });
  
  console.log("Respuesta BetterAuth API:", response);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
