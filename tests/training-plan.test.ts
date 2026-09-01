import { describe, expect, it } from "vitest";
import { getCurrentPhase, getNextRoutineDay, getPlanWeek, validateTrainingPhases } from "../src/lib/training-plan";

const phases = [
  { orden: 1, semanaInicio: 1, semanaFin: 4, rutinaId: 10 },
  { orden: 2, semanaInicio: 5, semanaFin: 8, rutinaId: 20 },
  { orden: 3, semanaInicio: 9, semanaFin: 12, rutinaId: 30 },
];

describe("progresión automática de planes", () => {
  it("calcula la semana desde la fecha de inicio", () => {
    expect(getPlanWeek(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-29T00:00:00Z"))).toBe(5);
  });

  it("selecciona la rutina de la fase vigente", () => {
    expect(getCurrentPhase(phases, new Date("2026-01-01T00:00:00Z"), new Date("2026-02-05T00:00:00Z"))?.rutinaId).toBe(20);
  });

  it("mantiene la última fase cuando el plan supera su duración", () => {
    expect(getCurrentPhase(phases, new Date("2026-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z"))?.rutinaId).toBe(30);
  });

  it("rechaza fases superpuestas o fuera del plan", () => {
    expect(validateTrainingPhases(phases, 12)).toBeNull();
    expect(validateTrainingPhases([{ orden: 1, semanaInicio: 1, semanaFin: 6 }, { orden: 2, semanaInicio: 6, semanaFin: 12 }], 12)).toMatch(/superponerse/);
    expect(validateTrainingPhases([{ orden: 1, semanaInicio: 1, semanaFin: 13 }], 12)).toMatch(/inválido/);
  });

  it("avanza los días de una rutina y vuelve al primero", () => {
    expect(getNextRoutineDay(3, null, 0)).toBe(1);
    expect(getNextRoutineDay(3, 1, 1)).toBe(2);
    expect(getNextRoutineDay(3, 3, 3)).toBe(1);
    expect(getNextRoutineDay(2, null, 3)).toBe(2);
  });
});
