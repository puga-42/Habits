import { rrulestr } from 'rrule';

// rrule.js evaluates BYDAY / BYMONTHDAY against a Date's UTC fields and ignores
// the local timezone. Expanding a "Monday" habit with a dtstart stored as a
// local-midnight instant therefore shifts the occurrence by a day for every
// user east of UTC (their local midnight is the previous UTC day). See
// CONTEXT.md § Recurrence.
//
// The fix here is a "fake-UTC" frame: we pin both the schedule anchor and the
// query window to UTC-midnight of their *nominal calendar day*, then read
// occurrences back by their UTC date. The nominal day of a stored instant is
// resolved in the habit's own timezone, so it is correct whether dtstart was
// written by the old (local-instant) or new (fake-UTC) format.

// The calendar date (YYYY-MM-DD) an instant falls on in a given IANA zone.
// `en-CA` formats as YYYY-MM-DD. Falls back to the runtime zone when tz is
// absent or unsupported by the JS engine.
export function dateInTimeZone(iso: string, tz?: string | null): string {
  const d = new Date(iso);
  try {
    return d.toLocaleDateString('en-CA', { timeZone: tz || undefined });
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

function dayStartUtc(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000Z`);
}

function dayEndUtc(dateIso: string): Date {
  return new Date(`${dateIso}T23:59:59.999Z`);
}

// Occurrence calendar dates (YYYY-MM-DD) of a scheduled habit within the
// inclusive [fromDateIso, toDateIso] window. `untilIso`, when set, caps the
// series inclusive of its whole nominal day.
export function expandOccurrenceDates(
  dtstartIso: string,
  rrule: string,
  untilIso: string | null,
  tz: string | null | undefined,
  fromDateIso: string,
  toDateIso: string,
): string[] {
  const anchor = dayStartUtc(dateInTimeZone(dtstartIso, tz));
  let ruleStr = rrule;
  if (untilIso) {
    const until = dateInTimeZone(untilIso, tz).replace(/-/g, '');
    ruleStr += `;UNTIL=${until}T235959Z`;
  }
  const rule = rrulestr(ruleStr, { dtstart: anchor });
  return rule
    .between(dayStartUtc(fromDateIso), dayEndUtc(toDateIso), true)
    .map((d) => d.toISOString().slice(0, 10));
}
