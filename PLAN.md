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

---

# Feature: Rest feed posts + per-habit rest notes/media

> Issue: #23

## Goal

Turn "resting" from a silent per-day streak-neutralizer into a first-class, shareable
activity that mirrors completions and "starts":

1. **A rest posts to the feed** (new `feed_kind = 'rest'`), with its own **note + media**
   describing *why* the user is resting. Rest posts get **full likes & comments**, same as
   completions.
2. The rest note/media describes **the rest**, not a completion of the habit — the user can
   still complete a resting habit. Rest is **per-habit**: each habit has its own rest
   schedule, note, timeline, and one feed post per rest period.
3. The day view ("habit overview") shows a **top banner — one row per active rest** — that
   opens an **editor sheet** to create/modify that rest's note + media.

## Decisions (confirmed with product)

| Question | Decision |
|---|---|
| Rest scope | **Per-habit.** Each rest is `(habit, start, end, note, media)`. |
| Start a rest | **Keep the existing per-habit swipe → "Rest" → pick end-date** flow. |
| Feed granularity | **One post per rest period**, editable after posting (like a completion). |
| Day-view UX | **Top banner, one row per active rest → editor sheet** (reuses completion note/media UI). |
| Likes/comments | **Full parity now** (likeable + commentable). |

## Architecture: follow the existing parallel-table precedent

The schema already has **two** parallel social stacks selected by `feed_kind` in
`fetch_feed_page`:

- `completion_*` (`completion_attachments`, `completion_likes`, `completion_comments`) for `feed_kind='completion'`.
- `activity_*` (`activity_likes`, `activity_comments`, `activity_comment_likes`) for `feed_kind='habit_created'`.

`app/lib/feed.ts` mirrors this with parallel function families
(`likeCompletion`/`likeActivity`, `fetchCompletionSocial`/`fetchActivitySocial`, …).

**Rest is like a completion (note + attachments) but a distinct kind.** Add a third stack —
`rest_*` tables, a `'rest'` branch in `fetch_feed_page`, and `*Rest*` functions in `feed.ts`.
This is additive (no surgery on existing tables/RLS, so the lineage-aware streak work above is
untouched) and consistent with the codebase. We explicitly **avoid** a polymorphic `post_id`
refactor — it would contradict the established pattern and balloon the blast radius.

### Streak neutralization stays on `habit_overrides`

`habit_rests` is the source of truth for note/media/feed/period. **Streak neutralization keeps
working exactly as today**: creating a rest still inserts `habit_overrides(kind='skip')` rows,
one per occurrence in the period, now tagged with `rest_id`. `habit-stats.ts` / `history.ts`
need **no streak-logic changes**. Waking trims the rest and deletes its future override rows.

## Data model (new)

```
habit_rests
  id                  uuid pk
  habit_id            uuid -> habits(id) on delete cascade
  owner_id            uuid -> profiles(id)
  start_date          date not null
  end_date            date not null            -- inclusive; trimmed on early wake
  note                text null                 -- 2000-char cap app-side (matches completions)
  visibility_override habit_visibility null     -- inherits habit visibility when null
  created_at          timestamptz default now()
  updated_at          timestamptz default now() -- updated_at trigger like habit_completions

habit_overrides  (ALTER, additive)
  + rest_id           uuid null -> habit_rests(id) on delete cascade

rest_attachments   -- mirror of completion_attachments; FK rest_id
rest_likes         -- mirror of activity_likes (rest_id, user_id) pk
rest_comments      -- mirror of activity_comments
rest_comment_likes -- mirror of activity_comment_likes
```

- **Storage:** reuse the `completion-media` bucket; path generalizes the documented pattern to
  `{owner_id}/{rest_id}/{uuid}.{ext}`. Same limits (photo ≤10MB, video ≤30s/≤50MB).
- **RLS:** copy the `completion_*` / `activity_*` policies verbatim for `rest_*` (owner full
  access; friends select via `are_friends` + visibility; respects `muted_habits` / `is_blocked`).
  RLS stays the enforcement layer.
- All new tables/columns ship as **new migration files** (never edit existing ones).

## Slices (each ≤10 files, TDD, smallest viable increment)

### Slice 1 — Rest record + creation, tagged overrides
- **Migration A:** `habit_rests` (+RLS, +updated_at trigger); `habit_overrides.rest_id`.
- **`app/lib/rests.ts` (new):** `createRest(habit, fromIso, untilIso)` (insert `habit_rests`,
  then tagged skip overrides); `endRest(restId, fromIso)` (trim `end_date`, delete future tagged
  overrides; cancel+delete entirely if `fromIso <= start_date`); `updateRestNote(restId, note)`;
  `fetchActiveRests(ownerId, iso)`. Structured error objects.
- **`app/lib/habits.ts`:** repoint `wakeHabit` to `endRest` semantics (keep public signature).
- **`app/app/(tabs)/index.tsx`:** `confirmRest` → `createRest`.
- **Tests:** `app/lib/__tests__/rests.test.ts` — creation tags overrides, wake trims vs cancels,
  note update, active-rest query.

### Slice 2 — Rest media + note storage
- **Migration B:** `rest_attachments` (+RLS, +index); storage policy for `{owner}/{rest_id}/…`.
- **`app/lib/rests.ts`:** `uploadRestAttachment` / `deleteRestAttachment` / `listRestAttachments`
  — reuse `validateAttachment` + extension map from `completions.ts` (extract a shared
  `lib/attachments.ts` helper rather than duplicate).
- **Tests:** path construction, validation reuse, structured errors.

### Slice 3 — Feed posting + likes/comments parity
- **Migration C:** `rest_likes`, `rest_comments`, `rest_comment_likes` (+RLS). Replace
  `fetch_feed_page` to add a `'rest'` union branch (note + visibility from `habit_rests`,
  `sort_ts = created_at`) and `'rest'` arms in the attachments / `like_count` / `comment_count` /
  `viewer_liked` CASE expressions. Add `fetch_rest_comments_page` + rest likers RPC, mirroring
  the activity RPCs.
- **`app/lib/feed.ts`:** `FeedKind` gains `'rest'`; add `fetchRestSocial`, `likeRest`/`unlikeRest`,
  `postRestComment`/`fetchRestComments`/`deleteRestComment`, rest comment like/unlike; extend
  `subscribeToFeed` to `rest_likes`/`rest_comments`.
- **Feed UI** (feed card / comments sheet / likers): add `'rest'` dispatch + copy. `feedItemStreak`
  stays completion-only.
- **Tests:** feed-mapping for `'rest'`, social dispatch by kind.

### Slice 4 — Day-view rest banner + editor sheet
- **`RestBanner` (new):** `DayContent` `ListHeaderComponent`; **one row per active rest** for the
  viewed day; tap → editor sheet for that `rest_id`. Owner-only.
- **`RestNoteEditorSheet` (new):** bottom-sheet (Pattern C) reusing the note editor + media
  picker, pointed at `updateRestNote` + rest attachments. Light refactor: give
  `completion-note-editor.tsx` an `onSave`/target prop so it's reusable (keep files ≤200 lines).
- **`index.tsx`:** fetch active rests for the viewed day, pass to `DayContent`, own banner/sheet
  state; **optionally auto-open the sheet after `confirmRest`** so the user adds the "why" right away.
- **Tests:** banner visibility/derivation logic (pure).

### Slice 5 — Other-user view + visibility polish
- `ProfileDayAgenda` (other user's day): **no banner/editor** (owner-only); resting rows stay
  read-only. Verify rest feed posts honor `visibility_override`/habit visibility and RLS for
  friends vs public. Mostly verification + small guards.

## Risks / watch-list
- **Feed RPC churn:** `fetch_feed_page` is large and already re-defined across several migrations
  — replace carefully and keep the return shape stable.
- **Realtime fan-out:** adding `rest_*` subscriptions shouldn't double-fire feed refreshes — reuse
  the existing debounce in `subscribeToFeed`.
- **Wake edge cases:** waking before `start_date` fully cancels (delete rest + overrides + media +
  feed post); waking mid-period trims and keeps history. Cover both in tests.
- **File-size cap:** `feed.ts` and `index.tsx` are already large — extract helpers to stay ≤200 lines.

## Out of scope (v1)
- Polymorphic post refactor. Rest reminders/notifications. Editing rest *dates* from the banner
  (banner edits note/media only; date changes go through wake + re-rest).

## Sequencing & constraints
- Five PRs (Slices 1→5), each ≤10 files and independently shippable; PR descriptions reference the issue.
- TDD red→green→refactor; no new dependencies; no public API removed/renamed (additive); no existing
  migration modified — only new ones; no completion-rate percentages.
- `cd app && npm run typecheck && npm run lint && npm run test` before each commit; `npx supabase db push` (remote).

---

# Feature: Groups (identity-based habit grouping)

Replicate the *Atomic Habits* "identity" idea: a **group** names who the user
wants to become ("a healthy, active person") and bundles the habits that build
that identity ("walk 20 min", "bike 3×/week", "take the stairs"). Habits in the
same group render together on the calendar **day-view** inside a **collapsible
card**, and the group carries its own **streak** alongside per-habit streaks.

## Decisions (confirmed with product)

| Question | Decision |
|---|---|
| Storage | A `habit_groups` table **plus** a time-scoped `habit_group_members` junction. *Not* a `group_id` column on `habits`. |
| Day-view layout | Group is the **top-level** grouping: one collapsible card per group; the existing not-completed / completed / resting ordering is preserved **inside** each card. |
| Ungrouped habits | Render **at the bottom**, below all group cards. |
| Collapse state | **Persisted** per group (`habit_groups.collapsed`), so it survives restarts and syncs across devices. |
| Multi-group | **One active group per habit at a time** (partial unique index). History may show a habit was previously in another group. |
| Group streak | **"Any active member completed"** that day. Per-habit streaks are unchanged. |
| Remove from group | Mirrors habit deletion: **"all"** (wipe the membership — group forgets the habit ever belonged) vs **"going forward"** (set `effective_until` = today; the group **keeps** the habit's past completions in its metrics). |

### Why time-scoped membership (the load-bearing decision)

Requirement: *"removing a habit from a group should remove all past data from the
group OR just going forward; the habit retains all its info either way, and the
group retains completion data from habits since removed."* A plain `group_id`
column can't express "was a member Jan–Mar, left in April but those Jan–Mar
completions still count for the group." So membership becomes its own row with an
**effective window** `[effective_from, effective_until]` — the exact same pattern
as lineage / "this and following" edits (CONTEXT.md § Edit semantics). Group
metrics aggregate a completion iff the completing habit's membership window covers
that completion's date.

Membership is keyed by **`lineage_id`**, not a single `habits.id` row — the app
already treats a lineage as "one habit" everywhere user-facing (streak segments,
stats RPCs). The day-view maps `row.habitId → habit → lineage_id` to find the card.

## Data model (new — all additive, new migration files only)

```
habit_groups
  id          uuid pk
  owner_id    uuid -> profiles(id) on delete cascade
  name        text not null check (1..100 chars)
  color       text null
  icon        text null
  sort_index  integer not null default 0     -- order of cards on the day-view
  collapsed   boolean not null default false  -- persisted expand/collapse
  created_at / updated_at (set_updated_at trigger) / deleted_at

habit_group_members            -- time-scoped membership
  id              uuid pk
  group_id        uuid -> habit_groups(id) on delete cascade
  lineage_id      uuid not null              -- the habit (lineage), not a row
  owner_id        uuid -> profiles(id) on delete cascade
  effective_from  date not null
  effective_until date null                  -- null = active; inclusive last day
  created_at      timestamptz default now()
  check (effective_until is null or effective_until >= effective_from)

-- one active group per habit at a time
create unique index habit_group_members_one_active
  on habit_group_members (lineage_id) where effective_until is null;
```

**RLS** mirrors `habit_rests`: owner-only for all mutations
(`auth.uid() = owner_id`); select scoped to owner for now (groups are private to
the user — no social surface in v1). `set_updated_at` trigger on `habit_groups`.

## Slices (each ≤10 files, TDD, smallest viable increment)

### Slice 1 — Schema + group/membership data layer (pure + queries)
- **Migration** `20260625000000_habit_groups.sql`: the two tables above, indexes,
  partial unique index, RLS, `set_updated_at` trigger. Additive.
- **`app/lib/groups.ts` (new):**
  - Types: `HabitGroup`, `GroupMembership`.
  - Queries: `fetchGroups(ownerId)`, `fetchMemberships(ownerId)` (active + historical).
  - Group CRUD: `createGroup`, `renameGroup`, `setGroupCollapsed`, `reorderGroups`,
    `deleteGroup` (soft-delete; cascades drop memberships).
  - Membership mutations: `addHabitToGroup(ownerId, lineageId, groupId, fromIso)`
    (closes any existing active membership first → enforces one-active),
    `removeHabitFromGroupAll(lineageId, groupId)` (delete the membership rows),
    `removeHabitFromGroupFuture(lineageId, groupId, todayIso)` (set
    `effective_until = today`). Structured error objects.
  - **Pure helpers (TDD core):**
    - `activeGroupIdFor(memberships, lineageId, onIso)` — the group a lineage
      belongs to on a given day (window-covering, active-membership rules).
    - `groupContainsOn(membership, dateIso)` — window-covers predicate.
    - `nextGroupSortIndexFromList(indexes)` (mirrors `nextSortIndexFromList`).
- **Tests** `app/lib/__tests__/groups.test.ts`: window-covering math (boundaries,
  open-ended, removed-going-forward keeps past / drops future), one-active
  enforcement, sort-index helper.

### Slice 2 — Day-view collapsible group cards
- **Pure** `partitionByGroup(dayRows, habitMap, groups, memberships, dateIso)` (new,
  in `lib/groups.ts` or `lib/history.ts`): returns ordered
  `[{ group, sections }]` for each group with ≥1 row that day (group order by
  `sort_index`), then a trailing **ungrouped** bucket. Each card's `sections`
  reuse the existing `partitionRows` (not-completed / completed / resting) so
  ordering inside a card is unchanged.
- **`components/group-card-header.tsx` (new):** group title + collapse chevron
  pinned **top-right** (tap to collapse/expand), mirroring the existing Collapsible
  / resting-header pattern. Calls `setGroupCollapsed`.
- **`components/day-content.tsx`:** build the `DayItem[]` list from grouped cards;
  a collapsed card emits only its header. Ungrouped rows keep today's behavior at
  the bottom. Keep ≤200 lines (extract list-building if needed).
- **Wiring** in `(tabs)/index.tsx`: fetch groups + memberships in the existing
  `load()` `Promise.all`, thread to `CalendarDayView → DayContent`. Optimistic
  collapse toggle + persist.
- **Tests:** `partitionByGroup` grouping/order/ungrouped-at-bottom; collapsed card
  hides rows; a habit in no group lands in the ungrouped bucket.

### Slice 3 — Group selector in habit create/edit
- **`lib/habit-form.tsx`:** `HabitDraft.groupId: string | null` (+ reset/seed).
- **`components/habit-identity-fields.tsx`** (or a small new
  `group-picker-row.tsx`): a disclosure row listing the user's groups + an inline
  "New group…" create. Sets `draft.groupId`.
- **`app/habit/new.tsx` / `app/habit/[id].tsx`:** after `createHabit` /
  edit, reconcile membership via `addHabitToGroup` / remove helpers using the
  habit's `lineage_id`. Edit screen seeds `groupId` from the active membership.
- **Tests:** any pure reconcile helper (e.g. `groupChange(prevGroupId, nextGroupId)`
  → the mutation to run).

### Slice 4 — Group-level streak
- **Pure** `lib/group-streak.ts`: `computeGroupStreak(input, now)` where input is
  the group's member lineages + their completion dates + each membership window.
  Cadence: **daily**, "any active member completed". Walk back from today; a day
  counts if ≥1 completion exists from a habit whose membership covered that day;
  today is neutral if nothing logged yet; a day with **no member active** is
  neutral (bridged); the first active day with zero member completions ends it.
  Reuses date helpers; no network, no mocks.
- **Data:** reuse `fetchMyHabitsStats` completion history (already lineage-keyed)
  joined to memberships — no new RPC if the existing batch stats cover it; else a
  thin additive query. Decide during impl.
- **UI:** group-card header shows `🔥 N` via the existing `StreakBadge`.
- **Tests** `group-streak.test.ts`: any-member-completes continues; all-miss breaks;
  removed-going-forward member still contributes to past days; fully-removed member
  contributes nothing; mixed scheduled/flex members.

## Constraints honored
- TDD red→green→refactor; pure window/streak math tested without mocks.
- No new dependencies. No public API removed/renamed (all additive). No existing
  migration modified — new files only. RLS stays the enforcement layer.
- Streaks + raw counts only — **no** completion-rate percentages, points, or freeze
  tokens at the group level either.
- Each slice ≤10 files; new files ≤200 lines (split `day-content.tsx` /
  `groups.ts` if they approach the cap).
- `cd app && npm run typecheck && npm run lint && npm run test` before each commit;
  `npx supabase db push` (remote) for the migration.

## Implementation status (2026-06-25)

All four slices implemented; 522 tests pass, typecheck + lint clean (9 pre-existing
warnings only). Files:

- **Slice 1** — `supabase/migrations/20260625000000_habit_groups.sql`,
  `lib/groups.ts` (types, pure window helpers, reads), `lib/group-mutations.ts`
  (CRUD + time-scoped membership writes), `lib/__tests__/groups.test.ts`.
- **Slice 2** — `lib/day-items.ts` (pure grouped-list builder) + test,
  `lib/day-item-key.ts` (group-scoped `DayItem`), `components/group-card-header.tsx`,
  `components/day-content.tsx`, `components/calendar-day-view.tsx`, `(tabs)/index.tsx`.
- **Slice 3** — `lib/habit-form.tsx` (`draft.groupId`), `components/group-picker-row.tsx`,
  `components/habit-identity-fields.tsx`, `lib/groups.ts` (`planGroupChange`),
  `lib/habits.ts` (`createHabit` now returns the new id), `app/habit/new.tsx`,
  `app/habit/[id].tsx`.
- **Slice 4** — `lib/group-streak.ts` (`computeGroupStreak`) + test; wired in
  `(tabs)/index.tsx`, shown on the card header.

### Flagged (not silently shipped)

- **Flex group-streak day attribution.** `computeGroupStreak` is correct given
  accurate per-day completion data. The wiring sources member completion-days from
  the lineage `completion_history`, which for **flex** members holds `period_start`
  (week/month start), not the actual completion day — so a flex completion credits
  its period-start day. Scheduled members are exact. Refinement (a dedicated
  lineage-wide member-completion-days query returning real calendar days) is a
  contained follow-up; the pure function needs no change.
- **`day-content.tsx` over the 200-line cap** (297 → 326). Pre-existing debt
  (already over before this work); grew by net rendering for group/ungrouped
  headers after extracting `buildDayItems`. A proper split is left out of scope,
  flagged not silently grown — same posture as `habit-form-fields.tsx` above.
- **Grouping is day-view only.** The 3-day / week / month / schedule views still
  render flat (they don't use `DayContent`). Extending them is out of v1 scope.
- **DB push pending.** `npx supabase db push` must be run against the remote
  project to apply the migration before the feature works end-to-end.

## Follow-up changes (2026-06-25, round 2)

1. **No "Completed" divider inside group cards.** `buildDayItems` now passes
   `completedDivider: false` for group cards — completed habits keep their order
   but just sink to the bottom of the card (no divider, no "all done" line). The
   ungrouped pile keeps the legacy divider (`day-items.ts` + tests updated).
2. **"New group" on the FAB** → routes to the new Groups screen
   (`(tabs)/index.tsx` FabSpeedDial action).
3. **Groups management screen** `app/groups.tsx` (+ `components/group-manage-row.tsx`):
   create, rename (inline), and delete groups in one place; shows each group's
   active-habit count; deleting ungroups its habits (cascade), habits untouched.
   Registered as a modal route in `app/_layout.tsx`.
   - **Location (UX call).** Reached two ways: the **menu drawer → "Manage
     groups"** (the drawer is the calendar's settings surface, and groups are a
     calendar-organization concept, so management lives there next to Settings),
     and the **FAB → "New group"** for quick creation. Both open the same screen,
     so create and manage are unified — the standard pattern (Things "Areas",
     Todoist "Projects": add from a +, manage from a menu). `onOpenGroups` prop
     added to `CalendarMenuDrawer`, wired in `(tabs)/_layout.tsx`.

---

# Feature: Group overview page

Tap a group → a read-only overview screen showing the group's identity
(name/icon/color), its **description**, key **metrics**, the **member habits**,
and a **photo mosaic** of recent member-completion media. Mirrors the existing
habit overview (`lib/use-habit-overview.ts` + `app/habit/view.tsx`).

## Decisions (confirmed with product)

- **Media = mosaic of member photos.** Reuses the existing `completion-media`
  bucket and its RLS — *no* new storage bucket, *no* media columns. The page
  reads recent `completion_attachments` of the group's member habits and renders
  signed-URL thumbnails (same path as habit overview / feed).
- **Entry points:** the day-view group **card header** (tap the name → overview;
  the chevron still collapses/expands) **and** the `/groups` manage screen rows.
- **View-only + Edit button.** The page is read-only; an "Edit" affordance routes
  to the existing `/groups` manage screen. Inline editing of identity/membership
  is out of scope here.

## Metrics shown (no banned percentages)

- **Group streak** — reuses the pure `computeGroupStreak` (lib/group-streak.ts),
  the same function the day-view card uses, so the two never disagree.
- **Active member count** — distinct lineages whose membership window covers today.
- **Group completions** — count of member completion-days that fall *within* each
  member's membership window (the group's own doctrine: a completion counts iff
  the completing habit's window covers its date). Raw count, never a rate.
- Each member habit shows its **own streak** (`habitStreak`) and lineage count.

## Data layer

- **Migration** `20260626000000_group_description.sql`: add nullable
  `description text` (CHECK length ≤ 1000) to `habit_groups`. Additive; existing
  migrations untouched. Reads use `select('*')` so the page works *before* the
  migration is pushed (description simply renders empty).
- `lib/group-overview.ts` — **pure helpers (TDD, no mocks)** plus thin queries:
  - `activeMemberLineages(memberships, groupId, onIso)` → distinct member
    lineage_ids active on a day (built on `groupContainsOn`).
  - `countCompletionsInWindows(memberships, groupId, daysByLineage)` → the
    window-scoped completion count above.
  - `currentHabitByLineage(habits)` → latest row per lineage (for member display).
  - `fetchGroup(id)` and `fetchGroupMemberPhotos(habitIds, limit)` queries.
- `lib/use-group-overview.ts` — data hook: loads the group, memberships, owner
  habits, per-member `fetchHabitStats` (exact count + streak inputs), computes the
  metrics via the pure helpers + `computeGroupStreak`, and resolves photo signed
  URLs via `signedUrlsForPaths`. Mirrors `use-habit-overview.ts`.

## UI

- `app/group/[id].tsx` — the screen: header, member list, mosaic, loading/empty.
- `components/group-overview-header.tsx` — identity + description + stat chips +
  Edit button + the photo mosaic (the group's "vision board").
- `components/group-card-header.tsx` *(modified)* — the name becomes its own tap
  target that navigates to `/group/{id}` (router used in-component to avoid
  threading nav through CalendarDayView → DayContent); the chevron keeps toggling.
  New `groupId` prop.
- `components/day-content.tsx` *(modified)* — passes `groupId={item.groupId}`.
- `components/group-manage-row.tsx` *(modified)* — adds an `onOpen` affordance
  (chevron) so a manage row opens the overview.
- `app/groups.tsx` *(modified)* — wires `onOpen` → `router.push('/group/{id}')`.

## File budget

6 new (migration, group-overview.ts, its test, use-group-overview.ts, the screen,
the header component) + 4 modified (group-card-header, day-content,
group-manage-row, groups) = **10**, at the cap. The mosaic lives inside the
header component (not a 7th file) to stay within budget; if either file nears the
200-line cap during build, the mosaic moves to the screen to rebalance.

## Deferred (flagged, next PR)

**Editing the description.** This PR ships the column + read surface; a writer
(adding a description field to the manage screen's create/rename flow) is a small
follow-up. Until then the Edit button routes to `/groups` and description renders
only when already set. Kept out to honor the 10-file cap and the view-only scope.

---

# Feature: Habit alerts (reminder notifications)

An **alert** is a user-set time of day at which the app reminds the user about a
habit via a notification. Alerts are set per habit, from **both** the create
(`/habit/new`) and edit (`/habit/[id]`) screens (they share the draft +
`HabitFormFields`). A habit can have zero or more alert times.

## Delivery architecture (per CONTEXT.md § Notifications)

**Local notifications, scheduled on-device for a rolling ~7-day window.** This is
the already-resolved doctrine: local for reminders (works offline, instant, no
server cost), server push only for social events. Remote-push token registration
already exists (`lib/push.ts`, wired in `lib/auth.tsx`); what's missing — and what
this feature adds — is local reminder scheduling, permission flow from the alerts
UI, and the `expo-notifications` config plugin in `app.json`.

- **Scheduled habit** — alerts fire at each alert time on each **occurrence day**
  (RRULE-expanded via the existing pure `expandHabit`, respecting `until`).
- **Flex habit** — alerts fire at each alert time **every day** (until `until`,
  if set). Refining flex cadence is CONTEXT.md's tracked open question; daily is
  the smallest useful semantics.
- The queue is refilled (cancel-all-ours + reschedule) after every habit save /
  delete and once per session at sign-in — the same moments `syncWidgetData`
  runs. iOS caps pending locals at ~64; the plan caps at 60, earliest-first.

## Data model

`habits.alert_times jsonb not null default '[]'` — array of `"HH:MM"` 24-hour
local-time strings. On the habit row (like color/visibility), so `draftToInsert`
carries alerts through create, edit-all, **and** the "this and future" fork
insert unchanged. Migration is additive (`20260701000000_habit_alerts.sql`);
existing migrations untouched. Client normalizes/validates times at the boundary
(native time picker + `normalizeAlertTimes` before write); a CHECK enforces the
value is a jsonb array.

## Pure logic (TDD, no mocks) — `app/lib/alerts.ts`

- `isValidAlertTime(s)` — `HH:MM` 24h format guard.
- `normalizeAlertTimes(times)` — drop invalid, dedupe, sort chronologically.
- `formatAlertTime(hhmm)` / `describeAlerts(times)` — 12-hour display + the
  form-row summary (`None` / `7:30 AM` / `2 alerts`).
- `planAlerts(habits, now, windowDays = 7)` → `PlannedAlert[]`
  (`{habitId, title, body, fireDate}`): expands each habit's alert days over
  `[now .. now + windowDays]` (scheduled via `expandHabit`; flex daily), crosses
  them with the habit's alert times, keeps strictly-future fire dates, sorts
  ascending, caps at 60.

## Side-effectful scheduler — `app/lib/alert-scheduler.ts`

Follows `push.ts`'s lazy-`require` pattern (never import `expo-notifications` at
module load — Expo Go prints warnings). Structured error handling; never throws
into UI paths.

- `ensureAlertPermissions()` — get/request notification permission; returns
  granted. Called from the alerts UI when the user adds their first alert.
- `resyncHabitAlerts(ownerId)` — fire-and-forget (like `syncWidgetData`): skip
  unless permission already granted; fetch habits; `planAlerts`; cancel only
  **our** pending notifications (`content.data.kind === 'habit_alert'`); schedule
  the plan (date triggers, `data: {kind, habitId}`). Also installs the foreground
  presentation handler once.

## UI

- `HabitDraft.alertTimes: string[]` (+ default/seed in `habit-form.tsx`);
  `draftToInsert` emits normalized `alert_times` for both kinds; `Habit` /
  `HabitInsert` in `habits.ts` gain `alert_times`.
- `habit-form-fields.tsx`: an **Alerts** disclosure row (summary via
  `describeAlerts`) → `/habit/alerts`.
- `app/app/habit/alerts.tsx` (new page, mirrors `visibility.tsx`): list of alert
  times with per-row remove, an "Add alert" row opening a native time picker.
  Adding an alert runs `ensureAlertPermissions()`; on denial, an explanatory
  alert points at system Settings and the time is not added. No `_layout.tsx`
  change needed (expo-router auto-registers; existing pages set the pattern).
- `app.json`: add the `expo-notifications` plugin (completes native setup for
  dev builds; Android channel/icon defaults).

## Save-path wiring

- `app/habit/new.tsx` — after `createHabit`: `resyncHabitAlerts(userId)`.
- `app/habit/[id].tsx` — after `apply(...)` and after delete: same.
- `lib/auth.tsx` — next to `registerPushToken`: `resyncHabitAlerts` on session,
  keeping the rolling window topped up as days pass.

## Slices / file budget (two PRs, each ≤10 files)

1. **Data + engine:** `PLAN.md`, migration, `lib/alerts.ts`,
   `lib/__tests__/alerts.test.ts`, `lib/alert-scheduler.ts`, `lib/habits.ts`
   (types), `lib/auth.tsx`, `app.json` = 8.
2. **Form UI + save wiring:** `lib/habit-form.tsx`, `lib/__tests__/habit-form.test.ts`,
   `components/habit-form-fields.tsx`, `app/habit/alerts.tsx`, `app/habit/new.tsx`,
   `app/habit/[id].tsx` = 6.

## Known limitations (flagged, not silently shipped)

- **Overrides not consulted.** `planAlerts` reads master rows only: a
  skipped/rested/rescheduled occurrence still alerts at the master time.
  Follow-up: thread `habit_overrides` (and active rests) into the plan.
- **Device-timezone rendering.** `"HH:MM"` fires in the device's current zone;
  `habits.timezone` is not consulted (consistent with how the rest of the client
  renders occurrences today).
- **No server refill beyond 7 days.** CONTEXT.md's daily Edge Function refill is
  out of scope; the window refreshes whenever the app opens (sign-in resync),
  which is sufficient for anyone opening the app within a week.
- **Per-occurrence alerts** ("this occurrence only" scope) are not supported —
  alerts are a habit-level setting; the `this` edit scope leaves them untouched.

## Constraints honored

- TDD red→green→refactor for all pure logic; scheduler kept thin over the pure
  planner. No new dependencies (`expo-notifications` already installed). No
  existing migration modified. No public API removed/renamed. New files ≤200
  lines. Streaks/counts only — alert copy contains no percentages or points.

---

# Fixes: handle-editor dark-mode text + start-date vs completions guard

From `features-and-bugs_01.rtf` (2026-07-02):

1. **Edit handle text was black.** The `HandleEditor` `TextInput`
   (`components/settings-modals.tsx`) set no text color, so RN's black default
   was invisible on the dark-only UI. Fixed with the app's established input
   pattern: `useThemeColor({}, 'text')` + the standard
   `rgba(127,127,127,0.5)` placeholder color (same as `habit-identity-fields`,
   `friend-search-bar`, `completion-note-editor`).

2. **Start date can't move forward past completions.** Editing a scheduled
   habit and moving **Starts** forward would orphan completions dated before
   the new start (their occurrences no longer exist). Guard on save:
   - Pure, TDD'd `blockingCompletionDate(originalDtstartIso, newStartIso,
     completionDates)` in new `lib/start-date.ts` — returns the earliest
     completion strictly before the new start, and only when the start moved
     **forward** (backward moves and unchanged starts always pass; a completion
     exactly on the new start day passes).
   - Thin query + orchestrator `checkStartDateMove(habit, newStart)` fetches
     the edited row's completion `occurrence_date`s (row-scoped, not lineage:
     older lineage rows govern their own eras and are untouched by this row's
     dtstart) and runs the pure check.
   - `app/habit/[id].tsx` runs the check in the **edit-all** path (the only
     scope that rewrites `dtstart`; `this` never touches it, `future` derives
     it from the split occurrence) and blocks with an explanatory alert naming
     the earliest completed date. Moving the start further into the past stays
     allowed. Create screen needs no guard (no completions can exist yet).

Files: `settings-modals.tsx`, `lib/start-date.ts` (new),
`lib/__tests__/start-date.test.ts` (new), `app/habit/[id].tsx`, `PLAN.md` = 5.

---

# Bugfix: same-day group switch fails + deleting a group hides its habits

User report: created a habit + group same day; editing the habit into a second
group errored; deleting the first group made the habit vanish from the day
view, while its creation still shows in the feed and opens the edit page.

## Root cause (two chained bugs — the habit row was never deleted)

1. **Same-day group switch violates a check constraint.** `addHabitToGroup`
   closes the old open membership at `dayBefore(fromIso)`. When the habit
   joined the old group *the same day* (`effective_from = today`), that sets
   `effective_until < effective_from`, which the
   `habit_group_members` check constraint rejects → "Could not save". The
   habit stays actively in the old group.
2. **`deleteGroup` orphans open memberships.** It is a *soft* delete
   (`deleted_at`), so the FK `on delete cascade` on `habit_group_members`
   never fires — despite the comment claiming it does. The open membership
   keeps pointing at the deleted group. `fetchGroups` filters deleted groups,
   and `buildDayItems` only emits cards for fetched groups, so rows bucketed
   under the deleted group id are silently dropped: the habit disappears from
   the day view. The feed entry is correct — the habit still exists.

## Fix (smallest slice, all layers guarded)

- **`lib/day-items.ts`** — bucket rows whose membership points at a group id
  not in the fetched `groups` list into `UNGROUPED` instead of dropping them.
  Rendering invariant: a group can never hide a habit. Also self-heals any
  account already in the broken state.
- **`lib/groups.ts`** — new pure, TDD'd `planMembershipEnd(open, fromIso)`:
  memberships with `effective_from < fromIso` are closed at the day before;
  ones that began on/after `fromIso` never covered an earlier day and are
  deleted outright (closing them would violate the check constraint).
- **`lib/group-mutations.ts`** — `addHabitToGroup` and `deleteGroup` use the
  plan: switch groups same-day without constraint violations; deleting a group
  now explicitly ends its open memberships (habit rows untouched).
- **`supabase/migrations/20260706000000_ungroup_deleted_group_members.sql`** —
  one-time repair for rows already orphaned by past group deletions.

Files: `lib/groups.ts`, `lib/group-mutations.ts`, `lib/day-items.ts`,
`lib/__tests__/groups.test.ts`, `lib/__tests__/day-items.test.ts`,
`app/groups.tsx` (comment), migration, `PLAN.md` = 8.

---

# Feature-fix: group overview "Edit" edits THIS group, not the groups list

User report: tapping a group card → "Edit" opens the manage-all `/groups`
screen. It must open an editor for that specific group: rename, add/update the
description (column shipped in 20260626000000 but has had no writer), and
add/remove member habits.

## Design

- **New route `app/group/edit.tsx`** (param `id`, mirrors `/habit/view`).
  Cancel/Save header like the habit editor. Fields: name (required, ≤100),
  description (≤1000, multiline), and a "Habits" checklist of every current
  habit (one representative row per lineage via `currentHabitByLineage`).
  Toggling reconciles on save: added lineages → `addHabitToGroup` (one-active-
  group moves them out of any other group — the row shows "In {group}" so the
  move is visible); removed → `removeHabitFromGroupFuture` (past completions
  stay attributed).
- **New pure module `lib/group-edit.ts`** (TDD'd):
  `buildGroupHabitChoices(habits, memberships, groups, groupId, todayIso)` —
  checklist rows with `inGroup` / `otherGroupName` (membership pointing at a
  deleted group counts as ungrouped, matching day-items); `planMemberEdits`
  (initial vs selected set diff); thin `updateGroupDetails` mutation (name +
  description — the description's first writer).
- **`app/group/[id].tsx`** — onEdit routes to `/group/edit?id=…`.
- **`components/group-edit-habit-row.tsx`** — presentational checklist row.
- **`lib/use-group-overview.ts`** — reload on focus (expo-router
  `useFocusEffect`) so returning from the editor shows fresh data.

Files: `lib/group-edit.ts`, `lib/__tests__/group-edit.test.ts`,
`app/group/edit.tsx`, `components/group-edit-habit-row.tsx`,
`app/group/[id].tsx`, `lib/use-group-overview.ts`, `PLAN.md` = 7.

---

# Fix: group metrics ignore pre-join completions + Edit button placement

User report: group shows "2 habits, 0 completions, 0 day streak" while its
member rows show 2 and 1 completions. Cause: group metrics are window-scoped —
completions dated before a habit's membership `effective_from` don't count, so
habits added to a group after completing contribute nothing. Product decision:
groups are lenses over their CURRENT habits; metrics reflect the members' full
histories regardless of join date. (Windows still govern day-view bucketing
and one-active-group.)

- **Completions stat** = sum of the member rows' exact all-time counts (the
  numbers shown below it always add up). `countCompletionsInWindows` kept but
  no longer drives the overview.
- **`computeGroupStreak` (shared with the day-view card)** — reworked: union
  the completion days of the group's current members (membership covering
  today) and walk back from today; today-neutral and miss-breaks rules
  unchanged. Join dates no longer gate; past members no longer credit.
- **Edit button** moves from the header identity row to the top bar, aligned
  with Back (`app/group/[id].tsx`; `GroupOverviewHeader` drops `onEdit`).

Files: `lib/group-streak.ts`, `lib/__tests__/group-streak.test.ts`,
`lib/use-group-overview.ts`, `app/group/[id].tsx`,
`components/group-overview-header.tsx`, `PLAN.md` = 6.

---

# UI overhaul: "Ember" — a warm, distinct identity (plan & architecture)

Full visual pitch with before/after mockups:
https://claude.ai/code/artifact/42bba5a4-68f0-4eae-8d4b-b09676bd82a1

## Diagnosis (audited 2026-07-05)

The app feels drab for four concrete reasons — none of them "dark mode":

1. **One dead gray does all hierarchy work.** `rgba(127,127,127,·)` appears in
   64 files as every hairline, hint, placeholder, input fill, and empty state.
   Pure mid-gray on cool charcoal reads muddy.
2. **Two competing accents.** Electric cyan `Palette.primary #09EDE2` (41
   uses) fights hardcoded iOS blue `#0A84FF` (Save/Edit/links, 6+ files).
   Neither is owned; together they read unfinished. Plus one-off reds/greens
   (`#FF3B30`, `#34C759`, `#EF4444`, `#c0392b`).
3. **Habit colors are a free-for-all.** The 7 presets don't share
   saturation/brightness (one is gray) and the HSV wheel admits any hue, so
   every screen is a random rainbow no scheme can survive.
4. **No typographic voice.** All default system sans; the `Fonts.rounded`
   (SF Pro Rounded) stack defined in constants/theme.ts is used zero times.

## Direction: Ember (recommended; alternates "Meadow", "Tide" in the pitch)

Warm plum-charcoal ground, ONE ember-coral accent, warm-ink hierarchy,
rounded display type, curated habit-color family. Dark-first; light theme
("Sunrise") becomes a token swap later.

### Semantic tokens (constants/theme.ts; components stop knowing hex)

- `bg #211D24` (was charcoal #2C2C3A) · `surface #2A2530` (was #363647)
  · `surfaceRaised #332D3A` (inputs/chips)
- `ink #F4EFEA` + alpha steps ink70/ink52/ink45 → replaces #ECEDEE, all
  `opacity:` text hacks, and gray-0.5 hints
- `hairline` = ink @ 8% · `hairlineStrong` = ink @ 12% → replaces all
  `rgba(127,127,127,0.15–0.25)` borders
- `accent #FF8E62` / `onAccent #2A1608` / `accentSoft` @16% → replaces BOTH
  #09EDE2 and #0A84FF
- `streak #FFC24B` (kept) · `success #63C58A` · `danger #F2695C`
- `habitColors` = 8-hue "garden" band (uniform sat/lightness): #FF8E62,
  #F0AE4A, #9BC26B, #5BC4A6, #6FB4E8, #9A96E8, #C48BD6, #EF8FA7. Existing
  custom colors on habits keep working; the picker stops minting outliers
  (HSV wheel moves behind a "Custom" affordance — pending product call).
- Type: `Fonts.rounded` for titles, group names, stat values, streak numbers;
  system sans body. Radii: cards 20, controls 12.
- `solidTint()` currently hardcodes bg RGB [44,44,58] — must read the token
  bg or every tinted surface breaks with the new ground (slice 1).

### Rollout (each slice = one PR ≤10 files)

1. **Foundation** — tokens in constants/colors.ts + theme.ts, `useTokens()`
   hook, ThemedText display variants, solidTint fix. No screen changes yet.
2. **Day view** — agenda-row, group-card-header, week-strip, day-content,
   FAB, tab bar.
3. **Habit identity** — garden swatches default in the picker, pill preview,
   form fields.
4. **Feed** — feed-card, stats, avatar, action bar, comments sheet.
5. **Sweeps** — groups/overview/settings/modals in ≤10-file batches until
   `rgba(127,127,127` is extinct; add lint guard (no-restricted-syntax) so it
   can't return.
6. **Sunrise** — light-theme token values + dual-scheme QA.

### Decisions (2026-07-05)

- Direction: **Ember** (user-approved).
- Habit colors: **swatches-default, HSV wheel behind "Custom"** (slice 3).

### Status

- Slice 1 (Foundation) — **done**: Ember values + legacy `Palette` aliases in
  constants/colors.ts (all 60+ call sites re-ground automatically), semantic
  `Tokens`/`Radii`/`ThemeTokens` in constants/theme.ts, `useTokens()` hook,
  ThemedText `display`/`displaySemiBold` variants (Fonts.rounded),
  `solidTint`/`primaryRgba` follow the new grounds. Token guard tests in
  constants/__tests__/theme-tokens.test.ts.
- Slice 2 (Day view) — **done**: agenda-row (warm fallback color, token
  rings/tracks), group-card-header + tab-top-bar titles in the rounded display
  voice, week-strip filled cells use onAccent ink, day-content
  dividers/labels on hairline/ink tokens, FAB on accent with a coral glow,
  screen-header + tab bar on surface/hairline tokens. Convention: literal
  grays are replaced with tokens; `opacity` on ThemedText is ink-relative and
  allowed.
- Slice 3 (Habit identity) — **done**: color picker is swatches-first (52pt
  garden swatches under the live pill preview) with the HSV wheel +
  brightness slider behind a "Custom color" toggle; opens on the wheel only
  for off-ramp colors (pure `isPresetColor` in lib/color-wheel.ts, TDD'd).
  Icon/color selection states read as accent (accentSoft fill + accent ring);
  placeholders/borders/dividers in habit-identity-fields, form-card,
  habit-pill-preview, group-picker-row are on tokens; group-picker "Add" was
  the identity form's last #0A84FF. Revised per user: the picker is a pushed
  PAGE at /habit/color (modal presentation clipped the header), and the wheel
  always opens minimized behind a 9th wheel-swatch (ColorWheelIcon) in the
  preset grid; color-picker-modal.tsx deleted.
- Slice 4 (Feed) — **done**: feed-card / feed-activity-card (icons + habit
  color fallbacks), feed-avatar (warm fallbacks/placeholder), feed-action-bar
  + feed-comment-row (hearts on the danger token — the off-brand #ff3b5c pink
  is gone; idle icons on ink70), feed-attachment + carousel (media
  placeholders on surfaceRaised, dots on ink), feed-empty (CTA promoted to
  accentSoft/accent), feed-comments-sheet (grabber, hairlines, input,
  send icon on onAccent). completion-card-stack deferred to slice 5 sweeps.
- Slice 5 (Sweeps) — **done**: the remaining 46 files (calendar views,
  habit form pages, groups/settings, social/profile) converted to tokens via
  four parallel sweeps under the established conventions; also purged the
  orphaned old-teal soft fills (repeat chips, rest button, unread
  notification wash → primaryRgba/accent). `rgba(127,127,127,·)` and
  `#0A84FF` are extinct in product code and BANNED by an eslint
  no-restricted-syntax guard (eslint.config.js) that fails the build if they
  return. progress-ring/animated-progress-ring trackColor became an optional
  prop resolved to t.hairlineStrong at usage sites.
- Slice 5.5 (De-alias) — **done**: all ~40 remaining call sites migrated off
  the slice-1 scaffolding. `Palette.primary/primaryDark/charcoal(+Elevated)/
  ghostWhite/coolGray/slate200/success/warning/error` and `primaryRgba` are
  DELETED (TypeScript is the guard); `Palette` is now only the deliberate hue
  sheet (habitColors + periwinkle/rose pairs — lavender/blush renamed);
  default-habit-color fallbacks use `Palette.habitColors[0]`, accent washes
  use the new pure `withAlpha(t.accent, a)`; the `Colors` map derives 100%
  from Tokens; `useThemeColor` is locked to ThemedText/ThemedView by an
  eslint no-restricted-imports guard. Judgment call to review on device:
  sign-in's email CTA went from a fixed dark pill to the accent-filled CTA
  pattern (the dark pill would have been unreadable on the light theme).
- Slice 6 (Sunrise) — **done** (pending device QA): light token values
  redesigned to clear WCAG AA — accent deepened to #B84A22, streak #946708,
  success #2A7C4D, danger #BE3A2D (all ≥4.5:1 on paper AND white surface,
  label-on-accent 4.9:1). New `today` token (dark: garden periwinkle; light:
  periwinkleDeep #5A54BA) replaces raw periwinkle on all today markers
  (week-strip cell, 3day/week/schedule headers, month ring, "Today" jump
  button). A contrast guard suite in constants/__tests__/theme-tokens.test.ts
  asserts AA for accent/streak/success/danger/today on bg+surface and 7:1 for
  ink, in BOTH schemes — legibility can't silently regress. Device QA
  checklist: flip appearance to light and walk day view, feed, habit form,
  color page, groups; known-soft spots (acceptable, flagged): FAB speed-dial
  hue-trio icons and rest chips read lighter in light mode; sign-in email CTA
  is now the accent pattern.

- Addendum: **in-app Appearance setting** (Settings → Appearance:
  System/Light/Dark). lib/theme-preference.ts persists the choice in
  AsyncStorage and applies it via RN Appearance.setColorScheme, so
  useColorScheme → useTokens follows it app-wide with no component changes;
  reapplied on launch in app/_layout.tsx. Pure helpers TDD'd.

The Ember overhaul is complete: every color in the app flows from
constants/theme.ts Tokens; lint bans the retired literals; tests ban dead
grays, key drift, and AA regressions.
