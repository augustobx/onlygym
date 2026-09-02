import { describe, expect, it } from "vitest";
import { canOperateClass, canUseBranchForClass, memberSharesClassBranch } from "../src/lib/class-operations-policy";

describe("class operations policy", () => {
  it("owner y admin pueden operar clases del tenant sin depender de la sede activa", () => {
    expect(canOperateClass({ role: "OWNER", activeBranchId: null, classBranchId: 9 })).toBe(true);
    expect(canOperateClass({ role: "ADMIN", activeBranchId: 1, classBranchId: 9 })).toBe(true);
  });

  it("recepción sólo puede operar la sede activa", () => {
    expect(canOperateClass({ role: "RECEPCION", activeBranchId: 2, classBranchId: 2 })).toBe(true);
    expect(canOperateClass({ role: "RECEPCION", activeBranchId: 2, classBranchId: 3 })).toBe(false);
    expect(canUseBranchForClass("RECEPCION", null, 2)).toBe(false);
  });

  it("entrenador necesita sede activa y ser el profesor de la clase", () => {
    expect(canOperateClass({ role: "ENTRENADOR", activeBranchId: 2, trainerProfileId: 7, classBranchId: 2, classTrainerId: 7 })).toBe(true);
    expect(canOperateClass({ role: "ENTRENADOR", activeBranchId: 2, trainerProfileId: 7, classBranchId: 2, classTrainerId: 8 })).toBe(false);
    expect(canOperateClass({ role: "ENTRENADOR", activeBranchId: 2, trainerProfileId: 7, classBranchId: 3, classTrainerId: 7 })).toBe(false);
  });

  it("una inscripción requiere que el socio comparta la sede de la clase", () => {
    expect(memberSharesClassBranch(3, [1, 3, 4])).toBe(true);
    expect(memberSharesClassBranch(3, [1, 4])).toBe(false);
  });
});
