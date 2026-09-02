export type MemberWorkspace = "training" | "progress";

const paths: Record<MemberWorkspace, string> = {
  training: "/dashboard/entrenamiento",
  progress: "/dashboard/mediciones",
};

export function parseMemberWorkspaceId(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function memberWorkspaceHref(workspace: MemberWorkspace, memberId: number) {
  if (!Number.isSafeInteger(memberId) || memberId <= 0) throw new Error("Socio inválido");
  return `${paths[workspace]}?cliente=${memberId}`;
}
