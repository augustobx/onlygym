import { prisma } from "./src/lib/prisma";

async function check() {
  const admin = await prisma.user.findFirst({ where: { username: "admin" } });
  console.log("Admin user:", admin);
  
  if (admin) {
    const account = await prisma.account.findMany({ where: { userId: admin.id } });
    console.log("Admin account:", account);
  }
}

check().catch(console.error);
