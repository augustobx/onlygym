import QRCode from "qrcode";
import { requireMemberContext } from "@/lib/member-context";
import { createMemberAccessToken } from "@/lib/member-access-token";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireMemberContext();
    const token = createMemberAccessToken({ tenantId: context.tenantId, clienteId: context.clienteId });
    const svg = await QRCode.toString(token, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360,
      color: { dark: "#080b10", light: "#ffffff" },
    });

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store, private, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No autorizado", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
