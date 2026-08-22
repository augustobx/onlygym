"use server";

import { prisma } from "@/lib/prisma";
import { clienteSchema, ClienteData } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";

/**
 * Obtiene clientes de forma básica
 */
export async function getClientes() {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { fechaRegistro: "desc" },
    });
    return { success: true, data: serializeData(clientes) };
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return { success: false, error: "No se pudieron obtener los clientes" };
  }
}

/**
 * Obtiene clientes con paginación, filtros avanzados y estado de membresía en tiempo real
 */
export async function getClientesPaginados(params: {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string; // 'todos', 'activo', 'inactivo', 'al_dia', 'vencido', 'vencen_pronto'
  sucursalId?: number;
}) {
  try {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(5, params.limit || 15));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filtro por sucursal
    if (params.sucursalId) {
      where.sucursales = {
        some: { id: params.sucursalId },
      };
    }

    // Filtro de búsqueda por texto
    if (params.search && params.search.trim() !== "") {
      const q = params.search.trim();
      where.OR = [
        { documento: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
        { apellido: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
      ];
    }

    const hoy = new Date();
    const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const en7Dias = new Date(hoyInicio.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Filtros de estado
    if (params.estado === "activo") {
      where.estado = "activo";
    } else if (params.estado === "inactivo") {
      where.estado = "inactivo";
    }

    const [total, clientesDb] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        include: {
          pagos: {
            orderBy: { fechaVencimiento: "desc" },
            take: 1,
            include: { membresia: true },
          },
          cuentaCorriente: true,
        },
        orderBy: { nombre: "asc" },
        skip,
        take: limit,
      }),
    ]);

    // Mapear y calcular estados
    let items = clientesDb.map((c) => {
      const ultimoPago = c.pagos?.[0];
      let estadoMembresia: "AL_DIA" | "VENCIDO" = "VENCIDO";
      let diasRestantes = 0;
      let vencimientoDate: Date | null = null;
      let vencenPronto = false;

      if (ultimoPago) {
        vencimientoDate = new Date(ultimoPago.fechaVencimiento);
        vencimientoDate.setHours(23, 59, 59, 999);

        if (vencimientoDate >= hoy) {
          estadoMembresia = "AL_DIA";
          const diff = vencimientoDate.getTime() - hoy.getTime();
          diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
          if (diasRestantes <= 7) {
            vencenPronto = true;
          }
        }
      }

      return {
        id: c.id,
        documento: c.documento,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
        foto: c.foto,
        estado: c.estado,
        fechaRegistro: c.fechaRegistro,
        estadoMembresia,
        diasRestantes,
        vencenPronto,
        ultimoPlan: ultimoPago ? ultimoPago.membresia.nombre : "Sin plan",
        fechaVencimiento: vencimientoDate ? vencimientoDate.toISOString() : null,
        saldoCuenta: c.cuentaCorriente ? Number(c.cuentaCorriente.saldo) : 0,
        limiteCredito: c.cuentaCorriente ? Number(c.cuentaCorriente.limiteCredito) : 0,
      };
    });

    // Filtros de estado de membresía post-query si se solicitan
    if (params.estado === "al_dia") {
      items = items.filter((i) => i.estadoMembresia === "AL_DIA");
    } else if (params.estado === "vencido") {
      items = items.filter((i) => i.estadoMembresia === "VENCIDO");
    } else if (params.estado === "vencen_pronto") {
      items = items.filter((i) => i.vencenPronto || i.estadoMembresia === "VENCIDO");
    }

    return {
      success: true,
      data: serializeData({
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      }),
    };
  } catch (error) {
    console.error("Error al obtener clientes paginados:", error);
    return { success: false, error: "Error al cargar los clientes" };
  }
}

/**
 * Crea un socio nuevo con creación 3-en-1 (Cliente, UsuarioCliente DNI/123456 y CuentaCorriente $0)
 */
export async function createCliente(data: ClienteData & { sucursalesIds?: number[] }) {
  const result = clienteSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => e.message).join(", "),
    };
  }

  try {
    const cleanDoc = result.data.documento.trim();

    const clienteCreado = await prisma.$transaction(async (tx) => {
      // 1. Crear el Cliente
      const cliente = await tx.cliente.create({
        data: {
          documento: cleanDoc,
          nombre: result.data.nombre.trim(),
          apellido: result.data.apellido.trim(),
          telefono: result.data.telefono?.trim() || null,
          email: result.data.email?.trim() || null,
          direccion: result.data.direccion?.trim() || null,
          foto: result.data.foto || null,
          estado: result.data.estado || "activo",
          sucursales: data.sucursalesIds && data.sucursalesIds.length > 0
            ? { connect: data.sucursalesIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      // 2. Crear automáticamente las credenciales del portal (DNI / 123456)
      await tx.usuarioCliente.create({
        data: {
          clienteId: cliente.id,
          usuario: cleanDoc,
          password: "123456",
          debeCambiarPassword: true,
        },
      });

      // 3. Crear automáticamente su Cuenta Corriente con $0 y límite $5000
      await tx.cuentaCorriente.create({
        data: {
          clienteId: cliente.id,
          saldo: 0,
          limiteCredito: 5000,
        },
      });

      return cliente;
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath("/dashboard/cuentas");
    revalidatePath("/dashboard/caja");
    revalidatePath("/molinete");

    return { success: true, data: serializeData(clienteCreado) };
  } catch (error: any) {
    console.error("Error al crear cliente:", error);
    if (error.code === "P2002") {
      return { success: false, error: "Ya existe un cliente con ese número de documento" };
    }
    return { success: false, error: "Error interno al crear el cliente" };
  }
}

/**
 * Actualiza los datos y/o foto de un socio
 */
export async function updateCliente(id: number, data: Partial<ClienteData>) {
  try {
    const updated = await prisma.cliente.update({
      where: { id },
      data,
    });
    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${id}`);
    revalidatePath("/molinete");
    return { success: true, data: serializeData(updated) };
  } catch (error) {
    console.error("Error actualizando cliente:", error);
    return { success: false, error: "Error al actualizar los datos del cliente" };
  }
}

/**
 * Obtiene la ficha 360 completa de un socio
 */
export async function getCliente(id: number) {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        pagos: {
          include: { membresia: true },
          orderBy: { fechaPago: "desc" },
          take: 30,
        },
        ingresos: {
          orderBy: { fechaHora: "desc" },
          take: 30,
        },
        cuentaCorriente: {
          include: {
            movimientos: {
              orderBy: { fecha: "desc" },
              take: 30,
            },
          },
        },
        sucursales: true,
        usuarioCliente: true,
      },
    });

    if (!cliente) return { success: false, error: "Cliente no encontrado" };

    return { success: true, data: serializeData(cliente) };
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    return { success: false, error: "No se pudo obtener el cliente" };
  }
}

/**
 * RENOVAR O CARGAR MEMBRESÍA 360 DIRECTAMENTE DESDE LA FICHA DEL CLIENTE
 */
export async function renovarMembresiaCliente360(data: {
  clienteId: number;
  membresiaId: number;
  sucursalId?: number;
  metodoPago?: string; // 'efectivo', 'tarjeta', 'transferencia', 'cuenta_corriente'
  monto?: number;
  notas?: string;
  extenderDesdeVencimiento?: boolean;
}) {
  try {
    const { clienteId, membresiaId, sucursalId = 1, metodoPago = "efectivo", notas, extenderDesdeVencimiento = true } = data;

    const [cliente, membresia] = await Promise.all([
      prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          pagos: {
            orderBy: { fechaVencimiento: "desc" },
            take: 1,
          },
          cuentaCorriente: true,
        },
      }),
      prisma.membresia.findUnique({
        where: { id: membresiaId },
      }),
    ]);

    if (!cliente) return { success: false, error: "Socio no encontrado" };
    if (!membresia) return { success: false, error: "Plan de membresía no encontrado" };

    const montoFinal = data.monto !== undefined ? data.monto : Number(membresia.precio);
    const hoy = new Date();

    // Calcular fecha de vencimiento:
    // Si extenderDesdeVencimiento es true y el último vencimiento es futuro, sumar días desde esa fecha; sino desde hoy.
    let baseDate = new Date();
    const ultimoPago = cliente.pagos?.[0];
    if (extenderDesdeVencimiento && ultimoPago) {
      const ultVenc = new Date(ultimoPago.fechaVencimiento);
      if (ultVenc > hoy) {
        baseDate = new Date(ultVenc);
      }
    }

    const fechaVencimiento = new Date(baseDate.getTime() + membresia.diasDuracion * 24 * 60 * 60 * 1000);

    const pagoRegistrado = await prisma.$transaction(async (tx) => {
      // 1. Crear el pago
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId,
          membresiaId,
          sucursalId,
          fechaPago: new Date(),
          fechaVencimiento,
          monto: montoFinal,
          metodoPago,
          estado: "pagado",
          notas: notas || `Renovación 360 Plan ${membresia.nombre}`,
        },
        include: {
          membresia: true,
          cliente: true,
        },
      });

      // 2. Si el método de pago es a Cuenta Corriente, sumar el cargo a la deuda
      if (metodoPago === "cuenta_corriente") {
        let cuenta = cliente.cuentaCorriente;
        if (!cuenta) {
          cuenta = await tx.cuentaCorriente.create({
            data: { clienteId, saldo: 0, limiteCredito: 5000 },
          });
        }

        await tx.cuentaCorriente.update({
          where: { id: cuenta.id },
          data: {
            saldo: {
              increment: montoFinal,
            },
          },
        });

        await tx.cuentaMovimiento.create({
          data: {
            cuentaId: cuenta.id,
            tipo: "cargo",
            monto: montoFinal,
            concepto: `Cuota Membresía: ${membresia.nombre}`,
          },
        });
      }

      return nuevoPago;
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${clienteId}`);
    revalidatePath("/dashboard/pagos");
    revalidatePath("/dashboard/cuentas");
    revalidatePath("/dashboard/caja");
    revalidatePath("/molinete");
    revalidatePath("/portal/dashboard");

    return {
      success: true,
      mensaje: `¡Membresía ${membresia.nombre} renovada con éxito hasta el ${fechaVencimiento.toLocaleDateString("es-AR")}!`,
      data: serializeData(pagoRegistrado),
    };
  } catch (error) {
    console.error("Error al renovar membresía 360:", error);
    return { success: false, error: "Error al registrar la renovación de la membresía" };
  }
}

/**
 * Resetea la contraseña del portal de un socio a '123456'
 */
export async function resetPasswordCliente(clienteId: number) {
  try {
    const auth = await prisma.usuarioCliente.findUnique({
      where: { clienteId },
    });

    if (!auth) {
      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) return { success: false, error: "Cliente no encontrado" };

      await prisma.usuarioCliente.create({
        data: {
          clienteId,
          usuario: cliente.documento.trim(),
          password: "123456",
          debeCambiarPassword: true,
        },
      });
    } else {
      await prisma.usuarioCliente.update({
        where: { clienteId },
        data: {
          password: "123456",
          debeCambiarPassword: true,
        },
      });
    }

    return { success: true, mensaje: "Contraseña reseteada exitosamente a '123456'" };
  } catch (error) {
    console.error("Error reseteando contraseña:", error);
    return { success: false, error: "Error al resetear contraseña" };
  }
}

/**
 * Activa o desactiva un socio
 */
export async function toggleClienteEstado(id: number, estadoActual: string) {
  try {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    await prisma.cliente.update({
      where: { id },
      data: { estado: nuevoEstado },
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath("/molinete");
    return { success: true, nuevoEstado };
  } catch (error) {
    console.error("Error cambiando estado cliente:", error);
    return { success: false, error: "Error cambiando estado" };
  }
}

/**
 * Exporta todos los clientes para descarga en CSV
 */
export async function exportarClientesData(sucursalId?: number) {
  try {
    const where: any = {};
    if (sucursalId) {
      where.sucursales = { some: { id: sucursalId } };
    }

    const clientes = await prisma.cliente.findMany({
      where,
      include: {
        pagos: {
          orderBy: { fechaVencimiento: "desc" },
          take: 1,
          include: { membresia: true },
        },
        cuentaCorriente: true,
      },
      orderBy: { nombre: "asc" },
    });

    const hoy = new Date();

    return {
      success: true,
      data: clientes.map((c) => {
        const ultimoPago = c.pagos?.[0];
        const tienePagoActivo = ultimoPago && new Date(ultimoPago.fechaVencimiento) >= hoy;

        return {
          documento: c.documento,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono || "",
          email: c.email || "",
          direccion: c.direccion || "",
          estado: c.estado,
          estadoMembresia: tienePagoActivo ? "Al Día" : "Vencido",
          ultimoPlan: ultimoPago ? ultimoPago.membresia.nombre : "Sin plan",
          vencimiento: ultimoPago ? new Date(ultimoPago.fechaVencimiento).toLocaleDateString("es-AR") : "—",
          saldoDeuda: c.cuentaCorriente ? Number(c.cuentaCorriente.saldo) : 0,
          fechaRegistro: new Date(c.fechaRegistro).toLocaleDateString("es-AR"),
        };
      }),
    };
  } catch (error) {
    console.error("Error exportando clientes:", error);
    return { success: false, error: "Error exportando clientes" };
  }
}
