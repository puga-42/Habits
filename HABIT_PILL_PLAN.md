# Habit-Pill Redesign — Feature Plan

## Goal

Replace the dense list-row look in Day (and any agenda surface that uses
`AgendaRow`) with substantial **pill-shaped item cards**: rounded corners,
dedicated leading-icon area filled with the habit's color, title + optional
description, and a trailing completion/progress indicator.

## Decisions locked in

| Decision | Choice |
| --- | --- |
| Habit color usage | Leading-icon background (circle fill behind the emoji) |
| Flex trailing element | Mini ring chart filling toward target |
| Inline extras | Description only (no time-of-day, no completion timestamp) |

## Visual spec

### Full pill (Day view default)

```
┌──────────────────────────────────────────────────┐
│ ╭────╮                                           │
│ │ 🧘 │   Meditate                            ○   │
│ ╰────╯   10 min mindful breathing                │
└──────────────────────────────────────────────────┘
        ↑
   habit.color
```

### Completed (scheduled)
```
┌──────────────────────────────────────────────────┐
│ ╭────╮                                           │
│ │ 🧘 │   Meditate                            ✓   │   ← title at 70% opacity;
│ ╰────╯   10 min mindful breathing                │     check is habit color
└──────────────────────────────────────────────────┘
```

### Skipped
```
┌──────────────────────────────────────────────────┐
│ ╭────╮                                           │
│ │ 🧘 │   ~~Meditate~~                        —   │   ← whole pill at 50%;
│ ╰────╯   ~~10 min mindful breathing~~            │     title struck through
└──────────────────────────────────────────────────┘
```

### Flex completion (mini ring trailing)
```
┌──────────────────────────────────────────────────┐
│ ╭────╮                                          ◐│   ← ring fill = 2/3 of
│ │ 🏋 │   Gym                                     │     this week (period
│ ╰────╯   3× per week                             │     target)
└──────────────────────────────────────────────────┘
```

## Layout details

| Element | Value |
| --- | --- |
| Pill border-radius | 18pt |
| Pill background | `rgba(127,127,127,0.06)` light / `rgba(255,255,255,0.04)` dark (theme-aware) |
| Pill padding | 12pt vertical, 14pt horizontal |
| Inter-pill spacing | 10pt (no dividers — gaps between pills) |
| Leading-icon circle | 40pt diameter, fill = `habit.color` (fallback neutral gray), emoji 22pt centered |
| Title | 16pt, weight 600 |
| Description | 13pt, weight 400, theme-text @ 55% opacity, 1-line truncated, only renders when set |
| Trailing area | 22pt slot for marker/ring, right-aligned |
| Marker (○/✓/—) | 18pt; check in habit color when completed |
| Ring chart (flex) | 18pt outer, ~3pt stroke, fill = habit.color over neutral track |

## State styles

| State | Pill opacity | Title | Trailing |
| --- | --- | --- | --- |
| Scheduled (not done) | 100% | full | `○` |
| Completed (scheduled) | 100% | 70% opacity | `✓` in habit color |
| Skipped | 50% | strikethrough | `—` |
| Flex completion | 100% | full | mini ring (% of target) |

## Data changes

1. **Expand `AgendaHabit`** in `app/lib/history.ts` to include
   `description: string | null`. Threaded automatically by `buildDayGroups`
   since the master habit already has it.
2. **New pure helper** in `app/lib/history.ts`:
   ```ts
   export function flexProgressByHabit(
     habits: Habit[],
     completions: CompletionWithHabit[],
     today: Date,
   ): Map<string, { count: number; target: number }>
   ```
   For each flex habit, finds the current period boundary (`day` / `week` /
   `month`) and counts completions whose `period_start` equals that boundary.
   Pure function → unit-tested with red→green discipline.
3. **Thread the map** through the view components (Day, 3day, Schedule) into
   `AgendaRow` as an optional prop.

## Component API

```ts
type Props = {
  row: AgendaRowT;
  onPress?: () => void;
  onLongPress?: () => void;
  // New: per-habit period progress for flex rows. AgendaRow renders the ring
  // when row.kind === 'completion' && row.isFlex && progress is provided.
  flexProgress?: { count: number; target: number };
  // New: compact mode for narrow surfaces (3day columns). Hides description,
  // shrinks the leading icon to 32pt, drops pill height.
  compact?: boolean;
  isActive?: boolean;
};
```

## Files to change

| File | Change |
| --- | --- |
| `app/lib/history.ts` | Add `description` to `AgendaHabit`; add + test `flexProgressByHabit` |
| `app/lib/__tests__/history.test.ts` | Tests for `flexProgressByHabit` (day/week/month periods, multiple habits, zero count, completion outside period) |
| `app/components/agenda-row.tsx` | Full visual rewrite — pill shape, leading icon circle, title + description, trailing marker/ring |
| `app/components/calendar-day-view.tsx` | Remove divider lines from the list, add pill gap; pass `flexProgressByHabitId` map |
| `app/components/calendar-3day-view.tsx` | Pass `compact={true}` to AgendaRow in column rendering |
| `app/components/calendar-schedule-view.tsx` | Same pill spacing treatment (kept in sync even though hidden) |
| `app/app/(tabs)/index.tsx` | Compute `flexProgressByHabit(...)` memoized map; pass through to views |

## Tests

- `flexProgressByHabit` — full red→green coverage. Cases: daily target counted
  today only; weekly target with completions in/out of current week; monthly
  target; multiple flex habits independent; scheduled habits ignored;
  zero-completion period.
- AgendaRow visual is not unit-tested (matches existing pattern — components
  aren't tested in this repo).

## Risks / trade-offs

1. **Vertical density drops**: pill height ~72pt with description vs ~44pt
   today. Fewer habits visible per screen — user scrolls more. This is the
   deliberate trade for "habits feel like items not list rows."
2. **3day columns are tight**: even with `compact={true}` and no description,
   pills with leading-icon circles may still feel cramped. If it doesn't work
   on device, fallback is to disable the pill shape (just-text rows) in 3day.
   Plan delivers the compact variant first and we tune from there.
3. **Theme integration**: the proposed pill background (`rgba(127,127,127,0.06)`)
   is a flat color, not theme-aware via `useThemeColor`. If you want full
   light/dark theme support, we'd add a new color token (e.g., `surface`) in
   `Colors.ts` and use `useThemeColor` like `ThemedView` does. Easy follow-up.
4. **Drag-to-reorder still works** but the visual feedback might feel different
   on pills (the floating shape with a 10pt gap below). Worth a device pass.
5. **Habit color contrast**: emoji inside a saturated background circle should
   be fine since emojis carry their own color. If a habit has color similar to
   its emoji (e.g., a yellow habit with 🌞), it may visually muddle. Not
   blocking; a future enhancement could add a subtle white inner ring around
   the emoji.

## What's NOT in scope

- **Feed view** — doesn't exist yet (CONTEXT.md says social v1 features); this
  plan only covers Day, 3day, Schedule(hidden) views.
- **Showing flex habits as "to-do" rows** before any completion exists.
  Currently flex habits only appear in the agenda once they've been completed
  at least once in that period. Surfacing them as tap-to-log rows is a
  separate UX decision.
- **Time-of-day inline** (opted out).
- **Completion timestamp inline** (opted out).
- **Tap-the-trailing-circle-to-mark-done** as a separate tap target — the whole
  pill remains one tap target wired to `onPress`. We can split tap zones later
  if needed.

## Open knobs to adjust before implementation

- Pill background — flat `rgba(127,127,127,0.06)` or wire up a theme-aware
  `surface` color token now? Answer: flat for now.
- Skipped pill opacity — 50% feels right; could go 35% if you want them more
  clearly de-emphasized. Answer: 50% is good for now.
- Habit-color contrast on the leading-icon circle — keep emoji as-is, or have
  AgendaRow tint the emoji background by color luminance (light-color → dark
  icon overlay)? Answer: keep emoji as-is for now. don't need that extra work
