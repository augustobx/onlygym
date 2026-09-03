export type MemberOperationRole = "OWNER" | "ADMIN" | "RECEPCION";

function uniquePositiveIds(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

export function assertActiveMemberBranch(activeBranchId: number | null | undefined, requestedBranchId?: number | null) {
  if (!activeBranchId) throw new Error("Seleccioná una sucursal antes de operar con socios");
  if (requestedBranchId && requestedBranchId !== activeBranchId) {
    throw new Error("La sucursal solicitada no coincide con la sede activa");
  }
  return activeBranchId;
}

export function resolveNewMemberBranches(
  role: MemberOperationRole,
  activeBranchId: number | null | undefined,
  requestedBranchIds: number[],
) {
  const active = assertActiveMemberBranch(activeBranchId);
  const requested = uniquePositiveIds(requestedBranchIds);

  if (role === "RECEPCION") {
    if (requested.some((branchId) => branchId !== active)) {
      throw new Error("Recepción sólo puede dar de alta socios en la sede activa");
    }
    return [active];
  }

  const selected = requested.length ? requested : [active];
  if (!selected.includes(active)) {
    throw new Error("La sede activa debe estar incluida en el alta del socio");
  }
  return selected;
}
