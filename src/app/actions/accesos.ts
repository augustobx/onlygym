"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verificarHorarioAtencion } from "@/app/actions/horarios";

export async function registrarIngresoMolinete(documento: string, sucursalId: number) {
  try {
    // Buscar cliente por documento
    const cliente = await prisma.cliente.findUnique({
      where: { documento: documento.trim() },
      include: {
        pagos: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1
        }
      }
    });

    if (!cliente) {
      return { success: false, estado: "NO_ENCONTRADO", error: "El DNI ingresado no existe en el sistema." };
    }

    if (cliente.estado !== "activo") {
      return { success: false, estado: "INACTIVO", error: "El cliente está inactivo o bloqueado." };
    }

    // Verificar horario de atención del gimnasio
    const horario = await verificarHorarioAtencion(sucursalId);
    if (!horario.permitido) {
      await prisma.ingreso.create({
        data: {
          clienteId: cliente.id,
          sucursalId,
          documento: cliente.documento,
          estado: "DENEGADO",
          motivo: horario.motivo || "Fuera de horario de atención",
        }
      });
      return {
        success: false,
        estado: "DENEGADO",
        error: horario.motivo || "Gimnasio fuera de horario de atención",
        cliente: {
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          documento: cliente.documento,
          foto: cliente.foto
        }
      };
    }

    // Verificar estado de pagos
    const hoy = new Date();
    let estadoAcceso = "VENCIDO";
    let mensaje = "No tiene membresías activas.";
    let diasVencido: number | null = null;
    
    if (cliente.pagos.length > 0) {
      const vencimiento = new Date(cliente.pagos[0].fechaVencimiento);
      vencimiento.setHours(23, 59, 59, 999);
      
      if (vencimiento >= hoy) {
        estadoAcceso = "ACTIVO";
        mensaje = `Acceso permitido. Vence el ${vencimiento.toLocaleDateString("es-AR")}`;
      } else {
        const diffMs = hoy.getTime() - vencimiento.getTime();
        diasVencido = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        mensaje = `Membresía vencida hace ${diasVencido} día(s) (${vencimiento.toLocaleDateString("es-AR")})`;
      }
    }

    // Registrar en BD
    const ingreso = await prisma.ingreso.create({
      data: {
        clienteId: cliente.id,
        sucursalId: sucursalId,
        documento: cliente.documento,
        estado: estadoAcceso,
        motivo: estadoAcceso === "ACTIVO" ? "Ingreso regular" : mensaje,
        diasVencido: diasVencido
      }
    });

    // Devolvemos el resultado a la pantalla gigante
    return {
      success: true,
      estado: estadoAcceso,
      mensaje: mensaje,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        documento: cliente.documento,
        foto: cliente.foto
      },
      ingresoId: ingreso.id
    };

  } catch (error) {
    console.error(error);
    return { success: false, error: "Error de servidor al registrar ingreso." };
  }
}

export async function getUltimosIngresos(sucursalId: number) {
  try {
    const ingresos = await prisma.ingreso.findMany({
      where: { sucursalId },
      orderBy: { fechaHora: 'desc' },
      take: 8,
      include: {
        cliente: {
          select: { nombre: true, apellido: true }
        }
      }
    });
    return { success: true, data: ingresos };
  } catch (error) {
    return { success: false, error: "Error al cargar historial" };
  }
}
