import { describe, expect, it } from "vitest";
import { memberWorkspaceHref, parseMemberWorkspaceId } from "@/lib/member-workspace";

describe("member workspace", () => {
  it("acepta ids positivos enteros", () => {
    expect(parseMemberWorkspaceId("42")).toBe(42);
    expect(parseMemberWorkspaceId(" 7 ")).toBe(7);
  });

  it("rechaza ids ambiguos o inválidos", () => {
    expect(parseMemberWorkspaceId(null)).toBeNull();
    expect(parseMemberWorkspaceId("0")).toBeNull();
    expect(parseMemberWorkspaceId("-1")).toBeNull();
    expect(parseMemberWorkspaceId("1.5")).toBeNull();
    expect(parseMemberWorkspaceId("12x")).toBeNull();
  });

  it("construye enlaces profundos de entrenamiento y progreso", () => {
    expect(memberWorkspaceHref("training", 9)).toBe("/dashboard/entrenamiento?cliente=9");
    expect(memberWorkspaceHref("progress", 9)).toBe("/dashboard/mediciones?cliente=9");
  });

  it("no construye enlaces con ids inválidos", () => {
    expect(() => memberWorkspaceHref("training", 0)).toThrow("Socio inválido");
  });
});
