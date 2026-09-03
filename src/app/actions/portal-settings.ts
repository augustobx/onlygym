"use server";

import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";
import { hashMemberPassword, verifyMemberPassword } from "@/lib/member-credentials";

export async function cambiarPasswordPortalConActual(actual: string, nueva: string) {
  const currentPassword = actual.trim();
  const nextPassword = nueva.trim();
  if (!currentPassword) return { success: false, error: "Ingresá tu contraseña actual" };
  if (nextPassword.length < 8) return { success: false, error: "La nueva contraseña debe tener al menos 8 caracteres" };
  if (nextPassword.length > 128) return { success: false, error: "La nueva contraseña es demasiado larga" };
  if (currentPassword === nextPassword) return { success: false, error: "Elegí una contraseña diferente a la actual" };

  try {
    const context = await requireMemberContext();
    const credentials = await prisma.usuarioCliente.findFirst({
      where: { tenantId: context.tenantId, clienteId: context.clienteId },
      select: { id: true, password: true },
    });
    if (!credentials || !(await verifyMemberPassword(credentials.password, currentPassword))) {
      return { success: false, error: "La contraseña actual no es correcta" };
    }

    const password = await hashMemberPassword(nextPassword);
    await prisma.$transaction([
      prisma.usuarioCliente.updateMany({
        where: { id: credentials.id, tenantId: context.tenantId, clienteId: context.clienteId },
        data: { password, debeCambiarPassword: false },
      }),
      prisma.sesionSocio.deleteMany({
        where: {
          tenantId: context.tenantId,
          clienteId: context.clienteId,
          id: { not: context.sessionId },
        },
      }),
    ]);
    return { success: true, mensaje: "Contraseña actualizada. Cerramos tus otras sesiones por seguridad." };
  } catch {
    return { success: false, error: "No se pudo actualizar la contraseña" };
  }
}

export async function cerrarOtrasSesionesPortal() {
  try {
    const context = await requireMemberContext();
    const result = await prisma.sesionSocio.deleteMany({
      where: {
        tenantId: context.tenantId,
        clienteId: context.clienteId,
        id: { not: context.sessionId },
      },
    });
    return { success: true, cantidad: result.count };
  } catch {
    return { success: false, error: "No se pudieron cerrar las otras sesiones" };
  }
}
