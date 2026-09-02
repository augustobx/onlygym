"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { RolTenant } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { writeAudit } from "@/lib/audit";
import { requirePlatformRequestHost } from "@/lib/request-tenant";

const onboardingSchema = z.object({
  nombreGimnasio: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/, "Slug solo letras minúsculas, números y guiones"),
  planCodigo: z.string().default("STARTER"),
  nombreAdmin: z.string().trim().min(2).max(100),
  emailAdmin: z.string().trim().email(),
  passwordAdmin: z.string().min(8),
  nombreSede: z.string().trim().min(2).max(100).default("Sede Principal"),
  direccionSede: z.string().trim().optional(),
});

export async function registrarNuevoGimnasio(input: z.input<typeof onboardingSchema>) {
  try {
    await requirePlatformRequestHost();
    const data = onboardingSchema.parse(input);
    const slug = data.slug.toLowerCase().trim();
    const email = data.emailAdmin.toLowerCase().trim();

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return { success: false, error: "El subdominio ya está en uso. Por favor elige otro." };

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { success: false, error: "Ya existe un usuario con este correo electrónico." };

    let plan = await prisma.planSaaS.findUnique({ where: { codigo: data.planCodigo } });
    if (!plan) plan = await prisma.planSaaS.findFirst({ where: { activo: true }, orderBy: { precioMensual: "asc" } });

    const diasPrueba = 14;
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPrueba);
    const passwordHash = await hashPassword(data.passwordAdmin);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: data.nombreGimnasio,
          slug,
          estado: "prueba",
          planSaaSId: plan?.id,
          fechaVencimiento,
        },
      });

      const sucursal = await tx.sucursal.create({
        data: {
          tenantId: tenant.id,
          nombre: data.nombreSede,
          direccion: data.direccionSede || null,
          estado: "activo",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: data.nombreAdmin,
          nivel: "admin",
          estado: "activo",
          emailVerified: true,
          sucursales: { connect: [{ id: sucursal.id }] },
        },
      });

      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
          issuer: "local:credential",
        },
      });

      await tx.tenantUsuario.create({
        data: { tenantId: tenant.id, userId: user.id, rol: RolTenant.OWNER, estado: "activo" },
      });

      if (plan) {
        await tx.suscripcionSaaS.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            estado: "prueba",
            fechaInicio: new Date(),
            fechaVencimiento,
            monto: plan.precioMensual,
            intervalo: "mensual",
            notas: "Onboarding autoservicio (14 días gratis)",
          },
        });
      }

      return { tenant, user, sucursal };
    });

    await writeAudit({
      actorUserId: result.user.id,
      tenantId: result.tenant.id,
      accion: "onboarding.completado",
      entidad: "Tenant",
      entidadId: result.tenant.id,
      metadata: { slug, email },
    });

    return { success: true, data: { slug: result.tenant.slug, nombre: result.tenant.nombre } };
  } catch (error) {
    console.error("Error en onboarding:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error al registrar gimnasio" };
  }
}
