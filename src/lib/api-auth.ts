import { NextResponse } from "next/server";

const DEFAULT_API_KEY = process.env.API_SECRET_KEY || "gymlink_secret_api_key_2026";

/**
 * Valida la cabecera Authorization: Bearer <API_KEY> o ?apiKey=<API_KEY>
 */
export function validateApiKey(req: Request): { valid: boolean; errorResponse?: Response } {
  const authHeader = req.headers.get("authorization");
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    // Permitir también por query param en caso de dispositivos IoT con microcontroladores básicos
    const url = new URL(req.url);
    token = url.searchParams.get("apiKey") || "";
  }

  if (!token || token !== DEFAULT_API_KEY) {
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
