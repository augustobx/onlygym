"use server";

import { prisma } from "@/lib/prisma";
import { requireMemberContext } from "@/lib/member-context";

export async function consultarEstadoCliente(documento: string) {
  try {
    const context = await requireMemberContext();
    const cliente = await prisma.cliente.findFirst({
      where: { id: context.clienteId, tenantId: context.tenantId, documento: documento.trim() },
      include: {
        pagos: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          include: {
            membresia: true
          }
        },
        sucursales: true
      }
    });

    if (!cliente) {
      return { success: false, error: "No se encontró ningún cliente con este DNI." };
    }

    const hoy = new Date();
    let estadoAcceso = "VENCIDO";
    let diasRestantes = 0;
    
    if (cliente.pagos.length > 0) {
      const vencimiento = new Date(cliente.pagos[0].fechaVencimiento);
      vencimiento.setHours(23, 59, 59, 999);
      
      if (vencimiento >= hoy) {
        estadoAcceso = "ACTIVO";
        const diffTime = Math.abs(vencimiento.getTime() - hoy.getTime());
        diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      success: true,
      data: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        estado: estadoAcceso,
        diasRestantes,
        ultimoPago: cliente.pagos[0] ? {
          fechaVencimiento: cliente.pagos[0].fechaVencimiento,
          membresia: cliente.pagos[0].membresia.nombre
        } : null,
        sucursales: cliente.sucursales.map(s => s.nombre)
      }
    };
  } catch (error) {
    return { success: false, error: "Error consultando el estado." };
  }
}
