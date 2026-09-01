export type TrainingPhase = {
  orden: number;
  semanaInicio: number;
  semanaFin: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPlanWeek(fechaInicio: Date, now = new Date()) {
  const start = Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(1, Math.floor((today - start) / (7 * DAY_MS)) + 1);
}

export function getCurrentPhase<T extends TrainingPhase>(phases: T[], fechaInicio: Date, now = new Date()) {
  if (!phases.length) return null;
  const week = getPlanWeek(fechaInicio, now);
  const sorted = [...phases].sort((a, b) => a.orden - b.orden);
  return sorted.find((phase) => phase.semanaInicio <= week && phase.semanaFin >= week)
    ?? sorted.find((phase) => phase.semanaInicio > week)
    ?? sorted.at(-1)
    ?? null;
}

export function validateTrainingPhases(phases: TrainingPhase[], duracionSemanas: number) {
  if (!phases.length) return "El plan necesita al menos una fase";
  const sorted = [...phases].sort((a, b) => a.orden - b.orden);
  for (let index = 0; index < sorted.length; index += 1) {
    const phase = sorted[index];
    if (phase.orden !== index + 1) return "El orden de las fases debe ser consecutivo";
    if (phase.semanaInicio < 1 || phase.semanaFin < phase.semanaInicio || phase.semanaFin > duracionSemanas) {
      return `La fase ${phase.orden} tiene un rango de semanas inválido`;
    }
    if (index > 0 && phase.semanaInicio <= sorted[index - 1].semanaFin) {
      return "Las fases no pueden superponerse";
    }
  }
  return null;
}

export function getNextRoutineDay(daysCount: number | null | undefined, lastDay: number | null | undefined, completedCount = 0) {
  const days = Math.max(1, daysCount ?? 1);
  if (lastDay && lastDay >= 1 && lastDay <= days) return lastDay === days ? 1 : lastDay + 1;
  return (Math.max(0, completedCount) % days) + 1;
}
