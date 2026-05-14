import { applySectionReorder, type Habit } from '../habits';

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
