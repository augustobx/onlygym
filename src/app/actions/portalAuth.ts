"use server";

import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { MEMBER_SESSION_COOKIE, hashSessionToken, requireMemberContext, resolveTenantForMemberLogin } from "@/lib/member-context";

const SESSION_SECONDS = 60 * 60 * 24 * 14;

async function passwordMatches(stored: string, candidate: string) {
  if (stored.startsWith("$2")) return bcrypt.compare(candidate, stored);
  const storedBuffer = Buffer.from(stored);
  const candidateBuffer = Buffer.from(candidate);
  return storedBuffer.length === candidateBuffer.length && timingSafeEqual(storedBuffer, candidateBuffer);
}

async function createMemberSession(tenantId: number, clienteId: number) {
  const token = randomBytes(32).toString("base64url");
  const requestHeaders = await headers();
  await prisma.sesionSocio.create({
    data: {
      tenantId,
      clienteId,
      tokenHash: hashSessionToken(token),
      expiraEn: new Date(Date.now() + SESSION_SECONDS * 1000),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 255),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
  cookieStore.delete("gymlink_cliente_id");
}

export async function loginCliente(usuario: string, passwordStr: string) {
  try {
    const tenant = await resolveTenantForMemberLogin();
    if (!tenant) return { success: false, error: "Gimnasio no disponible" };
    const cleanUser = usuario.trim();
    const authRecord = await prisma.usuarioCliente.findFirst({
      where: { tenantId: tenant.id, OR: [{ usuario: cleanUser }, { cliente: { documento: cleanUser, tenantId: tenant.id } }] },
      include: { cliente: true },
    });
    if (!authRecord || !(await passwordMatches(authRecord.password, passwordStr.trim()))) {
      return { success: false, error: "Usuario o contraseña incorrectos" };
    }
    if (authRecord.cliente.estado !== "activo") {
      return { success: false, error: "Tu cuenta se encuentra inactiva. Consultá en recepción." };
    }

    const upgradedPassword = authRecord.password.startsWith("$2") ? undefined : await bcrypt.hash(passwordStr.trim(), 12);
    await prisma.usuarioCliente.update({
      where: { id: authRecord.id },
      data: { ultimoAcceso: new Date(), ...(upgradedPassword ? { password: upgradedPassword } : {}) },
    });
    await createMemberSession(tenant.id, authRecord.clienteId);
    return { success: true, debeCambiarPassword: authRecord.debeCambiarPassword };
  } catch (error) {
    console.error("Error en login de socio:", error);
    return { success: false, error: "No pudimos iniciar sesión" };
  }
}

export async function logoutCliente() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (rawToken) await prisma.sesionSocio.deleteMany({ where: { tokenHash: hashSessionToken(rawToken) } });
  cookieStore.delete(MEMBER_SESSION_COOKIE);
  cookieStore.delete("gymlink_cliente_id");
  return { success: true };
}

export async function cambiarPasswordPortal(nuevaPassword: string) {
  if (nuevaPassword.trim().length < 8) return { success: false, error: "La contraseña debe tener al menos 8 caracteres" };
  try {
    const context = await requireMemberContext();
    const password = await bcrypt.hash(nuevaPassword.trim(), 12);
    await prisma.$transaction([
      prisma.usuarioCliente.update({ where: { clienteId: context.clienteId }, data: { password, debeCambiarPassword: false } }),
      prisma.sesionSocio.deleteMany({ where: { clienteId: context.clienteId } }),
    ]);
    await createMemberSession(context.tenantId, context.clienteId);
    return { success: true, mensaje: "Contraseña actualizada" };
  } catch {
    return { success: false, error: "No se pudo actualizar la contraseña" };
  }
}

export async function getPortalData() {
  try {
    const context = await requireMemberContext();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const cliente = await prisma.cliente.findFirst({
      where: { id: context.clienteId, tenantId: context.tenantId },
      include: {
        pagos: { include: { membresia: true }, orderBy: { fechaPago: "desc" }, take: 25 },
        ingresos: { where: { tenantId: context.tenantId }, orderBy: { fechaHora: "desc" }, take: 60 },
        cuentaCorriente: { include: { movimientos: { orderBy: { fecha: "desc" }, take: 25 } } },
        sucursales: true,
        sucursalHabitual: true,
        entrenador: { include: { user: { select: { name: true, image: true } } } },
        usuarioCliente: true,
        objetivos: { where: { activo: true }, orderBy: [{ principal: "desc" }, { fechaInicio: "desc" }] },
        asignacionesEntrenamiento: {
          where: { estado: "activa" },
          include: { plan: true, rutina: { include: { ejercicios: { include: { ejercicio: true }, orderBy: [{ dia: "asc" }, { orden: "asc" }] } } } },
          take: 1,
        },
        sesionesEntrenamiento: { include: { rutina: { select: { nombre: true } }, ejercicios: { include: { ejercicio: { select: { nombre: true, grupoMuscular: true } }, series: { orderBy: { numero: "asc" } } }, orderBy: { orden: "asc" } } }, orderBy: { iniciadaEn: "desc" }, take: 30 },
        mediciones: { orderBy: { fecha: "desc" }, take: 20 },
        fotosProgreso: { select: { id: true, fecha: true, tipo: true, mimeType: true }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 30 },
        reservas: {
          where: { estado: { in: ["confirmada", "espera"] }, clase: { inicio: { gte: new Date() } } },
          include: { clase: { include: { tipoClase: true, sucursal: true, entrenador: { include: { user: true } } } } },
          orderBy: { clase: { inicio: "asc" } },
          take: 10,
        },
        notificaciones: { orderBy: { creadaEn: "desc" }, take: 20 },
      },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado" };

    const sucursalId = cliente.sucursalHabitualId || cliente.sucursales[0]?.id || null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaSemana = new Date().getDay();
    const [aforo, saldoPuntos, historialReservas] = await Promise.all([
      sucursalId
        ? Promise.all([
            prisma.ingreso.count({
              where: {
                tenantId: context.tenantId,
                sucursalId,
                fechaHora: { gte: hoy },
                estado: { in: ["permitido", "ACTIVO"] },
                horaSalida: null,
              },
            }),
            prisma.configuracionHorario.findUnique({
              where: { sucursalId_diaSemana: { sucursalId, diaSemana } },
              select: { capacidadMaxima: true },
            }),
          ]).then(([personasAdentro, horario]) => {
            const capacidadMaxima = horario?.capacidadMaxima || 50;
            const porcentaje = capacidadMaxima > 0
              ? Math.min(100, Math.round((personasAdentro / capacidadMaxima) * 100))
              : 0;
            return { personasAdentro, capacidadMaxima, porcentaje };
          })
        : Promise.resolve(null),
      prisma.movimientoPuntos.aggregate({ where: { tenantId: context.tenantId, clienteId: context.clienteId }, _sum: { puntos: true } }),
      prisma.reservaClase.findMany({
        where: { tenantId: context.tenantId, clienteId: context.clienteId, OR: [{ estado: { in: ["cancelada", "asistio"] } }, { clase: { inicio: { lt: new Date() } } }] },
        include: { clase: { include: { tipoClase: true, sucursal: true, entrenador: { include: { user: { select: { name: true } } } } } } },
        orderBy: { creadaEn: "desc" }, take: 30,
      }),
    ]);
    const visitasMes = cliente.ingresos.filter((ingreso) => ingreso.estado === "ACTIVO" && ingreso.fechaHora >= inicioMes).length;

    return { success: true, data: serializeData({
      ...cliente,
      tenant: context.tenant,
      pagos: cliente.pagos.map((p) => ({ ...p, monto: Number(p.monto), membresia: { ...p.membresia, precio: Number(p.membresia.precio) } })),
      cuentaCorriente: cliente.cuentaCorriente ? {
        ...cliente.cuentaCorriente,
        saldo: Number(cliente.cuentaCorriente.saldo),
        limiteCredito: Number(cliente.cuentaCorriente.limiteCredito),
        movimientos: cliente.cuentaCorriente.movimientos.map((m) => ({ ...m, monto: Number(m.monto) })),
      } : null,
      aforo,
      visitasMes,
      puntos: saldoPuntos._sum.puntos || 0,
      historialReservas,
      debeCambiarPassword: cliente.usuarioCliente?.debeCambiarPassword ?? false,
    }) };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function getDetalleTicketVenta(ticketId: number) {
  try {
    const context = await requireMemberContext();
    const venta = await prisma.venta.findFirst({
      where: { id: ticketId, tenantId: context.tenantId, clienteId: context.clienteId },
      include: { cliente: true, user: true, sucursal: true, items: { include: { producto: true } } },
    });
    if (!venta) return { success: false, error: "Ticket no encontrado" };
    return { success: true, data: serializeData({
      id: venta.id,
      fechaVenta: venta.fechaVenta,
      total: Number(venta.total),
      tipoPago: venta.tipoPago,
      cliente: `${venta.cliente?.nombre || ""} ${venta.cliente?.apellido || ""}`.trim(),
      documento: venta.cliente?.documento || null,
      sucursal: venta.sucursal?.nombre || "Sede Principal",
      vendedor: venta.user?.name || "Recepción",
      items: venta.items.map((item) => ({ id: item.id, nombre: item.producto.nombre, cantidad: item.cantidad, precioUnitario: Number(item.precioUnitario), subtotal: Number(item.subtotal) })),
    }) };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}
