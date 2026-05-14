# Calendar tab — unified Today + History with 5 view modes

Big restructure: replace the separate **Today** and **History** tabs with a
single **Calendar** tab that supports five view modes:

1. **Schedule** — chronological list, scroll up for past, down for future.
2. **Day** — one day; swipe left/right to change days.
3. **3-day** — three consecutive days starting today; swipe to next/prev triple.
4. **Week** — 7 days starting on the user's chosen week-start day.
5. **Month** — Google Calendar-style grid with habit chips in each cell.

References: [WIREFRAMES.md](WIREFRAMES.md), [CONTEXT.md](CONTEXT.md),
[HISTORY_PLAN.md](HISTORY_PLAN.md), [HISTORY_DENSITY_PLAN.md](HISTORY_DENSITY_PLAN.md).

## Goals

1. One place to see and act on habits across past, present, and future.
2. A view per use-case: dense overview (month), focused day (day/3-day),
   weekly planning (week), continuous timeline (schedule).
3. Same interactions across all views: tap to complete, long-press to edit.
4. Preserve every existing behavior (RRULE expansion, overrides, density
   semantics, no-streak philosophy).

## Non-goals

- A year-view heatmap.
- Color-by-habit blending in month cells (too noisy with multiple habits).
- Cross-day drag-and-drop to reschedule occurrences.
- Calendar import / iCalendar sync (separate feature later).
- Editing habits *in the calendar cells* — still via the long-press → editor flow.

## Tab restructure

Old: `Today · History · Feed · Friends · Me`  → New: **`Calendar · Feed · Friends · Me`** (4 tabs).

Renamed icon (`calendar` SF Symbol). The Today route is gone; deep links to
`/(tabs)` land on the Calendar tab.

## Common architecture

### State

```ts
type ViewMode = 'schedule' | 'day' | '3day' | 'week' | 'month';

type CalendarState = {
  view: ViewMode;
  anchorDate: Date;       // today by default; meaning depends on view
  weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0 = Sunday
  filterHabitId: string | null;
};
```

- `view` defaults to **Day** on first open. *(Open question — see below.)*
- `anchorDate` defaults to today; updates on swipe gestures or via header arrows.
- `weekStart` lives on the user's profile (new column or settings JSON); defaults to **Sunday** (US convention).
- `filterHabitId` carries over from current History.

State is local to the screen (not persisted) for v1, except `weekStart` which
is server-side on the profile. *(Open question on persistence — see below.)*

### Header

```
┌──────────────────────────────────────┐
│  ‹   May 13, 2026   ›       ⋯  ▾    │
│  filter chip   ·   today button      │
└──────────────────────────────────────┘
```

- Center: dynamic label based on view (`Wed, May 13` for day, `May 13 – 15`
  for 3-day, `May 11 – 17` for week, `May 2026` for month).
- `‹` / `›` arrows: step by view's unit (1 day, 3 days, 1 week, 1 month).
  Schedule view hides arrows.
- `▾` opens the view-switcher sheet.
- `⋯` keeps the habit filter chip + a "Today" jump-to-today action.

### View switcher

A sheet (`Modal presentationStyle="pageSheet"`) listing all five views as
radio rows. Same component pattern as the existing month-picker / habit-filter.

### Data layer

Generalize the existing `fetchMonth` to a range-based query:

```ts
// lib/calendar-data.ts (or extend lib/history.ts)
export async function fetchRange(userId, fromIso, toIso): Promise<{
  completions: CompletionWithHabit[];
  overrides: HabitOverride[];
}>;
```

Each view computes its visible date range and calls `fetchRange`. `buildDayGroups`
already takes an arbitrary `daysInRange: string[]`, so it works for any view.

## View detail

### 1. Schedule view

Continuous chronological agenda. Today's date acts as the anchor; the user
can scroll up to revisit past days or down to peek at upcoming ones. Date
headers stick to the top while scrolling within a day.

```
┌──────────────────────────────────────┐
│ Tue · May 12                         │
│  ✓ Meditate         7:08 AM          │
│                                      │
│ Wed · May 13   ← today               │
│  ✓ Meditate         7:02 AM          │
│  ○ Stretch          3:00 PM          │
│                                      │
│ Thu · May 14                         │
│  ○ Meditate         7:00 AM          │
└──────────────────────────────────────┘
```

- Initial render: ~14 days (today − 7 to today + 7).
- Scroll near top → load 7 more days before; near bottom → load 7 more after.
- Empty days included with "No completions" placeholder (past) or "Nothing
  scheduled" placeholder (future).
- Today's section header is visually emphasized.

### 2. Day view

A single day at a time, with horizontal swipe to change days. The richest
view for tap-to-complete.

```
┌──────────────────────────────────────┐
│  ‹  Wed · May 13                  ›  │
├──────────────────────────────────────┤
│ Morning                              │
│  ◯ Meditate         7:00 AM          │
│                                      │
│ Afternoon                            │
│  ✓ Take vitamin   1:00 PM            │
│  ○ Stretch          3:00 PM          │
└──────────────────────────────────────┘
```

- Use **react-native-pager-view** for buttery horizontal swipe.
- Render a windowed pager: 5 pages (anchor ±2), shifted on swipe.
- Each page is a single-day agenda (same row layout as Schedule view).
- Time-of-day grouping (`Morning` / `Afternoon` / `Evening`) per WIREFRAMES.md
  screen 1. Per-time-of-day section headers.

### 3. 3-day view

Three days side by side. Today is the **leftmost** day on initial render
(per the user's spec). Swipe advances by 3 days.

```
┌──────────────────────────────────────┐
│  ‹  Wed 13  |  Thu 14  |  Fri 15  ›  │
├──────────────────────────────────────┤
│ ○ Med   7AM │ ○ Med   7AM│ ○ Med  7AM│
│ ○ Stretch  │           │ ○ Yoga 5PM │
│ 3PM        │           │             │
└──────────────────────────────────────┘
```

- Three flex-1 columns side by side.
- Each column is a vertical scroll of that day's rows.
- Swipe horizontally → advance by 3 days at a time.
- Pager pages = triples (not individual days).

### 4. Week view

Seven days, starting on the user's chosen week-start day. Swipe by week.

```
┌──────────────────────────────────────┐
│  ‹  May 11 – 17                  ›   │
├──────────────────────────────────────┤
│ Sun│Mon│Tue│Wed│Thu│Fri│Sat          │
│ ○  │○○ │○  │○○○│○  │○○ │○            │
│ ✓  │✓  │✓  │✓  │   │   │             │
└──────────────────────────────────────┘
```

- Seven flex-1 columns.
- Each column: vertically scrollable list of that day's rows.
- Swipe horizontally → next/prev week.
- Week-start setting: `weekStart` (0–6) determines the first column.

### 5. Month view

Full calendar grid like Google Calendar: 6 weeks × 7 days; each cell shows
the date number plus up to 3 habit chips and "+N" if more.

```
┌──────────────────────────────────────┐
│  ‹  May 2026                     ›   │
├──────────────────────────────────────┤
│  S    M    T    W    T    F    S     │
│           1    2    3                │
│  ●Med ●Med  ●Med ●Med ●Med           │
│  ●Vit       ●Vit  +2                 │
│                                      │
│ 4    5    6    7    8    9   10      │
│ ...                                  │
└──────────────────────────────────────┘
```

- Each cell: date number top-left + 0-3 habit chips (color swatch + short title) + "+N" overflow.
- Today: a ring around the cell (same as our current density-calendar today indicator).
- Selected day: heavier ring.
- Tap a cell → switch to **Day view** anchored on that day.
  *(Open question — could also expand inline.)*
- The **density fill** from the previous feature is **dropped** in month
  view, since the chips already communicate activity at a glance.
  *(Open question — could be kept as a subtle background.)*

## Cross-view interactions

| Interaction               | Schedule | Day | 3-day | Week | Month |
|---------------------------|----------|-----|-------|------|-------|
| Tap row → complete/uncomplete | ✓    | ✓   | ✓     | ✓    | —     |
| Long-press row → edit habit   | ✓    | ✓   | ✓     | ✓    | —     |
| Tap "+ Add habit" FAB or header button | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tap a date cell           | n/a      | n/a | n/a   | n/a  | → Day view |
| Filter chip               | ✓        | ✓   | ✓     | ✓    | ✓     |

For the **Add habit** action, a floating-action button (FAB) bottom-right
works across all views. Replaces the inline "+ Add habit" rows on the
existing Today screen.

## Data flow

1. Each view computes its `daysInRange: string[]`.
2. Screen calls `fetchRange(userId, fromIso, toIso)` for the wider window.
3. `buildDayGroups(daysInRange, habits, completions, overrides, today)` produces day groups.
4. Each view renders its slice.

Reuse of existing logic:
- `expandHabit` — same.
- `buildDayGroups` — same.
- `completionCountByDate`, `densityBucket` — only used in month view (if we keep the subtle density).
- New: `weekDatesFrom(anchorDate, weekStart)` → 7 dates.
- New: `nDayRange(anchorDate, n)` → n dates starting from anchorDate.

## Settings — week start

A new "Week starts on" row in the Me tab. Stores on `profiles.week_start`
(new column, smallint 0–6). Migration adds the column with default 0 (Sun).

For v1, fall back to local default (0) if column doesn't exist yet.

## Phasing

Ship in order; each phase is a usable milestone.

**Phase A — restructure + Day view + Month view**
- Tab change (drop Today/History, add Calendar).
- View switcher sheet (functional, all 5 listed; non-Day non-Month show "Coming soon" stubs).
- Day view (with pager-view swipe).
- Month view (with chips).
- `fetchRange` data helper.

**Phase B — Schedule view + 3-day + Week view + week-start setting**
- Schedule view with infinite scroll.
- 3-day view (pager pages of triples).
- Week view (pager pages of weeks).
- `profiles.week_start` migration + Me-tab setting row.

**Phase C — polish**
- Sticky day headers in Schedule view.
- Today indicator in Schedule view that follows scroll.
- View-mode persistence in `AsyncStorage` (so reopens land on last view).
- Long-press menu (skip / reschedule / edit) inside day/3-day/week views.

## Tests (TDD)

In `lib/__tests__/calendar.test.ts`:

- `nDayRange(anchor, n)` returns n consecutive ISO dates starting from anchor.
- `weekDatesFrom(anchor, weekStart)` returns the 7 dates of the week containing anchor.
- `weekDatesFrom` rolls the week boundary correctly with different `weekStart`s.

Plus snapshot tests are out — UI is verified in Expo Go.

## Open questions

1. **Default view on first open**: Day, Schedule, or remember last-used?
   *Answer: Day. Most users want "what's today" first.*

2. **Add-habit affordance**: floating action button (FAB) in the bottom-right,
   or a top-right "+" in the header?
   *Answer: FAB. Stays consistent across views regardless of header layout.*

3. **Schedule view scroll vs day-jump**: should the header arrows be hidden
   in Schedule view (since it's continuous), or should they jump by week?
   *Answer: hide arrows entirely in Schedule view — the "Today" button covers the common jump case.*

4. **Month view cell tap**: open Day view for that day, or expand the cell
   inline?
   *Answer: switch to Day view — the inline list in the cell is already a summary. but there should be a back arrow to take the user back to month view*

5. **Month view density background**: keep the purple density fill underneath
   the chips, or drop it?
   *Answer: drop it. The chips communicate activity; the fill adds visual noise.*

6. **Week-start persistence**: server-side on `profiles.week_start`, or
   client-side in AsyncStorage?
   *Answer: server-side. Survives device changes; trivial migration.*

7. **Tap-to-complete in month view**: not supported (cells too small) — agreed?
   *Answer: agreed. Users tap a cell to open Day view, complete there.*

8. **Schedule view boundary on first load**: today ± 7 days, ± 14, or further?
   *Answer: ± 7 days. Enough to feel populated; cheap fetch. but should fetch more as the user scrolls up or down*

9. **Should the existing **density-fill** behavior live anywhere in the new
   tab, or is it superseded by the new views?
   *Answer: superseded. We can preserve `completionCountByDate` and `densityBucket`
   for a future "year heatmap" view but not surface them in v1 of this work.*

10. **The current "Me" sign-out screen** is the only thing in Me beyond a
    placeholder. Should the Week-start setting be the first real Me-tab
    feature, or should we build a small settings sub-page?
    *Answer: a single row directly on Me for now. We can extract to a settings sub-screen when there are more rows.*

11. **Edit-scope modal** flow needs `occurrenceDate` for "this only" /
    "this and future". This carries forward fine in Day/3-day/Week/Schedule
    (each row knows its date). Month view doesn't allow editing, so n/a.
    *Confirmation, not really a question.*

## Acceptance criteria

- [ ] Tab bar shows `Calendar · Feed · Friends · Me`; Today and History routes are gone.
- [ ] Opening the app lands on the default view (per Q1).
- [ ] View switcher (▾) lists all five views; tapping one switches.
- [ ] **Schedule**: scroll up loads past days; scroll down loads future days; today's section header is visually emphasized.
- [ ] **Day**: horizontal swipe advances by 1 day; arrows in header do the same.
- [ ] **3-day**: shows today + 2 future days on first open; swipe right shows the next 3 days.
- [ ] **Week**: respects user's chosen week-start; swipe right → next week.
- [ ] **Month**: shows up to 3 habit chips per cell + "+N" overflow; tap a cell → Day view.
- [ ] Tap-to-complete and long-press-to-edit work in Schedule, Day, 3-day, Week.
- [ ] Habit filter still scopes everything.
- [ ] Week-start setting persists on profile.
- [ ] No streak language, no completion-rate stats.
- [ ] All existing tests still pass; new tests for `nDayRange` and `weekDatesFrom` go green.
