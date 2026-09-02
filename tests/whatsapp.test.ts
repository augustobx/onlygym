import { describe, expect, it } from "vitest";
import {
  buildMemberTemporaryPasswordMessage,
  buildMemberWelcomeMessage,
  buildMembershipReminderMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
} from "../src/lib/whatsapp";

describe("WhatsApp helpers", () => {
  it("normaliza un móvil argentino local de 10 dígitos", () => {
    expect(normalizeWhatsAppPhone("11 2345-6789")).toBe("5491123456789");
  });

  it("conserva un número argentino ya internacional", () => {
    expect(normalizeWhatsAppPhone("+54 9 11 2345-6789")).toBe("5491123456789");
  });

  it("arma el mensaje de bienvenida con las credenciales temporales", () => {
    const message = buildMemberWelcomeMessage({
      name: "Juan Pérez",
      document: "12345678",
      temporaryPassword: "Temporal9!",
      portalUrl: "https://toti.nanoapps.ar/portal/login",
    });

    expect(message).toContain("Juan Pérez");
    expect(message).toContain("12345678");
    expect(message).toContain("Temporal9!");
    expect(message).toContain("https://toti.nanoapps.ar/portal/login");
    expect(buildWhatsAppUrl("11 2345-6789", message)).toContain("https://wa.me/5491123456789?text=");
  });

  it("diferencia una clave regenerada de la bienvenida inicial", () => {
    const message = buildMemberTemporaryPasswordMessage({
      name: "Ana Gómez",
      document: "30111222",
      temporaryPassword: "Nueva9!",
      portalUrl: "https://toti.nanoapps.ar/portal/login",
    });

    expect(message).toContain("nueva contraseña temporal");
    expect(message).toContain("La contraseña anterior dejó de funcionar");
    expect(message).toContain("Nueva9!");
  });

  it("arma recordatorios de membresía sin mezclar credenciales", () => {
    const message = buildMembershipReminderMessage({
      name: "Ana",
      gymName: "Toti Gym",
      membershipName: "Mensual",
      expirationDate: "10/09/2026",
      expired: false,
    });
    expect(message).toContain("Toti Gym");
    expect(message).toContain("Mensual");
    expect(message).toContain("vence el 10/09/2026");
    expect(message).not.toContain("contraseña");
  });
});
