export type ConfigurationBranchCandidate = {
  id: number;
  estado: string;
};

export function selectConfigurationBranch<T extends ConfigurationBranchCandidate>(
  branches: T[],
  activeBranchId: number | null | undefined,
): T | null {
  if (!Array.isArray(branches) || branches.length === 0) return null;

  if (activeBranchId) {
    const active = branches.find((branch) => branch.id === activeBranchId && branch.estado === "activo");
    if (active) return active;
  }

  return branches.find((branch) => branch.estado === "activo") || null;
}
