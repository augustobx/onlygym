import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RolTenant } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { selectActiveMembership, TenantSelectionRequiredError } from "@/lib/access-policy";
import { writeAudit } from "@/lib/audit";

export const ACTIVE_BRANCH_COOKIE = "onlygym_active_branch";
export const ACTIVE_TENANT_COOKIE = "onlygym_active_tenant";
export { TenantSelectionRequiredError };

export class AuthorizationError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type StaffContext = {
  userId: string;
  tenantId: number;
  tenantSlug: string;
  tenantName: string;
  role: RolTenant;
  branchId: number | null;
};

export type TenantModule =
  | "socios"
  | "membresias"
  | "accesos"
  | "caja"
  | "entrenamiento"
  | "clases"
  | "mediciones"
  | "puntos"
  | "reportes";

const DEFAULT_MODULES: Record<TenantModule, boolean> = {
  socios: true,
  membresias: true,
  accesos: true,
  caja: true,
  entrenamiento: true,
  clases: true,
  mediciones: true,
  puntos: true,
  reportes: true,
};

type StaffContextOptions = {
  branchId?: number | null;
  roles?: RolTenant[];
};

export async function requireStaffContext(options: StaffContextOptions = {}): Promise<StaffContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AuthorizationError("Sesión requerida");

  const memberships = await prisma.tenantUsuario.findMany({
    where: {
      userId: session.user.id,
      estado: "activo",
      tenant: { estado: "activo" },
    },
    include: { tenant: true },
    orderBy: { id: "asc" },
  });

  const cookieStore = await cookies();
  const cookieTenantId = Number(cookieStore.get(ACTIVE_TENANT_COOKIE)?.value || 0);
  const membership = selectActiveMembership(memberships, cookieTenantId || null);
  if (!membership) throw new AuthorizationError("Sin acceso a un gimnasio activo");
  if (options.roles && !options.roles.includes(membership.rol)) {
    throw new AuthorizationError("Tu rol no permite realizar esta operación");
  }

  const cookieBranchId = Number(cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value || 0);
  const requestedBranchId = options.branchId ?? (cookieBranchId || null);
  let branchId: number | null = null;

  if (requestedBranchId) {
    const branch = await prisma.sucursal.findFirst({
      where: {
        id: requestedBranchId,
        tenantId: membership.tenantId,
        estado: "activo",
        ...(membership.rol === RolTenant.RECEPCION || membership.rol === RolTenant.ENTRENADOR
          ? { usuarios: { some: { id: session.user.id } } }
          : {}),
      },
      select: { id: true },
    });
    if (!branch) throw new AuthorizationError("Sucursal no autorizada");
    branchId = branch.id;
  }

  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.nombre,
    role: membership.rol,
    branchId,
  };
}

export async function setActiveTenantCookie(tenantId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AuthorizationError("Sesión requerida");
  const membership = await prisma.tenantUsuario.findFirst({
    where: { tenantId, userId: session.user.id, estado: "activo", tenant: { estado: "activo" } },
    include: { tenant: { select: { id: true, slug: true, nombre: true } } },
  });
  if (!membership) {
    await writeAudit({ actorUserId: session.user.id, accion: "tenant.seleccion", entidad: "Tenant", entidadId: tenantId, resultado: "rechazado" });
    throw new AuthorizationError("Gimnasio no autorizado");
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, String(membership.tenantId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
    priority: "high",
  });
  cookieStore.delete(ACTIVE_BRANCH_COOKIE);
  await writeAudit({ tenantId: membership.tenantId, actorUserId: session.user.id, accion: "tenant.seleccion", entidad: "Tenant", entidadId: membership.tenantId });
  return membership;
}

export async function setActiveBranchCookie(branchId: number) {
  const context = await requireStaffContext({ branchId });
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, String(context.branchId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
    priority: "high",
  });
  await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "sucursal.seleccion", entidad: "Sucursal", entidadId: branchId });
  return context;
}

export async function getTenantModules(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { modulos: true } });
  const configured = tenant?.modulos && typeof tenant.modulos === "object" && !Array.isArray(tenant.modulos)
    ? tenant.modulos as Record<string, unknown>
    : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_MODULES).map(([key, defaultValue]) => [key, typeof configured[key] === "boolean" ? configured[key] : defaultValue]),
  ) as Record<TenantModule, boolean>;
}

export async function requireTenantModule(tenantId: number, module: TenantModule) {
  const modules = await getTenantModules(tenantId);
  if (!modules[module]) throw new AuthorizationError(`El módulo ${module} no está habilitado para este gimnasio`);
}
