import { describe, expect, it } from "vitest";
import { selectConfigurationBranch } from "../src/lib/configuration-branch-policy";

describe("configuration branch selection", () => {
  const branches = [
    { id: 1, estado: "inactivo", nombre: "Vieja" },
    { id: 2, estado: "activo", nombre: "Centro" },
    { id: 3, estado: "activo", nombre: "Norte" },
  ];

  it("prefers the active server branch when it is available", () => {
    expect(selectConfigurationBranch(branches, 3)?.id).toBe(3);
  });

  it("falls back to the first active branch, never to id 1", () => {
    expect(selectConfigurationBranch(branches, 999)?.id).toBe(2);
  });

  it("does not select an inactive server branch", () => {
    expect(selectConfigurationBranch(branches, 1)?.id).toBe(2);
  });

  it("returns null when there is no active branch", () => {
    expect(selectConfigurationBranch([{ id: 9, estado: "inactivo" }], null)).toBeNull();
  });
});
