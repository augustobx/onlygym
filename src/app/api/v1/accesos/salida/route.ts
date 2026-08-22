import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";

/**
 * POST /api/v1/accesos/salida
 * Endpoint para registrar la salida física del socio desde el torniquete de egreso
 * 
 * Body JSON:
 * {
 *   "documento": "38450123",
 *   "sucursalId": 1
 * }
 */
export async function POST(req: Request) {
  const auth = validateApiKey(req);
  if (!auth.valid) return auth.errorResponse!;

  try {
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: "Formato JSON inválido en el cuerpo de la petición", status: 400 },
        { status: 400 }
      );
    }

    const documento = body.documento ? String(body.documento).trim() : "";
    const sucursalId = body.sucursalId ? Number(body.sucursalId) : 1;

    if (!documento) {
      return NextResponse.json(
        { registrado: false, error: "Parámetro 'documento' requerido" },
        { status: 400 }
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ingresoAbierto = await prisma.ingreso.findFirst({
      where: {
        documento,
        sucursalId,
        fechaHora: { gte: hoy },
        horaSalida: null,
      },
      orderBy: { fechaHora: "desc" },
      include: { cliente: true },
    });

    if (!ingresoAbierto) {
      return NextResponse.json({
        registrado: false,
        error: "No se encontró un ingreso activo para este DNI en el día de hoy",
      });
    }

    const ahora = new Date();
    const duracionMinutos = Math.max(1, Math.floor((ahora.getTime() - ingresoAbierto.fechaHora.getTime()) / 60000));

    await prisma.ingreso.update({
      where: { id: ingresoAbierto.id },
      data: {
        horaSalida: ahora,
        duracionMinutos,
      },
    });

    return NextResponse.json({
      registrado: true,
      abrirRele: true,
      cliente: {
        nombre: ingresoAbierto.cliente.nombre,
        apellido: ingresoAbierto.cliente.apellido,
        documento: ingresoAbierto.cliente.documento,
      },
      duracionMinutos,
      horaEntrada: ingresoAbierto.fechaHora.toISOString(),
      horaSalida: ahora.toISOString(),
    });
  } catch (error) {
    console.error("Error en API registrar salida:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
