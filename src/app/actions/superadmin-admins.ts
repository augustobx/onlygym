"use server";

import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin-auth";
import { writeAudit } from "@/lib/audit";

const adminCredentialsSchema = z.object({
  tenantId: z.number().int().positive(),
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
});

export async function actualizarAdminTenantSuperAdmin(input: z.input<typeof adminCredentialsSchema>) {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = adminCredentialsSchema.parse(input);

    const membership = await prisma.tenantUsuario.findFirst({
      where: {
        tenantId: data.tenantId,
        userId: data.userId,
        rol: { in: ["OWNER", "ADMIN"] },
      },
      include: { user: true },
    });

    if (!membership) {
      return { success: false, error: "El usuario no es administrador de este gimnasio" };
    }

    const emailTaken = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: data.userId },
      },
      select: { id: true },
    });

    if (emailTaken) {
      return { success: false, error: "Ese correo ya está utilizado por otro usuario" };
    }

    const passwordChanged = Boolean(data.password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.userId },
        data: {
          name: data.name,
          email: data.email,
          emailVerified: true,
          estado: "activo",
        },
      });

      const credentialAccount = await tx.account.findFirst({
        where: { userId: data.userId, providerId: "credential" },
        select: { id: true },
      });

      if (data.password) {
        const passwordHash = await hashPassword(data.password);

        if (credentialAccount) {
          await tx.account.update({
            where: { id: credentialAccount.id },
            data: {
              password: passwordHash,
              accountId: data.email,
            },
          });
        } else {
          await tx.account.create({
            data: {
              accountId: data.email,
              providerId: "credential",
              userId: data.userId,
              password: passwordHash,
            },
          });
        }
      } else if (credentialAccount) {
        await tx.account.update({
          where: { id: credentialAccount.id },
          data: { accountId: data.email },
        });
      }

      // Cambio de identidad/credenciales: invalidar sesiones activas.
      await tx.session.deleteMany({ where: { userId: data.userId } });
    });

    await writeAudit({
      tenantId: data.tenantId,
      actorUserId: `superadmin:${superAdmin.id}`,
      accion: "superadmin.tenant_admin.credenciales_actualizar",
      entidad: "User",
      entidadId: data.userId,
      metadata: {
        emailAnterior: membership.user.email,
        emailNuevo: data.email,
        nombreNuevo: data.name,
        passwordChanged,
        sesionesRevocadas: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error actualizando admin de tenant:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudieron actualizar las credenciales",
    };
  }
}
