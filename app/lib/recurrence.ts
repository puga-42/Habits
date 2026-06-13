// Recurrence patterns and RRULE compilation.
// We compile a constrained set of UX-friendly patterns to RFC 5545 RRULE
// strings, then store those strings on the habit. The full RRULE space stays
// available for power-users via a future "custom" mode.

export type Pattern =
  | 'oneoff'
  | 'daily'
  | 'weekday'
  | 'weekly'
  | 'interval'
  | 'monthly'
  | 'monthlyDays';

export type WeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

export const WEEKDAYS: WeekDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const WEEKDAY_LABELS: Record<WeekDay, string> = {
  SU: 'S',
  MO: 'M',
  TU: 'T',
  WE: 'W',
  TH: 'T',
  FR: 'F',
  SA: 'S',
};

const DAY_FULL: Record<WeekDay, string> = {
  SU: 'Sun',
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
};

export type RecurrenceState = {
  pattern: Pattern;
  byDays: WeekDay[]; // used for 'weekly'
  interval: number;  // used for 'interval'
  byMonthDays?: number[]; // used for 'monthlyDays' (calendar days 1–31)
};

// 1 → "1st", 2 → "2nd", 21 → "21st", 11 → "11th".
function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

function sortedMonthDays(state: RecurrenceState): number[] {
  return [...(state.byMonthDays ?? [])].sort((a, b) => a - b);
}

export function buildRrule(state: RecurrenceState): string {
  switch (state.pattern) {
    case 'oneoff':
      // A single occurrence on dtstart. rrule.js expands COUNT=1 to just that
      // one date, which is exactly what we want for non-recurring habits.
      return 'FREQ=DAILY;COUNT=1';
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekday':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekly': {
      const days = state.byDays.length > 0 ? state.byDays.join(',') : 'MO';
      return `FREQ=WEEKLY;BYDAY=${days}`;
    }
    case 'interval':
      return `FREQ=DAILY;INTERVAL=${Math.max(1, state.interval)}`;
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'monthlyDays': {
      const days = sortedMonthDays(state);
      return `FREQ=MONTHLY;BYMONTHDAY=${days.length > 0 ? days.join(',') : '1'}`;
    }
  }
}

export function describeRrule(state: RecurrenceState): string {
  switch (state.pattern) {
    case 'oneoff':
      return "Doesn't repeat";
    case 'daily':
      return 'Every day';
    case 'weekday':
      return 'Every weekday';
    case 'weekly': {
      if (state.byDays.length === 0) return 'Weekly';
      if (state.byDays.length === 7) return 'Every day';
      const names = state.byDays.map((d) => DAY_FULL[d]);
      return `Every ${names.join(', ')}`;
    }
    case 'interval': {
      const n = Math.max(1, state.interval);
      return n === 1 ? 'Every day' : `Every ${n} days`;
    }
    case 'monthly':
      return 'Monthly';
    case 'monthlyDays': {
      const days = sortedMonthDays(state);
      if (days.length === 0) return 'Monthly';
      return `Monthly on the ${days.map(ordinal).join(', ')}`;
    }
  }
}

// Parse a stored RRULE back to a state for editing. Supports our presets.
// Anything outside the preset shape falls back to daily.
export function parseRrule(rrule: string): RecurrenceState {
  if (rrule === 'FREQ=DAILY;COUNT=1')
    return { pattern: 'oneoff', byDays: [], interval: 1 };

  if (!rrule || rrule === 'FREQ=DAILY')
    return { pattern: 'daily', byDays: [], interval: 1 };

  if (rrule === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    return {
      pattern: 'weekday',
      byDays: ['MO', 'TU', 'WE', 'TH', 'FR'],
      interval: 1,
    };

  if (rrule.startsWith('FREQ=WEEKLY;BYDAY=')) {
    const days = rrule
      .slice('FREQ=WEEKLY;BYDAY='.length)
      .split(',')
      .filter((d): d is WeekDay => WEEKDAYS.includes(d as WeekDay));
    return { pattern: 'weekly', byDays: days, interval: 1 };
  }

  if (rrule.startsWith('FREQ=DAILY;INTERVAL=')) {
    const n = parseInt(rrule.slice('FREQ=DAILY;INTERVAL='.length), 10);
    return { pattern: 'interval', byDays: [], interval: isNaN(n) ? 2 : n };
  }

  if (rrule.startsWith('FREQ=MONTHLY;BYMONTHDAY=')) {
    const days = rrule
      .slice('FREQ=MONTHLY;BYMONTHDAY='.length)
      .split(',')
      .map((d) => parseInt(d, 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 31);
    return { pattern: 'monthlyDays', byDays: [], interval: 1, byMonthDays: days };
  }

  if (rrule === 'FREQ=MONTHLY')
    return { pattern: 'monthly', byDays: [], interval: 1 };

  return { pattern: 'daily', byDays: [], interval: 1 };
}
