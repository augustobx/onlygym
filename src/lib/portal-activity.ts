export function calendarDaySerial(value: Date, timeZone: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (![year, month, day].every(Number.isInteger)) return null;

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function calculateVisitStreak(
  visits: Array<Date | string>,
  now: Date = new Date(),
  timeZone = "America/Argentina/Buenos_Aires",
) {
  const today = calendarDaySerial(now, timeZone);
  if (today === null) return 0;

  const visitDays = new Set<number>();
  for (const visit of visits) {
    const date = visit instanceof Date ? visit : new Date(visit);
    const serial = calendarDaySerial(date, timeZone);
    if (serial !== null && serial <= today) visitDays.add(serial);
  }
  if (!visitDays.size) return 0;

  // Una racha sigue vigente si el socio entrenó hoy o ayer. Si dejó pasar
  // un día calendario completo, la racha vuelve a cero.
  let cursor = visitDays.has(today) ? today : visitDays.has(today - 1) ? today - 1 : null;
  if (cursor === null) return 0;

  let streak = 0;
  while (visitDays.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
