export type ClassStaffRole = "OWNER" | "ADMIN" | "RECEPCION" | "ENTRENADOR";

type ClassAccessInput = {
  role: ClassStaffRole;
  activeBranchId: number | null;
  trainerProfileId?: number | null;
  classBranchId: number;
  classTrainerId?: number | null;
};

export function canOperateClass({
  role,
  activeBranchId,
  trainerProfileId,
  classBranchId,
  classTrainerId,
}: ClassAccessInput) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (!activeBranchId || classBranchId !== activeBranchId) return false;
  if (role === "RECEPCION") return true;
  return Boolean(trainerProfileId && classTrainerId === trainerProfileId);
}

export function canUseBranchForClass(role: ClassStaffRole, activeBranchId: number | null, branchId: number) {
  if (role === "OWNER" || role === "ADMIN") return true;
  return Boolean(activeBranchId && activeBranchId === branchId);
}

export function memberSharesClassBranch(classBranchId: number, memberBranchIds: number[]) {
  return memberBranchIds.includes(classBranchId);
}
