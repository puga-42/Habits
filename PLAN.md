# Plan: Delete Habit

**Goal:** Add a "Delete Habit" button at the bottom of the edit screen. When
pressed, the user chooses a deletion scope, confirms via Alert, and the habit
is soft-deleted (all past completions preserved).

---

## Scope options by habit kind

### Scheduled habits (recurring)

| Option | Label | Behavior |
|--------|-------|----------|
| **Delete All** | "Delete all occurrences" | Set `deleted_at = now()` on the master `habits` row. Habit disappears everywhere. Past completions remain in DB and feed. |
| **Delete Future** | "Delete future occurrences" | Set `until` on the current master habit to today (end of day). Today's occurrence still exists; tomorrow onward is gone. No new habit row created (unlike "edit future" which creates a continuation). |

One-off scheduled habits (`FREQ=DAILY;COUNT=1`) skip scope choice — go
straight to "Delete All" with confirmation.

### Flex habits

| Option | Label | Behavior |
|--------|-------|----------|
| **Delete All** | "Delete all occurrences" | Set `deleted_at = now()` on the master `habits` row. Past completions remain. |
| **Delete Future** | "Delete future occurrences" | Set `until` to end of the current period (e.g., end of this week for a weekly habit). Current period stays active; habit won't appear in future periods. |

---

## UX flow

1. User opens habit edit screen (`/habit/[id]`)
2. Scrolls to bottom of `HabitFormFields` — sees red "Delete Habit" button
3. Taps button →
   - **Recurring scheduled / flex:** `Alert.alert` with three buttons:
     "Delete all occurrences", "Delete future occurrences", "Cancel"
   - **One-off scheduled:** `Alert.alert` with two buttons:
     "Delete Habit", "Cancel"
4. On confirm → execute mutation → navigate back (router.back)
5. On cancel → dismiss alert, stay on edit screen

### Button placement

The delete button lives **inside `HabitFormFields`**, rendered at the very
bottom of the ScrollView after the Visibility section. This keeps the edit
screen file (`habit/[id].tsx`) clean — it just passes an `onDelete` callback
prop. The button is only shown in edit mode (not on create).

---

## Data changes

**No schema changes.** All required columns already exist:
- `habits.deleted_at` (timestamptz, nullable) — used for "Delete All"
- `habits.until` (timestamptz, nullable) — used for "Delete Future"
- `habit_overrides.kind = 'skip'` — not needed (we dropped "delete current")

**Past completions are preserved.** `habit_completions` rows are untouched by
any deletion scope. Friends continue to see past completions in their feed.

---

## Implementation — files touched

### Modified files (3)

| # | File | Change |
|---|------|--------|
| 1 | `app/lib/habits.ts` | Add `deleteHabitAll(habitId)` and `deleteHabitFuture(habit)` functions |
| 2 | `app/lib/__tests__/habits.test.ts` | Tests for the pure helper `flexPeriodEnd(habit)` that computes the `until` date for flex "delete future" |
| 3 | `app/components/habit-form-fields.tsx` | Add optional `onDelete` prop. Render red "Delete Habit" button at bottom of ScrollView when provided |
| 4 | `app/app/habit/[id].tsx` | Add `onDelete` handler: scope selection Alert → confirmation Alert → call mutation → navigate back |

### No new files

Everything fits within existing modules. No new dependencies.

---

## Mutation details

### `deleteHabitAll(habitId: string)`

```
UPDATE habits SET deleted_at = now() WHERE id = habitId
```

Simple soft-delete. RLS ensures only the owner can do this.

### `deleteHabitFuture(habit: Habit)`

**Scheduled habits:**
```
UPDATE habits SET until = endOfToday WHERE id = habit.id
```

Where `endOfToday` is today at 23:59:59.999 in the habit's timezone, converted
to UTC. This allows today's occurrence to still appear but blocks all future
RRULE expansion.

**Flex habits:**
```
UPDATE habits SET until = endOfCurrentPeriod WHERE id = habit.id
```

Where `endOfCurrentPeriod` depends on `target_period`:
- `day` → end of today
- `week` → end of Sunday (Monday-first weeks, so Sunday 23:59:59)
- `month` → end of last day of current month

### Pure helper: `flexPeriodEnd(habit: Habit): Date`

Computes the end-of-period timestamp for a flex habit based on its
`target_period`. This is the testable pure function.

---

## Edge cases

1. **Habit with existing `until`**: "Delete Future" should only narrow, never
   extend. If `until` is already set and is before our computed value, keep the
   existing `until`.
2. **Lineage chains**: "Delete All" only soft-deletes the specific `habits` row
   being edited, not the entire lineage. Other rows in the lineage (from prior
   "this and future" edits) are unaffected — they already have their own `until`
   bounds.
3. **Flex habit already past target**: Doesn't matter — deletion is about
   whether the habit appears going forward, not about completions.
4. **Concurrent completions**: No conflict — completions reference `habit_id`,
   and soft-deleted habits still exist in the DB. The completion is still valid.
5. **Feed visibility**: Existing `fetchHabits()` already filters
   `.is('deleted_at', null)`, so deleted habits won't appear in the user's
   habit list. Feed RPCs that join on habits should also respect `deleted_at`
   for habit-level display, but individual completions remain visible.
6. **Undo**: No undo. The confirmation Alert is the safety net. A future
   "restore deleted habits" feature could leverage `deleted_at` being a
   soft-delete, but that's out of scope.

---

## Test plan

- **Unit (pure):** `flexPeriodEnd` returns correct end-of-period for day/week/month
- **Unit (pure):** `flexPeriodEnd` respects existing `until` (no extension)
- **Integration (manual):**
  - Delete all on a scheduled habit → habit disappears from today view and habit list
  - Delete future on a scheduled habit → today still shows, tomorrow doesn't
  - Delete all on a flex habit → habit disappears
  - Delete future on a flex habit → current period still active, next period habit is gone
  - Past completions remain visible in feed after any deletion
  - One-off scheduled habit skips scope choice
  - Cancel at either Alert dismisses without changes

---

## Open questions

1. Should "Delete future" on a flex habit with `target_period: 'day'` behave
   identically to "Delete all"? (Both would effectively stop the habit after
   today.) — **Proposed: yes, but still show both options for consistency.**
