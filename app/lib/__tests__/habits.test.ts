import { applySectionReorder, canCompleteOn, flexPeriodEnd, type Habit } from '../habits';

function h(id: string, sort_index: number, created_at = '2026-05-01T00:00:00Z'): Habit {
  return {
    id,
    lineage_id: id,
    owner_id: 'u1',
    kind: 'scheduled',
    title: id,
    description: null,
    color: null,
    icon: null,
    visibility: 'private',
    timezone: 'UTC',
    dtstart: '2026-05-01T07:00:00Z',
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    unit: 'count',
    target_seconds: null,
    display_unit: null,
    sort_index,
    created_at,
    updated_at: created_at,
    deleted_at: null,
  };
}

describe('applySectionReorder', () => {
  it('places reordered ids into the slots they previously occupied, preserving everything else', () => {
    const habits = [h('H1', 1), h('H2', 2), h('H3', 3), h('H4', 4), h('H5', 5)];
    // Reorder a section so H3 comes before H1. H2, H4, H5 are not in the section.
    const result = applySectionReorder(habits, ['H3', 'H1']);
    expect(result.map((x) => x.id)).toEqual(['H3', 'H2', 'H1', 'H4', 'H5']);
  });

  it('renumbers sort_index sequentially from 1', () => {
    const habits = [h('H1', 10), h('H2', 20), h('H3', 30)];
    const result = applySectionReorder(habits, ['H2', 'H1']);
    expect(result.map((x) => x.sort_index)).toEqual([1, 2, 3]);
    expect(result.map((x) => x.id)).toEqual(['H2', 'H1', 'H3']);
  });

  it('does not move habits that are not in the reordered section', () => {
    // Even when the section is reordered, untouched habits keep their relative
    // position. This is the bug from before: the old code yanked all "visible
    // on this day" habits to the front, scrambling other days in the schedule.
    const habits = [h('H1', 1), h('H2', 2), h('H3', 3), h('H4', 4)];
    // Section being reordered contains H1 and H4 only (e.g. they're the
    // not-completed rows on the tapped day); user drops H4 before H1.
    const result = applySectionReorder(habits, ['H4', 'H1']);
    // H2 and H3 must stay in their original slots (indexes 1 and 2).
    expect(result.map((x) => x.id)).toEqual(['H4', 'H2', 'H3', 'H1']);
  });

  it('is a no-op when sectionIds matches current order of those habits', () => {
    const habits = [h('H1', 1), h('H2', 2), h('H3', 3)];
    const result = applySectionReorder(habits, ['H1', 'H3']);
    expect(result.map((x) => x.id)).toEqual(['H1', 'H2', 'H3']);
    expect(result.map((x) => x.sort_index)).toEqual([1, 2, 3]);
  });

  it('ignores ids in sectionIds that do not correspond to any habit', () => {
    const habits = [h('H1', 1), h('H2', 2)];
    const result = applySectionReorder(habits, ['ghost', 'H2', 'H1']);
    expect(result.map((x) => x.id)).toEqual(['H2', 'H1']);
  });

  it('handles an empty sectionIds array by renumbering existing order', () => {
    const habits = [h('H1', 10), h('H2', 20)];
    const result = applySectionReorder(habits, []);
    expect(result.map((x) => x.id)).toEqual(['H1', 'H2']);
    expect(result.map((x) => x.sort_index)).toEqual([1, 2]);
  });

  it('uses sort_index then created_at as the baseline order before reordering', () => {
    // H2 and H3 share sort_index 2; H2 was created first, so it sorts first.
    const habits = [
      h('H1', 1, '2026-05-01T00:00:00Z'),
      h('H3', 2, '2026-05-02T00:00:00Z'),
      h('H2', 2, '2026-05-01T12:00:00Z'),
    ];
    // Section reorders only H1; positions occupied by {H1} should be the first
    // slot. Baseline ordering: H1, H2, H3.
    const result = applySectionReorder(habits, ['H1']);
    expect(result.map((x) => x.id)).toEqual(['H1', 'H2', 'H3']);
  });
});

describe('canCompleteOn', () => {
  const today = new Date(2026, 4, 13); // May 13, 2026

  it('allows completing on today', () => {
    expect(canCompleteOn('2026-05-13', today)).toBe(true);
  });

  it('allows completing on a past day', () => {
    expect(canCompleteOn('2026-05-10', today)).toBe(true);
  });

  it('rejects completing on a future day', () => {
    expect(canCompleteOn('2026-05-14', today)).toBe(false);
  });

  it('rejects completing on a date far in the future', () => {
    expect(canCompleteOn('2027-01-01', today)).toBe(false);
  });
});

function flexHabit(
  targetPeriod: 'day' | 'week' | 'month',
  until: string | null = null,
): Habit {
  return {
    id: 'flex1',
    lineage_id: 'flex1',
    owner_id: 'u1',
    kind: 'flex',
    title: 'Gym',
    description: null,
    color: null,
    icon: null,
    visibility: 'private',
    timezone: 'UTC',
    dtstart: null,
    rrule: null,
    until,
    target_count: 3,
    target_period: targetPeriod,
    unit: 'count',
    target_seconds: null,
    display_unit: null,
    sort_index: 1,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    deleted_at: null,
  };
}

describe('flexPeriodEnd', () => {
  it('returns end of today for daily habits', () => {
    const now = new Date(2026, 4, 19, 14, 30); // May 19, 2026 2:30pm
    const result = flexPeriodEnd(flexHabit('day'), now);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });

  it('returns end of Sunday for weekly habits (Monday-first weeks)', () => {
    // May 19, 2026 is a Tuesday → week ends Sunday May 24
    const now = new Date(2026, 4, 19, 10, 0);
    const result = flexPeriodEnd(flexHabit('week'), now);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(24); // Sunday
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });

  it('returns end of Sunday when today is Monday', () => {
    const now = new Date(2026, 4, 18, 8, 0); // Monday May 18
    const result = flexPeriodEnd(flexHabit('week'), now);
    expect(result.getDate()).toBe(24); // Sunday May 24
  });

  it('returns end of Sunday when today is Sunday', () => {
    const now = new Date(2026, 4, 24, 8, 0); // Sunday May 24
    const result = flexPeriodEnd(flexHabit('week'), now);
    expect(result.getDate()).toBe(24); // still this Sunday
  });

  it('returns end of last day of month for monthly habits', () => {
    const now = new Date(2026, 4, 19, 10, 0); // May 19
    const result = flexPeriodEnd(flexHabit('month'), now);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(31); // May has 31 days
    expect(result.getHours()).toBe(23);
  });

  it('handles February correctly for monthly habits', () => {
    const now = new Date(2026, 1, 15, 10, 0); // Feb 15
    const result = flexPeriodEnd(flexHabit('month'), now);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28); // 2026 is not a leap year
  });

  it('does not extend past an existing until date', () => {
    const existingUntil = '2026-05-20T23:59:59.000Z';
    const now = new Date(2026, 4, 19, 10, 0);
    const result = flexPeriodEnd(flexHabit('week', existingUntil), now);
    // Week would end May 24, but existing until is May 20 — keep earlier
    expect(result.getTime()).toBe(new Date(existingUntil).getTime());
  });

  it('uses computed end when existing until is later', () => {
    const laterUntil = '2026-06-30T23:59:59.000Z';
    const now = new Date(2026, 4, 19, 10, 0);
    const result = flexPeriodEnd(flexHabit('week', laterUntil), now);
    // Week ends May 24, which is before June 30 — use computed
    expect(result.getDate()).toBe(24);
    expect(result.getMonth()).toBe(4);
  });
});
