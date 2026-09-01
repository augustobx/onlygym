import { NextResponse } from "next/server";

/**
 * Valida la cabecera Authorization: Bearer <API_KEY>.
 * No se aceptan claves en query string para evitar filtrarlas en logs e historial.
 */
export function validateApiKey(req: Request): { valid: boolean; errorResponse?: Response } {
  const expectedKey = process.env.API_SECRET_KEY;
  if (!expectedKey) {
    return {
      valid: false,
      errorResponse: NextResponse.json(
        { error: "Integración de acceso no configurada", status: 503 },
        { status: 503 }
      ),
    };
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : "";

  if (!token || token !== expectedKey) {
    return {
      valid: false,
      errorResponse: NextResponse.json(
        {
          error: "No autorizado. Se requiere cabecera 'Authorization: Bearer <API_KEY>' válida.",
          status: 401,
        },
        { status: 401 }
      ),
    };
  }

  return { valid: true };
}
