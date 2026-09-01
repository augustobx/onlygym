import { describe, expect, it } from "vitest";
import { getBookingPlacement, normalizeWaitingPositions } from "../src/lib/class-booking-policy";

describe("cupos y lista de espera", () => {
  it("confirma mientras existe un lugar", () => {
    expect(getBookingPlacement(14, 15, 0)).toEqual({ estado: "confirmada", posicionEspera: null });
  });

  it("envía a espera cuando el cupo está completo", () => {
    expect(getBookingPlacement(15, 15, 3)).toEqual({ estado: "espera", posicionEspera: 4 });
  });

  it("normaliza posiciones después de una cancelación o promoción", () => {
    expect(normalizeWaitingPositions([{ id: 8 }, { id: 12 }, { id: 20 }])).toEqual([{ id: 8, posicionEspera: 1 }, { id: 12, posicionEspera: 2 }, { id: 20, posicionEspera: 3 }]);
  });

  it("rechaza estados de capacidad inválidos", () => {
    expect(() => getBookingPlacement(-1, 0, 0)).toThrow(/inválido/);
  });
});
