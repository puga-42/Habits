# Feature: Habit creation/edit page — pinned editable preview pill + end date

Rework `/habit/new` and `/habit/[id]` so the habit form is driven by a live,
pinned preview pill, and add an optional **Ends** date.

## What changes (user-facing)

1. **Pinned preview pill.** Above everything, a sample habit pill shows how the
   habit will look on the calendar (color, icon, name, description). It updates
   live as the user edits and stays pinned while the form scrolls.
2. **Inline editing from the pill.** Icon, name, description, and color are
   edited directly on the pill:
   - Tap the icon circle → an inline emoji row expands under the pill. There is
     **no default icon**; the empty state shows a dashed circle with a "+"
     placeholder (in the habit color) to signal it's tappable.
   - Tap the name → focus the name field (auto-focused on a fresh habit).
   - Tap the description → focus the description field.
   - Tap the color swatch (where the calendar's completion marker sits) → a
     bottom-sheet **color wheel** opens (HSV wheel + brightness slider) with the
     curated `Palette.habitColors` swatches kept as quick presets.
   The standalone Title, Description, Icon, **and Color** form sections are all
   removed.

   **Color wheel — no new dependency.** `reanimated-color-picker` pins
   `expo@56` (this project is on expo 54), so adopting it would force
   `--legacy-peer-deps` on every install and gamble on reanimated-4 runtime
   compat. Instead the wheel is built on the already-installed
   `react-native-svg` with React Native's touch-responder system; the
   HSV/geometry math is a pure, TDD'd module.

4. **Keyboard.** The form `ScrollView` uses `automaticallyAdjustKeyboardInsets`
   (+ interactive dismiss) so the whole page stays reachable while the on-screen
   keyboard is up. Android's default resize behavior covers the same.
3. **Ends date.** Under "Starts" (scheduled habits only) a new "Ends" row
   defaults to **Never**. Tapping reveals a date picker; a "Never" affordance
   clears it back to null. Maps to the existing `until` column.

Applies to **both** the create and edit screens (they share `HabitFormFields`).

## Data layer (already present — no migration)

`HabitDraft.endsOn: Date | null` and `draftToInsert` → `until` already exist
(`lib/habit-form.tsx`). This change is UI plus a small pure date helper.

## Pure logic (TDD, no mocks)

- `app/lib/habit-ends.ts`
  - `addMonths(date, months)` — month arithmetic with end-of-month clamping.
  - `defaultEndDate(start)` — the value used when the user first enables an end
    date (one month after start).
  - `clampEndDate(start, end)` — never lets the end fall before the start.
- `app/lib/__tests__/habit-ends.test.ts` — covers normal, month-overflow, and
  year-rollover cases plus clamping.

## Files

- `PLAN.md` — this file.
- `app/lib/habit-ends.ts` — new pure helper.
- `app/lib/__tests__/habit-ends.test.ts` — tests.
- `app/components/habit-pill-editor.tsx` — new pinned, editable preview pill
  (owns the `ICONS` list, moved out of the form); opens the color wheel sheet.
- `app/lib/color-wheel.ts` + `app/lib/__tests__/color-wheel.test.ts` — pure
  HSV/hex/geometry helpers, TDD'd.
- `app/components/color-wheel.tsx` — SVG HSV wheel + touch responder.
- `app/components/color-picker-modal.tsx` — wheel + brightness slider + preset
  swatches sheet.
- `app/components/habit-form-fields.tsx` — drop Title/Description/Icon/Color
  sections; add the `EndsOnRow` under `StartsOnRow`; keyboard-aware scroll.
- `app/app/habit/new.tsx` — render the pill editor above the form, auto-focus name.
- `app/app/habit/[id].tsx` — same, seeded from the loaded habit.

7 files — under the 10-file cap. No new dependencies. No migration. No public
API removed or renamed.

## Iteration: iOS-menu form + Goal/Repeat pages

- **Empty icon.** The icon picker's first cell is a dashed "none" circle that
  sets `icon` to `''` (removes the icon).
- **Goal row → `/habit/goal`.** Raw number + unit (Times / Minutes / Hours).
  `Times` → count (`targetCount`); `Minutes`/`Hours` → timed
  (`targetValue` + `displayUnit`). Summary via `describeGoal` (tested).
- **Repeat row → `/habit/repeat`.** Replaces the old `Kind` segment **and** the
  `Repeats` row (the `/habit/recurrence` page is removed). Picks Scheduled vs
  Flex (locked on edit via `?lock=1`), then the schedule (incl. the new
  **specific days of the month**) or the flex period. Summary via
  `describeRepeat` (tested).
- **Specific days of month.** New `monthlyDays` recurrence pattern
  (`BYMONTHDAY`) in `lib/recurrence.ts`, TDD'd (build/describe/parse + ordinals).
- The old segmented Kind/Unit/Duration/Target/Per controls are gone; the form is
  now iOS-style disclosure rows: Goal, Repeat, Starts/Ends (scheduled),
  Visibility.

Known limitation: for a **scheduled** habit, the Goal "times" count isn't stored
(only flex uses `target_count`), so the Goal row can read e.g. "3 times" without
affecting behavior. Flagged for a follow-up decision (hide the count for
scheduled, or store a per-occurrence target).

## Constraints honored

- Pure date helper tested without mocks.
- No completion-rate percentages / points introduced.
- `habit-form-fields.tsx` was already ~2× over the 200-line cap before this
  change (407 lines). It nets +10 here (407 → 417): the new `EndsOnRow` is a bit
  larger than the removed Title/Description/Icon sections. A proper split of this
  shared file is pre-existing debt left out of scope; flagged, not silently
  grown. The new files (`habit-pill-editor.tsx` 141, `habit-ends.ts` 27) are
  within the cap.

---

# Feature: Streak badge on day-view habit pills

Show the current streak as a `🔥 N` badge on each day-view habit pill, placed
just **inside** (left of) the trailing completion control. Informational, so it
does not displace the primary tap target pinned to the trailing edge. Day-view
only — hidden in the compact 3-day/week columns where there is no room.

## Approach: batched fetch + memoized client compute (no stored streak)

A streak breaks on a *miss* (an absent event), so a persisted column would need
a timezone-aware cron to stay correct and would still need cache invalidation on
every edit/reset/skip path. Instead we reuse the existing pure, cadence-aware
`computeStreak` (lib/streak.ts) — the same function the feed and overview use, so
all three always agree.

The day-view fetches only the visible window, which lacks the lineage-wide
history a streak needs. The singular `fetch_habit_stats` (one lineage, visibility
-checked) and the feed RPC (event-scoped) don't cover "all of today's habits", so
this adds one **batched, owner-only** RPC.

## Data layer

- **Migration** `20260613000000_my_habits_stats_batch.sql`: `fetch_my_habits_stats(p_viewer_id)`
  returns `{lineage_id, completion_history, skip_history}` per owned lineage,
  reusing the singular RPC's history-extraction SQL grouped by lineage. Owner-
  scoped, so no visibility/blocking checks. Additive — existing migrations
  untouched.
- `lib/habit-stats.ts`: `fetchMyHabitsStats(viewerId)` → `Map<lineageId, LineageStats>`
  (empty map on failure → badges simply hidden), and the **pure** `streaksByHabit(habits, statsByLineage, now)`
  → `Map<habitId, number>`, looked up by `lineage_id`. TDD'd in habit-stats.test.ts.

## UI

- New `components/streak-badge.tsx` (`🔥 N`, hidden at 0; mirrors FeedCardStats).
- `agenda-row.tsx` gains a `streak?` prop and renders the badge between the body
  and trailing control, gated to the full (`!compact`) day-view.
- `streakByHabitId` is memoized in `(tabs)/index.tsx` (recomputes only when
  habits/stats change, never on render) and threaded through
  CalendarDayView → DayContent → HabitRowSwipeable like `flexProgressByHabitId`.
  `handleTrailingPress` already calls `load()`, so the badge updates live after a
  completion.

## Constraints honored

- Streak only — no completion-rate percentages / points.
- Streak logic stays a single shared pure function (no duplication, no SQL port).
- 6 files + 1 migration, all new files within the 200-line cap.

## Bug fix: feed cards showed the *current* streak on every card

`feedItemStreak` computed the streak against `new Date()` for every feed row, so
all of a habit's completion cards showed today's rolling streak — yesterday's
card said "3" instead of the "2" it had at the time. Fixed by anchoring the
computation to the card's own `occurrence_date` (scheduled) / `period_start`
(flex): `computeStreak` already excludes occurrences after its "now", so the same
lineage history yields the historically-correct number per card. A backfilled
past completion recomputes correctly — which a stored snapshot would not. The
`now` parameter is dropped from `feedItemStreak` (callers in feed.ts /
user-profile.ts updated). The badge itself now stacks the count under the 🔥.

---

# Fix: edits must stay unified across a habit's lineage

## Problem

A "This and future" edit **forks** the lineage: `applyEditFuture`
(`lib/habits.ts`) caps the old row's `until` and **inserts a new `habits` row**
sharing the same `lineage_id`, with `dtstart` = the edit moment. This is the
correct way to preserve history (each era keeps its own schedule). Two surfaces,
though, key off a *single row* instead of the *lineage*, so a fork corrupts them:

1. **Feed shows a fork as "started".** `trg_habit_created_activity` fires on
   *every* `INSERT` into `habits` (`20260518000000_initial.sql`), so a fork
   writes a `habit_activity` `'created'` row, which `fetch_feed_page` surfaces as
   a "started" event.
2. **The streak collapses.** `computeStreak` (`lib/streak.ts`) expands occurrences
   from **one** row's `rrule`/`dtstart`/`until`. After a fork the active row's
   `dtstart` is the edit moment, so `expandHabit` produces no occurrences before
   the fork — the pre-fork completions (still in the lineage-wide history) match
   nothing and the streak resets to ~0.

Raw counts and the heatmap are **already** lineage-correct: `fetch_habit_stats`,
`fetch_my_habits_stats`, the feed RPC, and `get_user_activity_heatmap` all
aggregate `where habits.lineage_id = …`. No data is lost — only the streak and
the feed event misread a fork.

**Principle:** anything user-facing about a *habit* is computed over the
**lineage**, never a single row. A row is one time-slice of the schedule.

## Slice 1 — feed trigger: only the lineage root emits "started"

Migration `20260613000001_habit_activity_root_only.sql` (additive; no existing
migration touched):

- Recreate `trg_habit_created_activity` with a guard so it fires only for a
  lineage **root** row: `when (new.lineage_id = new.id)`. A genuine create and an
  *adoption* both insert a new root (`lineage_id := id` via `set_habit_lineage`),
  so both still emit; a fork (`lineage_id` = the original's) does not.
  - **Verify during impl:** the adopt path (`20260609000000_adopt_habit.sql` /
    its client caller) does **not** pass an explicit `lineage_id` — if it did, the
    guard would suppress adoption events. If it does, gate on
    `new.lineage_id = new.id OR new.adopted_from_user_id is not null` instead.
- **Backfill cleanup:** delete already-written spurious rows —
  `delete from habit_activity a using habits h
   where a.habit_id = h.id and h.lineage_id <> h.id
     and a.event_type in ('created','adopted')`.

Files: 1 migration. (Trigger behavior verified against the DB after push; no unit
test harness for SQL triggers in this repo — note in the PR.)

## Slice 2 — lineage-aware streak (segments)

The streak must expand **every** era of the lineage. Each lineage row contributes
a *segment* `{ kind, rrule, dtstart, until, target_count, target_period }`. Source
of truth = the **stats RPCs** (decided: keeps feed, overview, and day-view
consistent; RRULE expansion stays client-only).

### Data layer — migration `20260613000002_lineage_segments.sql`

`create or replace` is insufficient when adding a return column, so this migration
`drop`s and recreates each function with an added `segments` column (existing
migration files untouched):

- `fetch_habit_stats` and `fetch_my_habits_stats` — add a per-lineage `segments`
  `jsonb` array, `jsonb_agg` of the lineage's rows ordered by `dtstart`.
- `fetch_feed_page` — add `habit_segments` for the card's lineage (same agg).

Signatures otherwise unchanged; `segments` is additive.

### Pure logic (TDD first — `lib/streak.ts`)

- Replace the single `rrule`/`dtstart`/`until` on `StreakInput` with
  `segments: ScheduleSegment[]`.
- `scheduledStreak`: expand **each** segment over `[earliest completion .. today]`
  via the existing `expandHabit`, union + dedupe + sort the occurrence ISO dates,
  then run the unchanged walk-back (completed → +1, skip/today → neutral, miss →
  stop). A daily era + a later weekly era now form one continuous streak.
- `flexStreak`: **per-segment target** — for each period bucket, pick the segment
  active at the bucket's start and test its `target_count`. Kind can't change
  across a lineage (kind is locked on edit), so the kind branch is unchanged.
- New `streak.test.ts` cases: daily→weekly fork stays continuous across the seam;
  fork with an unchanged schedule is identical to no fork; flex retarget judges
  each period against its own target; capped-history under-report still holds.

### Callers

- `lib/habit-stats.ts` — `fetchHabitStats` / `fetchMyHabitsStats` carry
  `segments` through; `habitStreak` / `streaksByHabit` build `StreakInput.segments`
  from the lineage segments (no longer from the single `habit` row). Update
  `habit-stats.test.ts`.
- `lib/feed.ts` (+ `lib/user-profile.ts` if it shares the mapping) — map
  `habit_segments` into `feedItemStreak`'s input.

Files: 1 migration + `streak.ts`, `habit-stats.ts`, `feed.ts`, `user-profile.ts`,
`streak.test.ts`, `habit-stats.test.ts` = 7. Under the 10-file cap.

## Sequencing & constraints

- Two PRs (Slice 1 then Slice 2): each is the smallest viable slice, each ≤10
  files, each independently shippable. PR descriptions reference the issue.
- TDD: streak changes are red-first in `streak.test.ts` before touching
  `streak.ts`.
- No new dependencies. No public API removed/renamed (signatures additive). No
  existing migration modified — only new ones. No completion-rate percentages.
- Run `cd app && npm run typecheck && npm run lint && npm run test` before each
  commit; apply migrations with `npx supabase db push` (remote).
