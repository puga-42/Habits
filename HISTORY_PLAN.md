# History — feature plan

Plan for the **History** tab, the primary backward-looking surface of the app.
This document is for review before any code; once we agree, we'll implement.

Reference: [WIREFRAMES.md](WIREFRAMES.md) screen 2 (History) and
[CONTEXT.md](CONTEXT.md) for vocabulary and the no-streak design stance.

## Goals

1. Let the user look back at their completed habits over **weeks and months**.
2. Show a **calendar grid** of activity density at a glance.
3. Show a **per-day agenda** of which specific habits were completed (or
   explicitly skipped) on each day.
4. Surface **overrides** correctly: edited occurrences show the patched title,
   skipped occurrences are visible as skipped.
5. Preserve the no-streak / no-completion-rate stance from CONTEXT.md.

## Non-goals (out of v1 scope)

- **Streaks, completion rate, or any aggregate stat.** None.
- Search by note text.
- Date-range filters beyond a single month at a time.
- Editing a completion from history (defer to Completion detail screen).
- Bulk operations (delete many, etc.).
- Export to CSV / share.
- Viewing a friend's history (a future Profile screen will surface this).

## UX

Layout follows wireframe screen 2:

```
┌──────────────────────────────────────┐
│ ←  History               May 2026 ▾  │
├──────────────────────────────────────┤
│   S    M    T    W    T    F    S    │   ← month grid
│                  1    2    3    ·    │
│   4    5    6    7    8    9   10    │
│  11   12  ◉13   14   15   16   17    │
│  18   19   20   21   22   23   24    │
│  25   26   27   28   29   30   31    │
│                                      │
│ Filter:  ● All habits             ▾  │   ← per-habit filter chip
│                                      │
│ Wed · May 13                         │   ← agenda group
│   ✓ Meditate         7:02 AM  📝    │
│   ✓ Take vitamin     1:05 PM        │
│                                      │
│ Tue · May 12                         │
│   ✓ Meditate         7:08 AM        │
│   —  Walk dog       (skipped)       │
│                                      │
├──────────────────────────────────────┤
│  Today   History   Feed  Friends  Me │
└──────────────────────────────────────┘
```

Interactions:

- **Month label `May 2026 ▾`** opens a month/year picker.
- **Tap a day on the grid** → highlights that day and scrolls the agenda to it.
- **Each agenda row** is tappable (no-op in this slice; opens Completion
  detail later).
- **Filter chip** opens a habit picker; selecting one habit filters both the
  calendar dots and the agenda to that habit.
- **Pull-to-refresh** refetches the current month.

## Data model and queries

We fetch one month at a time. For the visible month range
`[firstOfMonth, firstOfNextMonth)`:

1. **Completions** in range:
   ```ts
   supabase
     .from('habit_completions')
     .select('*, habits!inner(id, title, icon, color, kind)')
     .eq('owner_id', userId)
     .gte('occurrence_date', firstOfMonth)
     .lt('occurrence_date', firstOfNextMonth)
     // For flex completions we also need period_start in range — combined via .or()
   ```
2. **Overrides** of kind `'skip'` in range, so we can render skipped
   occurrences in the agenda. (Edit/reschedule overrides also apply, but
   they're only meaningful at render time — see "Overrides handling".)
3. **All habits the user owns** (cached) — needed to look up title/icon/color
   for completions whose habits were renamed/recolored *after* the completion.

We rely on RLS to scope to the current user (already in place). No new
indexes needed — existing `habit_completions_owner_idx` + `created_at` are
sufficient.

## Components

| File | Role |
| --- | --- |
| `app/app/(tabs)/history.tsx` | Screen root: header, month picker, calendar, agenda. |
| `app/components/history-calendar.tsx` | Month grid with density dots per day. |
| `app/components/history-agenda.tsx` | Vertical list of day groups + completion rows. |
| `app/components/month-picker.tsx` | Sheet for picking month/year (or arrows). |
| `app/components/habit-filter.tsx` | Sheet for picking habit to filter by. |
| `app/lib/history.ts` | Queries (`fetchMonth`), shaping helpers. |

The agenda row is a flat, narrow row mirroring Today's row styling so the
two views feel consistent.

## Calendar density dots

Each day on the grid shows a small dot **if any completion exists that day**.
We will NOT show streak indicators, longest-streak markers, or "miss"
indicators. A future polish could scale the dot's opacity by count (1 dot
vs 3 dots in a day), but this is optional and easy to add later.

The currently-selected day is highlighted with a ring/background.

## Overrides handling

When rendering a day's agenda, layer overrides onto completions the same way
Today does:

- **`skip` override** for `(habit_id, occurrence_date)` → show a "—" row
  with `(skipped)` label. (Yes, we want to surface skips — they're real
  data the user explicitly recorded.)
- **`edit` / `reschedule` override** → render with patched title/icon/color/time.

For **flex completions**, each completion is its own discrete event on its
`completed_at` date; we group those into the day's agenda by `completed_at`
local date.

## Habit deletion handling

A habit can be soft-deleted (`deleted_at` set). Historical completions still
reference it. We **do show** completions of deleted habits in history (their
title is preserved on the joined row). They render normally, just without a
way to edit the habit going forward.

## Performance

- One month fetched at a time. Each fetch returns ~30 days × ~5 completions
  per day worst case = ~150 rows; trivial.
- Cache fetched months client-side (Map of `YYYY-MM` → fetched data) so
  paging back and forth between adjacent months is instant.
- Refetch the current month on focus (same pattern as Today's `useFocusEffect`).

## Empty state

When the visible month has zero completions:

> No completions this month. Tap **Today** to mark a habit done.

Friendly, no shame, no "you broke your streak" copy.

## Phasing (what's in this slice vs deferred)

In this slice:

1. Month calendar grid with density dots.
2. Default to current month; "‹" / "›" arrows to step months.
3. Agenda list grouped by day.
4. Skip overrides surfaced inline.
5. Edit/reschedule overrides applied at render time.
6. "All habits" filter chip (the picker itself can be a v1.1 polish — see
   open questions).
7. Empty-state copy.

Deferred to follow-ups:

- Month/year picker sheet (use arrows only for now — quick MVP).
- Habit filter sheet (chip stub only — non-interactive until v1.1).
- Tapping an agenda row to open Completion detail (that screen doesn't
  exist yet).
- Density-scaled dots (1, 2, 3-dot variants).

## Open questions to resolve before code

These are the decisions I'd like your input on:

1. **Skipped occurrences in agenda**: include inline ("— Walk dog (skipped)"),
   or hide? *Answer: include — it's data the user recorded.*

2. **Calendar day tap**: scroll agenda to that day, OR filter agenda to just
   that day (collapse others)? *Answer: scroll-to (less disruptive).*

3. **Month navigation in v1**: prev/next arrows only, or also a tap-to-pick
   month sheet? *Answer: both arrows and tap-to-pick.*

4. **Habit filter in v1**: ship the chip with a working picker, or stub the
   chip and ship the picker in v1.1? *Answer: we want a working picker.*

5. **Days with zero completions in agenda**: hide entirely (only show days
   with activity), or show as "Wed · May 13 — no completions"? *Answer: show as no completions.*

6. **Color usage in agenda rows**: show a small habit-color swatch on the
   left of each row, or no color (icon + title is enough)? *Answer: small
   swatch — adds visual scan-ability and uses the color field that's
   otherwise only visible at create time.*

7. **Visible month default when revisited later in the day**: always current
   month, or remember last-viewed month within the session? *Answer: always
   current month on first mount; user can navigate from there.*

8. **Skipped-but-no-completion handling for *future* dates**: do we render
   "future" days at all in the current-month view (May 13 onward)?
   *Answer: yes — show the date cells but leave them un-dotted; the agenda
   only includes past days.*

## Acceptance criteria

This slice is done when:

- [ ] Navigating to the History tab shows the current month with a grid.
- [ ] Days I've completed habits on have a visible marker on the grid.
- [ ] Below the grid I can see a day-by-day list of what I completed.
- [ ] An occurrence I skipped via "this only / skip" shows as skipped.
- [ ] An occurrence I edited via "this only" shows the patched title/icon/time.
- [ ] Stepping back a month with "‹" loads the prior month.
- [ ] Pulling to refresh reloads.
- [ ] An empty month shows the empty-state copy.
- [ ] No streak language, no completion-rate stats appear anywhere.
