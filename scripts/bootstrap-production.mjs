// Script de Bootstrap de Producción Idempotente para NanoLabs OnlyGym SaaS
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 [OnlyGym Bootstrap] Iniciando verificación y configuración inicial...");

  // 1. Verificar / Crear Planes SaaS Comerciales
  const planes = [
    {
      codigo: "STARTER",
      nombre: "Plan Starter",
      descripcion: "Ideal para centros de entrenamiento pequeños y estudios independientes.",
      precioMensual: 25000,
      limiteUsuarios: 3,
      limiteSucursales: 1,
      limiteSocios: 250,
      modulos: {
        socios: true,
        membresias: true,
        accesos: true,
        caja: true,
        entrenamiento: true,
        clases: true,
        mediciones: true,
        puntos: true,
        reportes: true,
      },
      activo: true,
    },
    {
      codigo: "PRO",
      nombre: "Plan Profesional",
      descripcion: "Diseñado para gimnasios medianos en crecimiento con clases grupales y fidelización.",
      precioMensual: 45000,
      limiteUsuarios: 10,
      limiteSucursales: 2,
      limiteSocios: 750,
      modulos: {
        socios: true,
        membresias: true,
        accesos: true,
        caja: true,
        entrenamiento: true,
        clases: true,
        mediciones: true,
        puntos: true,
        reportes: true,
      },
      activo: true,
    },
    {
      codigo: "ENTERPRISE",
      nombre: "Plan Enterprise Multi-Sede",
      descripcion: "Para cadenas de gimnasios y grandes complejos deportivos con sedes ilimitadas.",
      precioMensual: 75000,
      limiteUsuarios: 50,
      limiteSucursales: 10,
      limiteSocios: null,
      modulos: {
        socios: true,
        membresias: true,
        accesos: true,
        caja: true,
        entrenamiento: true,
        clases: true,
        mediciones: true,
        puntos: true,
        reportes: true,
      },
      activo: true,
    },
  ];

  for (const p of planes) {
    const existing = await prisma.planSaaS.findUnique({ where: { codigo: p.codigo } });
    if (!existing) {
      await prisma.planSaaS.create({ data: p });
      console.log(`  ✓ Plan SaaS creado: ${p.nombre} (${p.codigo})`);
    } else {
      console.log(`  ✓ Plan SaaS verificado: ${p.nombre}`);
    }
  }

  // 2. Verificar / Crear SuperAdmin de Plataforma
  const superadminEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@nanolabs.ar").toLowerCase().trim();
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || "NanoLabs#SuperAdmin2026";

  const existingSuperAdmin = await prisma.superAdmin.findUnique({ where: { email: superadminEmail } });
  if (!existingSuperAdmin) {
    const passwordHash = await bcrypt.hash(superadminPassword, 10);
    await prisma.superAdmin.create({
      data: {
        email: superadminEmail,
        nombre: "NanoLabs SuperAdmin",
        passwordHash,
        rol: "SUPERADMIN",
        activo: true,
      },
    });
    console.log(`  ✓ SuperAdmin inicial creado: ${superadminEmail}`);
  } else {
    console.log(`  ✓ SuperAdmin verificado: ${superadminEmail}`);
  }

  // 3. Verificar / Crear Tenant Demo
  const defaultSlug = (process.env.DEFAULT_TENANT_SLUG || "onlygym-demo").toLowerCase().trim();
  const proPlan = await prisma.planSaaS.findUnique({ where: { codigo: "PRO" } });

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: defaultSlug } });
  if (!existingTenant) {
    const vencimiento = new Date();
    vencimiento.setFullYear(vencimiento.getFullYear() + 1);

    const tenant = await prisma.tenant.create({
      data: {
        nombre: "OnlyGym Demo Club",
        slug: defaultSlug,
        estado: "activo",
        planSaaSId: proPlan?.id,
        fechaVencimiento: vencimiento,
        sucursales: {
          create: {
            nombre: "Sede Central",
            direccion: "Av. Principal 1234",
            estado: "activo",
          },
        },
      },
    });
    console.log(`  ✓ Tenant demo inicial creado: ${tenant.nombre} (${tenant.slug})`);
  } else {
    console.log(`  ✓ Tenant demo verificado: ${existingTenant.nombre}`);
  }

  console.log("🎉 [OnlyGym Bootstrap] Completado exitosamente. Plataforma lista para operar.");
}

main()
  .catch((e) => {
    console.error("❌ Error en bootstrap:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
