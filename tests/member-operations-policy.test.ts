import { describe, expect, it } from "vitest";
import { assertActiveMemberBranch, resolveNewMemberBranches } from "../src/lib/member-operations-policy";

describe("member operations policy", () => {
  it("rechaza operar sin sede activa o con una sede distinta", () => {
    expect(() => assertActiveMemberBranch(null)).toThrow("Seleccioná una sucursal");
    expect(() => assertActiveMemberBranch(2, 3)).toThrow("no coincide con la sede activa");
    expect(assertActiveMemberBranch(2, 2)).toBe(2);
  });

  it("recepción queda limitada exclusivamente a la sede activa", () => {
    expect(resolveNewMemberBranches("RECEPCION", 4, [])).toEqual([4]);
    expect(resolveNewMemberBranches("RECEPCION", 4, [4])).toEqual([4]);
    expect(() => resolveNewMemberBranches("RECEPCION", 4, [4, 5])).toThrow("sólo puede dar de alta socios en la sede activa");
  });

  it("owner y admin pueden sumar sedes pero deben incluir la activa", () => {
    expect(resolveNewMemberBranches("OWNER", 2, [])).toEqual([2]);
    expect(resolveNewMemberBranches("ADMIN", 2, [2, 3, 3])).toEqual([2, 3]);
    expect(() => resolveNewMemberBranches("OWNER", 2, [3])).toThrow("sede activa debe estar incluida");
  });
});
