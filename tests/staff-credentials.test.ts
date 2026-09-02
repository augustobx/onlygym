import { describe, expect, it } from "vitest";
import { buildTrainerCredentialMessage } from "../src/lib/staff-credentials";

describe("trainer credential messages", () => {
  it("incluye usuario, email, clave temporal y URL", () => {
    const message = buildTrainerCredentialMessage({
      name: "Juan Pérez",
      username: "juan.perez",
      email: "juan@example.com",
      password: "Temp9!",
      loginUrl: "https://toti.nanoapps.ar/login",
    });

    expect(message).toContain("Juan Pérez");
    expect(message).toContain("Usuario: juan.perez");
    expect(message).toContain("Email: juan@example.com");
    expect(message).toContain("Clave temporal: Temp9!");
    expect(message).toContain("https://toti.nanoapps.ar/login");
  });

  it("usa el email como usuario cuando no hay username", () => {
    const message = buildTrainerCredentialMessage({
      name: "Ana",
      username: null,
      email: "ana@example.com",
      password: "Temp9!",
      loginUrl: "https://test.nanoapps.ar/login",
    });

    expect(message).toContain("Usuario: ana@example.com");
  });
});
