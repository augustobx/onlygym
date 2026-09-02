import { describe, expect, it } from "vitest";
import { resolveDashboardArea } from "../src/lib/dashboard-navigation";

describe("dashboard navigation", () => {
  it("mantiene ficha, cobros y cuentas dentro del área socios", () => {
    expect(resolveDashboardArea("/dashboard/clientes")).toBe("socios");
    expect(resolveDashboardArea("/dashboard/clientes/42")).toBe("socios");
    expect(resolveDashboardArea("/dashboard/pagos")).toBe("socios");
    expect(resolveDashboardArea("/dashboard/cuentas")).toBe("socios");
  });

  it("agrupa planificación, clases y progreso como entrenamiento", () => {
    expect(resolveDashboardArea("/dashboard/entrenamiento")).toBe("entrenamiento");
    expect(resolveDashboardArea("/dashboard/clases")).toBe("entrenamiento");
    expect(resolveDashboardArea("/dashboard/mediciones")).toBe("entrenamiento");
  });

  it("agrupa caja, arqueo, productos y aforo como operación", () => {
    expect(resolveDashboardArea("/dashboard/caja")).toBe("operacion");
    expect(resolveDashboardArea("/dashboard/caja/movimientos")).toBe("operacion");
    expect(resolveDashboardArea("/dashboard/productos")).toBe("operacion");
    expect(resolveDashboardArea("/dashboard/aforo")).toBe("operacion");
  });

  it("mantiene el panel personal del entrenador separado", () => {
    expect(resolveDashboardArea("/dashboard/entrenador")).toBe("entrenador");
    expect(resolveDashboardArea("/dashboard/entrenador/socios/10")).toBe("entrenador");
  });
});
