import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getAforoEnVivo } from "@/app/actions/horarios";

/**
 * GET /api/v1/aforo?sucursalId=1
 * Endpoint para pantallas LED externas, displays de aforo o dashboards IoT
 */
export async function GET(req: Request) {
  const auth = validateApiKey(req);
  if (!auth.valid) return auth.errorResponse!;

  try {
    const url = new URL(req.url);
    const sucursalId = Number(url.searchParams.get("sucursalId") || "1");

    const aforoRes = await getAforoEnVivo(sucursalId);
    if (!aforoRes.success || !aforoRes.data) {
      return NextResponse.json({ error: "Error calculando aforo" }, { status: 500 });
    }

    const { personasAdentro, capacidadMaxima, porcentaje, nivel, nivelTexto, duracionPromedio } = aforoRes.data;

    return NextResponse.json({
      sucursalId,
      personasAdentro,
      capacidadMaxima,
      porcentaje,
      nivel,
      nivelTexto,
      duracionPromedio,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en API aforo:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
