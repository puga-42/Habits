// Pure date helpers backing the optional "Ends" date on a habit (maps to the
// scheduled habit's `until` cap). Kept side-effect-free so it can be tested
// without mocks; the UI in `habit-form-fields.tsx` owns the picker wiring.

// Add whole months to a date, clamping to the last valid day when the target
// month is shorter (e.g. Jan 31 + 1 month → Feb 28). Does not mutate `date`.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

// The end date proposed when the user first switches "Ends" away from Never.
export function defaultEndDate(start: Date): Date {
  return addMonths(start, 1);
}

// Never let the chosen end fall before the start; snap to the start instead.
export function clampEndDate(start: Date, end: Date): Date {
  return end.getTime() < start.getTime()
    ? new Date(start.getTime())
    : new Date(end.getTime());
}
