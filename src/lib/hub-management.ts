import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./prisma";
import { ManagementError, requireCurrentVersion, requirePeriod, requireTenantSlug, type ManagementCommand } from "./hub-management-contract";
import type { ManagementAdapter } from "./hub-management-http";
import { permittedManagementOperations } from "./hub-management-http";

const moduleKeys = ["socios", "membresias", "accesos", "caja", "entrenamiento", "clases", "mediciones", "puntos", "reportes"];
const limitKeys = ["maxUsers", "maxBranches", "maxMembers"];
const states = { ACTIVE: "activo", TRIAL: "prueba", SUSPENDED: "suspendido", CANCELED: "cancelado" };
const subscriptions = { ACTIVE: "activa", TRIAL: "prueba", SUSPENDED: "suspendida", CANCELED: "cancelada" };
const normalize = (value: string) => Object.entries(states).find(([, raw]) => raw === value)?.[0] || "UNKNOWN";
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function numeric(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw new ManagementError(400, "ID", "Identificador inválido.");
  return Number(value);
}
function page(url: URL) {
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new ManagementError(400, "OFFSET", "Paginación inválida.");
  return offset;
}
function modules(value: unknown) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(moduleKeys.filter(key => typeof data[key] === "boolean").map(key => [key, data[key]])) as Record<string, boolean>;
}
function adaptPlan(p: { id: number; codigo: string; nombre: string; descripcion: string | null; precioMensual: Prisma.Decimal; activo: boolean; limiteUsuarios: number; limiteSucursales: number; limiteSocios: number | null; modulos: unknown; actualizadoEn: Date }) {
  return { id: String(p.id), code: p.codigo, name: p.nombre, description: p.descripcion || "", priceCents: Math.round(Number(p.precioMensual) * 100), currency: "ARS", active: p.activo,
    limits: { maxUsers: p.limiteUsuarios, maxBranches: p.limiteSucursales, ...(p.limiteSocios === null ? {} : { maxMembers: p.limiteSocios }) }, modules: modules(p.modulos), version: p.actualizadoEn.toISOString() };
}
function planData(input: Extract<ManagementCommand, { operation: "plan.create" | "plan.update" }>["input"]) {
  if (Object.keys(input.modules).some(key => !moduleKeys.includes(key)) || Object.keys(input.limits).some(key => !limitKeys.includes(key)) || !input.limits.maxUsers || !input.limits.maxBranches) throw new ManagementError(422, "PLAN_FEATURES", "Módulos o límites del plan inválidos.");
  return { nombre: input.name, descripcion: input.description || null, precioMensual: new Prisma.Decimal(input.priceCents).div(100), activo: input.active,
    limiteUsuarios: input.limits.maxUsers, limiteSucursales: input.limits.maxBranches, limiteSocios: input.limits.maxMembers ?? null, modulos: input.modules };
}
async function read(resource: string, url: URL) {
  if (resource === "catalog") return { operations: permittedManagementOperations(), modules: moduleKeys, limits: limitKeys, optionalLimits: ["maxMembers"], currency: "ARS", destructiveDelete: false };
  if (resource === "plans") {
    const offset = page(url), rows = await prisma.planSaaS.findMany({ orderBy: { id: "asc" }, skip: offset, take: 101 });
    return { items: rows.slice(0, 100).map(adaptPlan), nextOffset: rows.length > 100 ? offset + 100 : null };
  }
  const suppliedId = url.searchParams.get("tenantId");
  if (resource === "audit") {
    const offset = page(url), tenantId = suppliedId ? numeric(suppliedId) : undefined;
    const rows = await prisma.auditoria.findMany({ where: { ...(tenantId ? { tenantId } : {}) }, orderBy: [{ creadaEn: "desc" }, { id: "desc" }], skip: offset, take: 101,
      select: { id: true, tenantId: true, actorUserId: true, accion: true, entidad: true, entidadId: true, resultado: true, creadaEn: true } });
    return { items: rows.slice(0, 100).map(r => ({ id: String(r.id), tenantId: r.tenantId === null ? null : String(r.tenantId), actor: r.actorUserId, action: r.accion, entity: r.entidad, entityId: r.entidadId, result: r.resultado, createdAt: r.creadaEn.toISOString() })), nextOffset: rows.length > 100 ? offset + 100 : null };
  }
  if (resource !== "tenant" || !suppliedId) throw new ManagementError(400, "RESOURCE", "Recurso de gestión inválido.");
  const t = await prisma.tenant.findUnique({ where: { id: numeric(suppliedId) }, include: {
    planSaaS: true, suscripciones: { orderBy: [{ creadaEn: "desc" }, { id: "desc" }], take: 1 },
    usuarios: { where: { rol: { in: ["OWNER", "ADMIN"] } }, take: 100, select: { userId: true, rol: true, estado: true, user: { select: { name: true, email: true } } } },
    _count: { select: { clientes: true, sucursales: true, usuarios: true, reservas: true } },
  } });
  if (!t) throw new ManagementError(404, "NOT_FOUND", "Tenant inexistente.");
  const sub = t.suscripciones[0], overrides = modules(t.modulos), inherited = modules(t.planSaaS?.modulos);
  const payments = await prisma.pagoPlataforma.findMany({ where: { tenantId: t.id }, orderBy: [{ fechaPago: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, monto: true, metodoPago: true, referencia: true, fechaPago: true, estado: true } });
  return { id: String(t.id), name: t.nombre, slug: t.slug, status: normalize(t.estado), version: t.actualizadoEn.toISOString(), plan: t.planSaaS ? adaptPlan(t.planSaaS) : null,
    subscription: sub ? { id: String(sub.id), planId: String(sub.planId), status: sub.estado, start: sub.fechaInicio.toISOString(), end: sub.fechaVencimiento.toISOString() } : null,
    modules: Object.fromEntries(moduleKeys.map(key => [key, { enabled: overrides[key] ?? inherited[key] ?? true, override: overrides[key] ?? null }])),
    admins: t.usuarios.map(u => ({ id: u.userId, name: u.user.name, email: u.user.email, role: u.rol, active: u.estado === "activo" })), usage: t._count,
    payments: payments.map(p => ({ id: String(p.id), amountCents: Math.round(Number(p.monto) * 100), method: p.metodoPago, reference: p.referencia, status: p.estado, createdAt: p.fechaPago.toISOString() })) };
}
async function execute(command: ManagementCommand, fingerprint: string) {
  return prisma.$transaction(async tx => {
    // Database locks plus audit receipts provide durable idempotency without a schema change.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"hub-request:" + command.requestId}, 0))`;
    const previous = await tx.auditoria.findFirst({ where: { accion: "hub.management", metadata: { path: ["requestId"], equals: command.requestId } }, select: { metadata: true } });
    if (previous) {
      const receipt = previous.metadata as Record<string, Prisma.JsonValue>;
      if (receipt.fingerprint !== fingerprint) throw new ManagementError(409, "IDEMPOTENCY_CONFLICT", "La solicitud ya se utilizó con otros datos.");
      return receipt.result;
    }
    let tenantId: number | null = "tenantId" in command.input ? numeric(command.input.tenantId) : null;
    if (tenantId !== null) await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;
    const current = tenantId !== null ? await tx.tenant.findUnique({ where: { id: tenantId } }) : null;
    if (tenantId !== null && !current) throw new ManagementError(404, "NOT_FOUND", "Tenant inexistente.");
    if (current && "version" in command.input) requireCurrentVersion(current.actualizadoEn, command.input.version);
    let before: unknown = current ? { id: String(current.id), name: current.nombre, slug: current.slug, status: normalize(current.estado), version: current.actualizadoEn.toISOString(), planId: current.planSaaSId, expiresAt: current.fechaVencimiento, modules: modules(current.modulos) } : null;
    const beforeSubscription = tenantId === null ? null : await tx.suscripcionSaaS.findFirst({ where: { tenantId }, orderBy: [{ creadaEn: "desc" }, { id: "desc" }], select: { id: true, planId: true, estado: true, fechaInicio: true, fechaVencimiento: true, monto: true } });
    let entityId: string | null = tenantId === null ? null : String(tenantId);
    let paymentReference: string | null = null;
    switch (command.operation) {
      case "tenant.create": {
        const i = command.input; requireTenantSlug(i.slug); requirePeriod(new Date(i.start), new Date(i.end), true);
        await tx.$queryRaw`SELECT id FROM planes_saas WHERE id = ${numeric(i.planId)} FOR SHARE`;
        const plan = await tx.planSaaS.findFirst({ where: { id: numeric(i.planId), activo: true } });
        if (!plan) throw new ManagementError(422, "PLAN", "Plan inexistente o inactivo.");
        const password = await hashPassword(i.password);
        const t = await tx.tenant.create({ data: { nombre: i.name, slug: i.slug, estado: states[i.status], plan: plan.codigo.toLowerCase(), planSaaSId: plan.id, fechaVencimiento: new Date(i.end) } });
        const branch = await tx.sucursal.create({ data: { tenantId: t.id, nombre: "Sede Principal", estado: "activo" } });
        const user = await tx.user.create({ data: { name: i.ownerName, email: i.ownerEmail.toLowerCase(), emailVerified: true, nivel: "admin", estado: "activo", sucursales: { connect: { id: branch.id } } } });
        await tx.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, issuer: "local:credential", password } });
        await tx.tenantUsuario.create({ data: { tenantId: t.id, userId: user.id, rol: "OWNER", estado: "activo" } });
        await tx.suscripcionSaaS.create({ data: { tenantId: t.id, planId: plan.id, estado: subscriptions[i.status], fechaInicio: new Date(i.start), fechaVencimiento: new Date(i.end), monto: plan.precioMensual, intervalo: "mensual" } });
        tenantId = t.id; entityId = String(t.id); break;
      }
      case "tenant.update": {
        const i = command.input; requireTenantSlug(i.slug);
        await tx.tenant.update({ where: { id: tenantId! }, data: { nombre: i.name, slug: i.slug } }); break;
      }
      case "tenant.status": {
        const i = command.input;
        const sub = await tx.suscripcionSaaS.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ creadaEn: "desc" }, { id: "desc" }] });
        if (["ACTIVE", "TRIAL"].includes(i.status)) {
          if (!sub) throw new ManagementError(422, "SUBSCRIPTION", "Configurá una suscripción antes de activar el tenant.");
          requirePeriod(sub.fechaInicio, sub.fechaVencimiento, true);
        }
        await tx.tenant.update({ where: { id: tenantId! }, data: { estado: states[i.status] } });
        if (sub) await tx.suscripcionSaaS.update({ where: { id: sub.id }, data: { estado: subscriptions[i.status] } }); break;
      }
      case "subscription.update": {
        const i = command.input, start = new Date(i.start), end = new Date(i.end); requirePeriod(start, end, ["ACTIVE", "TRIAL"].includes(i.status));
        const sub = await tx.suscripcionSaaS.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ creadaEn: "desc" }, { id: "desc" }] });
        await tx.$queryRaw`SELECT id FROM planes_saas WHERE id = ${numeric(i.planId)} FOR SHARE`;
        const plan = await tx.planSaaS.findUnique({ where: { id: numeric(i.planId) } });
        if (!plan || (!plan.activo && sub?.planId !== plan.id)) throw new ManagementError(422, "PLAN", "Plan inexistente o inactivo.");
        const data = { planId: plan.id, estado: subscriptions[i.status], fechaInicio: start, fechaVencimiento: end, monto: plan.precioMensual };
        if (sub) await tx.suscripcionSaaS.update({ where: { id: sub.id }, data });
        else await tx.suscripcionSaaS.create({ data: { ...data, tenantId: tenantId! } });
        await tx.tenant.update({ where: { id: tenantId! }, data: { estado: states[i.status], fechaVencimiento: end, planSaaSId: plan.id, plan: plan.codigo.toLowerCase() } }); break;
      }
      case "subscription.renew":
      case "payment.record": {
        const i = command.input;
        const sub = await tx.suscripcionSaaS.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ creadaEn: "desc" }, { id: "desc" }] });
        if (!sub) throw new ManagementError(422, "SUBSCRIPTION", "El tenant no tiene una suscripción.");
        if (command.operation === "payment.record") {
          const p = command.input; paymentReference = p.reference;
          if (await tx.pagoPlataforma.findFirst({ where: { tenantId: tenantId!, referencia: p.reference }, select: { id: true } })) throw new ManagementError(409, "PAYMENT_DUPLICATE", "La referencia de pago ya está registrada.");
          await tx.pagoPlataforma.create({ data: { tenantId: tenantId!, suscripcionId: sub.id, monto: new Prisma.Decimal(p.amountCents).div(100), metodoPago: p.method, referencia: p.reference, estado: "completado" } });
        }
        if (i.days > 0) {
          const now = new Date(), end = new Date(Math.max(now.getTime(), sub.fechaVencimiento.getTime()) + i.days * 86400000);
          await tx.suscripcionSaaS.update({ where: { id: sub.id }, data: { estado: "activa", fechaInicio: now, fechaVencimiento: end } });
          await tx.tenant.update({ where: { id: tenantId! }, data: { estado: "activo", fechaVencimiento: end } });
        }
        break;
      }
      case "module.set": {
        const i = command.input;
        if (!moduleKeys.includes(i.key) || i.limit !== null) throw new ManagementError(422, "MODULE", "Módulo inválido para OnlyGym.");
        const next = modules(current!.modulos); if (i.enabled === null) delete next[i.key]; else next[i.key] = i.enabled;
        await tx.tenant.update({ where: { id: tenantId! }, data: { modulos: next } }); break;
      }
      case "admin.update":
      case "admin.revoke": {
        const i = command.input;
        const membership = await tx.tenantUsuario.findFirst({ where: { tenantId: tenantId!, userId: i.userId, rol: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
        if (!membership) throw new ManagementError(404, "ADMIN", "El usuario no administra este tenant.");
        if (await tx.tenantUsuario.count({ where: { userId: i.userId } }) > 1) throw new ManagementError(409, "SHARED_ACCOUNT", "La cuenta administra varios tenants; requiere una gestión de identidad independiente.");
        if (command.operation === "admin.update") {
          const a = command.input;
          await tx.user.update({ where: { id: a.userId }, data: { name: a.name, email: a.email.toLowerCase(), emailVerified: true } });
          if (a.password) {
            const account = await tx.account.findFirst({ where: { userId: a.userId, providerId: "credential" }, select: { id: true } });
            const password = await hashPassword(a.password);
            if (account) await tx.account.update({ where: { id: account.id }, data: { password, accountId: a.userId, issuer: "local:credential" } });
            else await tx.account.create({ data: { userId: a.userId, providerId: "credential", accountId: a.userId, issuer: "local:credential", password } });
          }
        }
        await tx.session.deleteMany({ where: { userId: i.userId } }); break;
      }
      case "plan.create": {
        const p = await tx.planSaaS.create({ data: { ...planData(command.input), codigo: command.input.code } }); entityId = String(p.id); break;
      }
      case "plan.update": {
        const i = command.input, id = numeric(i.planId);
        await tx.$queryRaw`SELECT id FROM planes_saas WHERE id = ${id} FOR UPDATE`;
        const p = await tx.planSaaS.findUniqueOrThrow({ where: { id } }); requireCurrentVersion(p.actualizadoEn, i.version);
        before = adaptPlan(p);
        await tx.planSaaS.update({ where: { id }, data: { ...planData(i), actualizadoEn: new Date(Math.max(Date.now(), p.actualizadoEn.getTime() + 1)) } }); entityId = String(id); break;
      }
    }
    const updated = tenantId === null ? null : await tx.tenant.update({ where: { id: tenantId }, data: { actualizadoEn: new Date(Math.max(Date.now(), (current?.actualizadoEn.getTime() ?? 0) + 1)) }, select: { actualizadoEn: true } });
    const result = { entityId, tenantId: tenantId === null ? null : String(tenantId), version: updated?.actualizadoEn.toISOString() ?? null };
    await tx.auditoria.create({ data: { tenantId, actorUserId: "hub:" + command.actor, accion: "hub.management", entidad: command.operation, entidadId: entityId,
      metadata: json({ requestId: command.requestId, fingerprint, actor: command.actor, operation: command.operation, before, beforeSubscription, changedFields: Object.keys(command.input).filter(k=>k!=="password"), passwordChanged: "password" in command.input && !!command.input.password, paymentReference, ...(command.operation === "payment.record" ? { amountCents: command.input.amountCents, method: command.input.method, notes: command.input.notes } : {}), result }) } });
    return result;
  }, { timeout: 20_000 });
}
export const gymManagement: ManagementAdapter = { product: "onlygym", read, execute };

