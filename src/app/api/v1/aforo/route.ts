import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = validateApiKey(req);
  if (!auth.valid) return auth.errorResponse!;
  try {
    const sucursalId = Number(new URL(req.url).searchParams.get("sucursalId"));
    if (!Number.isInteger(sucursalId) || sucursalId < 1) return NextResponse.json({ error: "sucursalId inválido" }, { status: 400 });
    const branch = await prisma.sucursal.findFirst({ where: { id: sucursalId, estado: "activo", tenant: { estado: "activo" } }, include: { horarios: { where: { activo: true }, take: 1 } } });
    if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [peopleInside, completed] = await Promise.all([
      prisma.ingreso.count({ where: { tenantId: branch.tenantId, sucursalId: branch.id, fechaHora: { gte: today }, horaSalida: null, estado: { in: ["permitido", "ACTIVO"] } } }),
      prisma.ingreso.findMany({ where: { tenantId: branch.tenantId, sucursalId: branch.id, fechaHora: { gte: today }, duracionMinutos: { not: null } }, select: { duracionMinutos: true } }),
    ]);
    const capacity = branch.capacidad ?? branch.horarios[0]?.capacidadMaxima ?? 50;
    const percentage = capacity > 0 ? Math.round((peopleInside / capacity) * 100) : 0;
    const averageDuration = completed.length ? Math.round(completed.reduce((sum, row) => sum + (row.duracionMinutos || 0), 0) / completed.length) : 0;
    return NextResponse.json({ sucursalId: branch.id, personasAdentro: peopleInside, capacidadMaxima: capacity, porcentaje: percentage, nivel: percentage >= 90 ? "alto" : percentage >= 60 ? "medio" : "bajo", nivelTexto: percentage >= 90 ? "Casi completo" : percentage >= 60 ? "Concurrido" : "Disponible", duracionPromedio: averageDuration, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error en API aforo:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
