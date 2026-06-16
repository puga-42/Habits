// Count-habit units. The behavioral unit (HabitUnit in habits.ts) is still just
// 'count' vs 'time' — this is the human-facing LABEL for a count goal/amount,
// e.g. "5 kilometers", "3 reps". The generic 'count' reads as "time(s)" to keep
// the app's original copy. Pure + TDD'd; see __tests__/units.test.ts.

export type CountUnit =
  | 'count'
  | 'steps'
  | 'reps'
  | 'pages'
  | 'meters'
  | 'kilometers'
  | 'miles';

// Selection list for the goal screen (key + display label), in order.
export const COUNT_UNITS: { key: CountUnit; label: string }[] = [
  { key: 'count', label: 'Count' },
  { key: 'steps', label: 'Steps' },
  { key: 'reps', label: 'Reps' },
  { key: 'pages', label: 'Pages' },
  { key: 'meters', label: 'Meters' },
  { key: 'kilometers', label: 'Kilometers' },
  { key: 'miles', label: 'Miles' },
];

const SINGULAR: Record<Exclude<CountUnit, 'count'>, string> = {
  steps: 'step',
  reps: 'rep',
  pages: 'page',
  meters: 'meter',
  kilometers: 'kilometer',
  miles: 'mile',
};

// The noun for a given count, pluralized: unitNoun('miles', 1) === 'mile'.
export function unitNoun(unit: CountUnit, n: number): string {
  if (unit === 'count') return n === 1 ? 'time' : 'times';
  return n === 1 ? SINGULAR[unit] : unit;
}

// "5 kilometers", "1 time".
export function describeAmount(n: number, unit: CountUnit): string {
  return `${n} ${unitNoun(unit, n)}`;
}

// Coerce a stored value (text column, possibly null/legacy) to a known unit.
export function normalizeCountUnit(value: string | null | undefined): CountUnit {
  return COUNT_UNITS.some((u) => u.key === value) ? (value as CountUnit) : 'count';
}
