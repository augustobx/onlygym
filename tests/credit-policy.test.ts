import { describe, expect, it } from "vitest";
import { canChargeCurrentAccount, getAvailableCredit } from "../src/lib/credit-policy";

describe("current account credit policy", () => {
  it("calcula crédito disponible sin valores negativos", () => {
    expect(getAvailableCredit(1200, 5000)).toBe(3800);
    expect(getAvailableCredit(6000, 5000)).toBe(0);
  });

  it("no habilita crédito implícito cuando el límite es cero", () => {
    expect(canChargeCurrentAccount(0, 0, 100)).toBe(false);
  });

  it("acepta cargos dentro del límite", () => {
    expect(canChargeCurrentAccount(1000, 5000, 2500)).toBe(true);
    expect(canChargeCurrentAccount(1000, 5000, 4000)).toBe(true);
  });

  it("rechaza cargos que exceden el límite", () => {
    expect(canChargeCurrentAccount(1000, 5000, 4000.01)).toBe(false);
  });
});
