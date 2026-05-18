# Plan: Add ability to delete a habit with occurrence scope options (issue #17)

## Problem
Users have no way to delete habits. CONTEXT.md specifies deletion uses the same
three-scope pattern as editing: this occurrence only, this and future, all.

## Approach

### `lib/habits.ts` — two new async mutations + one pure helper
- `deleteUntilFromOccurrence(occurrenceDate)` — pure: returns `until` ISO string
  (end-of-second before midnight of the occurrence date, so RRULE expansion stops
  before that day). Testable without mocking.
- `deleteHabitAll(habitId)` — sets `deleted_at = now()` on the master row.
- `deleteHabitFuture(habitId, occurrenceDate)` — sets `until` on the master row so
  the habit ends just before the given occurrence; the occurrence and everything
  after it disappears. Uses `deleteUntilFromOccurrence`.
- "This occurrence only" reuses the existing `skipOccurrence` (inserts `kind='skip'`
  override) — no new function needed.

### `app/habit/view.tsx` — add Delete affordance
- New "Delete" Pressable in the header (for owner only, next to "Edit").
- `handleDelete` callback:
  - Flex habits or one-off scheduled → single confirmation alert → `deleteHabitAll`.
  - Recurring scheduled habits → scope picker alert:
      "This occurrence only" → `skipOccurrence`
      "This and future"     → `deleteHabitFuture`
      "All occurrences"     → `deleteHabitAll`
  - On success: `router.back()` so the stale habit disappears from the list.

### `lib/__tests__/habits.test.ts` — new tests (TDD first)
- `deleteUntilFromOccurrence`: verify it returns one second before midnight of that
  date (i.e., the day before at 23:59:59.000Z).

## Files changed (≤ 10)
1. `app/lib/habits.ts`
2. `app/app/habit/view.tsx`
3. `app/lib/__tests__/habits.test.ts`

## Constraints respected
- No new npm dependencies.
- No streaks, percentages, or gamification copy.
- No existing migration files modified.
- Pure functions tested without mocks.
