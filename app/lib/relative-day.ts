// Relative day naming for the calendar header: "Today" / "Yesterday" /
// "Tomorrow" when the anchored day is one of those, null otherwise (the
// caller falls back to a formatted date). Pure ISO string math via the
// UTC-noon trick (mirrors group-mutations.dayBefore) to dodge DST edges.

export function relativeDayName(
  anchorIso: string,
  todayIso: string,
): 'Today' | 'Yesterday' | 'Tomorrow' | null {
  if (anchorIso === todayIso) return 'Today';
  if (anchorIso === shiftDay(todayIso, -1)) return 'Yesterday';
  if (anchorIso === shiftDay(todayIso, 1)) return 'Tomorrow';
  return null;
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}
