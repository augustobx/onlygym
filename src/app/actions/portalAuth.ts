"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getAforoEnVivo } from "@/app/actions/horarios";
import { serializeData } from "@/lib/serialize";

/**
 * Autenticación del Socio en el Portal
 */
export async function loginCliente(usuario: string, passwordStr: string) {
  try {
    const cleanUser = usuario.trim();

    // Buscar en UsuarioCliente
    const auth = await prisma.usuarioCliente.findFirst({
      where: {
        OR: [
          { usuario: cleanUser },
          { cliente: { documento: cleanUser } },
        ],
      },
      include: { cliente: true },
    });

    if (!auth) {
      return { success: false, error: "Usuario o DNI no encontrado" };
    }

    if (auth.cliente.estado !== "activo") {
      return { success: false, error: "Tu cuenta se encuentra inactiva. Consulta en recepción." };
    }

    const isValid = auth.password === passwordStr.trim();
    if (!isValid) {
      return { success: false, error: "Contraseña incorrecta" };
    }

    // Actualizar último acceso
    await prisma.usuarioCliente.update({
      where: { id: auth.id },
      data: { ultimoAcceso: new Date() },
    });

    // Set cookie de sesión de socio
    const cookieStore = await cookies();
    cookieStore.set("gymlink_cliente_id", String(auth.clienteId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14, // 2 semanas
      path: "/",
    });

    return {
      success: true,
      debeCambiarPassword: auth.debeCambiarPassword,
    };
  } catch (error) {
    console.error("Error en login cliente:", error);
    return { success: false, error: "Error en el servidor al iniciar sesión" };
  }
}

/**
 * Cierra la sesión del socio
 */
export async function logoutCliente() {
  const cookieStore = await cookies();
  cookieStore.delete("gymlink_cliente_id");
  return { success: true };
}

/**
 * Permite al socio cambiar su contraseña
 */
export async function cambiarPasswordPortal(nuevaPassword: string) {
  const cookieStore = await cookies();
  const clienteId = cookieStore.get("gymlink_cliente_id")?.value;
  if (!clienteId) return { success: false, error: "No autorizado" };

  if (!nuevaPassword || nuevaPassword.trim().length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  try {
    await prisma.usuarioCliente.update({
      where: { clienteId: Number(clienteId) },
      data: {
        password: nuevaPassword.trim(),
        debeCambiarPassword: false,
      },
    });

    return { success: true, mensaje: "Contraseña actualizada exitosamente" };
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    return { success: false, error: "Error al actualizar la contraseña" };
  }
}

/**
 * Obtiene los datos integrales del socio, credencial QR, cuenta corriente y aforo de su sucursal
 */
export async function getPortalData() {
  const cookieStore = await cookies();
  const clienteId = cookieStore.get("gymlink_cliente_id")?.value;
  if (!clienteId) return { success: false, error: "No autorizado" };

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(clienteId) },
      include: {
        pagos: {
          include: { membresia: true },
          orderBy: { fechaPago: "desc" },
          take: 25,
        },
        ingresos: {
          orderBy: { fechaHora: "desc" },
          take: 25,
        },
        cuentaCorriente: {
          include: {
            movimientos: {
              orderBy: { fecha: "desc" },
              take: 25,
            },
          },
        },
        sucursales: true,
        usuarioCliente: true,
      },
    });

    if (!cliente) return { success: false, error: "Cliente no encontrado" };

    // Obtener aforo en tiempo real de su sucursal principal
    const sucursalId = cliente.sucursales?.[0]?.id || 1;
    const aforoRes = await getAforoEnVivo(sucursalId);
    const aforo = aforoRes.success ? aforoRes.data : null;

    // Horarios valle recomendados
    const horasRecomendadas = [
      { turno: "Mañana Temprana", rango: "07:00 a 10:30", afluencia: "Baja (Ideal)" },
      { turno: "Mediodía / Siesta", rango: "13:30 a 16:30", afluencia: "Media-Baja" },
      { turno: "Noche", rango: "21:00 a 23:00", afluencia: "Baja" },
    ];

    return {
      success: true,
      data: serializeData({
        ...cliente,
        pagos: cliente.pagos.map((p) => ({
          ...p,
          monto: Number(p.monto),
          membresia: p.membresia ? { ...p.membresia, precio: Number(p.membresia.precio) } : null,
        })),
        cuentaCorriente: cliente.cuentaCorriente
          ? {
              ...cliente.cuentaCorriente,
              saldo: Number(cliente.cuentaCorriente.saldo),
              limiteCredito: Number(cliente.cuentaCorriente.limiteCredito),
              movimientos: cliente.cuentaCorriente.movimientos.map((m) => ({
                ...m,
                monto: Number(m.monto),
              })),
            }
          : null,
        aforo,
        horasRecomendadas,
        debeCambiarPassword: cliente.usuarioCliente?.debeCambiarPassword ?? false,
      }),
    };
  } catch (error) {
    console.error("Error cargando portal:", error);
    return { success: false, error: "Error cargando datos del portal" };
  }
}

/**
 * Obtiene el detalle desglosado de un ticket de compra de cantina para el socio
 */
export async function getDetalleTicketVenta(ticketId: number) {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: ticketId },
      include: {
        cliente: true,
        user: true,
        sucursal: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!venta) {
      return { success: false, error: "Ticket de venta no encontrado" };
    }

    const data = {
      id: venta.id,
      fechaVenta: venta.fechaVenta,
      total: Number(venta.total),
      tipoPago: venta.tipoPago,
      cliente: venta.cliente ? `${venta.cliente.nombre} ${venta.cliente.apellido}` : "Cliente Mostrador",
      documento: venta.cliente?.documento || null,
      sucursal: venta.sucursal?.nombre || "Sede Principal",
      vendedor: venta.user?.name || "Cajero",
      items: venta.items.map((it) => ({
        id: it.id,
        nombre: it.producto?.nombre || "Producto",
        cantidad: it.cantidad,
        precioUnitario: Number(it.precioUnitario),
        subtotal: Number(it.subtotal),
      })),
    };

    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error("Error obteniendo ticket de venta:", error);
    return { success: false, error: "Error al cargar detalle del ticket" };
  }
}
