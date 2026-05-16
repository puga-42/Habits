# Habit pill — gestures + swipe actions

Update how the habit pill (`AgendaRow`) responds to touch:

1. **Tapping the pill body does nothing.** Removes the current "tap-to-complete"
   on the row body. Reserved for an upcoming feature when habit completion
   gains real metric support.
2. **Tapping the trailing icon completes the habit.** That trailing area
   becomes the only completion affordance from the pill. Tap on `✓` is a
   no-op (un-completing moves to the swipe action set).
3. **Swiping the pill left reveals action chips:** Reset, Skip, Hide. Each
   chip is a distinct rectangle pill. Action visibility is context-sensitive
   (see matrix).
4. **Long-press still drags** (per `HABIT_ROWS_PLAN`) — gesture stack stays
   the same; horizontal pan claims the swipe, vertical long-hold claims drag.

Builds on top of:
- `HABIT_PILL_PLAN.md` (visual pill redesign — shipped, commit `ee1626b`).
- `HABIT_ROWS_PLAN.md` (sections + drag-to-reorder).
- `DRAG_FIX_PLAN.md` (gesture-handler + DraggableFlatList resolution).

## Decisions locked in (from clarifying questions)

| Decision | Choice |
| --- | --- |
| Tap on `✓` (completed marker) | **No-op.** Un-completion happens via swipe → Reset. Cleaner separation; deliberately costs an extra gesture. |
| Hide semantics | **Hide for today only** — same lifecycle as a skip override. Restorable from history view. (See "Open question" — Skip vs Hide differentiation.) |
| Action set per row state | **Context-sensitive** — only show actions that apply to the row's current state and habit kind. |
| Gesture stack | Long-press → drag (kept). Swipe-left → reveal actions. Pager horizontal swipe lives at page edges; row swipe claims the row's horizontal pan once started inside the row. |

## Non-goals (this PR)

- **No new habit-completion semantics.** Tap-on-row stays inert; the metric
  redesign is the *next* feature.
- **No edit-from-swipe** — the habit editor opens only from the existing
  long-press menu. Adding "Edit" to swipe widens scope; revisit once metrics
  land.
- **No archive UI / restore-from-trash** — Hide is per-day only; undo lives
  in history view + the toast.
- **No reorder rework.** Drag-and-drop infrastructure is unchanged.
- **No swipe-right (leading-edge) actions** — only trailing (right-edge) chips.
- **No Week-view / Month-view swipe** — those use chips/cells, not the pill.

## The behavior matrix

| Row state | Trailing tap | Reset | Skip | Hide |
| --- | --- | :---: | :---: | :---: |
| Scheduled, open (`○`) | Marks complete | — | ✓ | ✓ |
| Scheduled, completed (`✓`) | No-op | ✓ | — | ✓ |
| Scheduled, skipped (`—`) | No-op | ✓ | — | ✓ |
| Scheduled, hidden | (Row not rendered) | — | — | — |
| Flex, partial ring (n / target) | +1 completion | ✓ (removes most-recent completion in this period) | — | ✓ |
| Flex, full ring (`✓`) | No-op | ✓ (removes one completion) | — | ✓ |

Rules behind the matrix:

- **Reset** undoes the row's most recent state-changing action *for this date*:
  - Completed scheduled → delete the `habit_completion` (existing
    `unmarkCompleted`).
  - Skipped scheduled → delete the `habit_overrides` row of `kind='skip'`.
  - Flex (partial or full) → delete the most-recent completion in this period
    (most-recent `created_at` for the same `period_start`).
- **Skip** is scheduled-only. Inserts `habit_overrides` `(habit_id,
  occurrence_date, kind='skip')`. Disabled (omitted from the chip set) for
  flex rows because flex has no occurrence to skip.
- **Hide** removes the row from today's view. See open question — currently
  the same DB write as Skip; needs differentiation. Always available (it's
  the only per-day "make this go away" option for flex).

## Open question — Skip vs Hide

The two actions resolve to the same DB row today (`habit_overrides` with
`kind='skip'`). Without differentiation, picking one or the other is
identical from the user's perspective on the next render. Two viable
resolutions:

**Option A — Two override kinds.** Extend the `habit_overrides.kind` CHECK
constraint to include `'hide'`. Render rules:
- `kind='skip'` → row stays visible, rendered as `—` with strikethrough
  (existing behavior).
- `kind='hide'` → row is filtered out of `buildDayGroups` entirely.

Both restorable from history view (where we'd surface hidden rows in a
"Hidden" sub-section, paralleling "Completed").

**Option B — One kind, optional `patch.hidden` flag.** Keep `kind='skip'`;
add a sentinel in `patch` (`{ hidden: true }`) that suppresses the row in
agenda output. Avoids a constraint migration but encodes meaning in a JSON
blob.

**Recommendation: Option A.** Constraints are first-class; we already lean
on `kind` everywhere. Migration is a 1-line CHECK update.

I'll proceed with A unless you say otherwise.

## Visual spec — action chips

Each chip is a distinct rectangle pill, equal-width within the swipe drawer,
right-aligned, separated by ~6pt gaps so they read as discrete buttons. iOS
Mail / Messages convention:

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 🟣  Meditate                                                       ✓ │
  └──────────────────────────────────────────────────────────────────────┘
                                ◄── swipe left
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 🟣  Meditate         ✓     │ Reset │ │ Skip  │ │ Hide  │             │
  └──────────────────────────────────────────────────────────────────────┘
```

| Chip | Background | Label color | Rationale |
| --- | --- | --- | --- |
| Reset | neutral gray (`rgba(127,127,127,0.18)`) | label / dark-mode label | Reversible, low-stakes. |
| Skip | amber (`#E0A526` light / system orange dark) | white | "I'm not doing this on purpose" — distinct from "open" but not destructive. |
| Hide | system red | white | Visually says "remove". Same color used for trash. |

- Chip width: 64pt min, 88pt max (auto-fit to label).
- Chip height matches the pill's content height (no taller than the row).
- Drawer total width: sum of visible chips + gaps, capped at ~60% of pill
  width. Beyond cap, swipe doesn't pan further.
- One drawer open at a time — opening another row's drawer closes the
  previous (`Swipeable.close()` on the prior `ref`).
- Tapping the row body while the drawer is open closes the drawer (no state
  change, no tap-through to nothing).

## Trailing complete affordance

The trailing area becomes a real button:

- Hit target: 44×44pt (iOS HIG). Wrap the existing marker (`○ / ✓ / —` or
  `FlexRing`) in a `Pressable` with `hitSlop` to reach the 44pt floor without
  changing the visual size of the marker itself.
- Visual feedback: 0.6 opacity on press (matches existing `pillPressed`).
- Haptic: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on completion
  (we already depend on `expo-haptics`). No haptic on no-op taps.
- Accessibility:
  - `accessibilityRole="button"`.
  - `accessibilityLabel` = "Complete {habit title}" / "Completed" / "Skipped".
  - `accessibilityHint` = "Marks this habit complete for {date}" when
    actionable; absent when no-op.

For flex rows, the trailing button wraps the `FlexRing`. Tap behavior:
- Below target → `markFlexCompleted` (+1 to the period's count).
- At target (full ring + inner `✓`) → no-op.

## UI expert additions (recommended)

These aren't strictly in the user's three asks, but a UI review would flag
them as missing pieces. Ranked roughly by impact.

1. **Undo toast for Hide.** Hide is the only action that makes a row
   disappear; without an in-place "Undo," the only recovery path is the
   history view. Show a small bottom-anchored toast for ~4s with "Hidden —
   Undo." iOS Mail convention. (Reset and Skip don't need this — the row
   stays visible.)

2. **Haptics on swipe-action commit.** `Haptics.notificationAsync(Success)`
   on Reset / Skip; `Haptics.notificationAsync(Warning)` on Hide. Reinforces
   the destructive vs neutral distinction without copy.

3. **Full-swipe = primary action.** If the user keeps swiping past ~60% of
   row width, auto-fire the rightmost chip (Hide) on release. Standard iOS
   Mail pattern. Drawer remains the discoverable path; full-swipe is the
   power-user shortcut.

4. **Auto-close on scroll.** When the user scrolls the list, close any open
   swipe drawer. Otherwise drawers leak between scroll positions and feel
   sticky.

5. **Animate row collapse on Hide.** Layout animation (Reanimated's
   `LinearTransition` or RN `LayoutAnimation`) so the row shrinks out
   instead of vanishing instantly. Confirms the action visually.

6. **Reduced motion respect.** If `AccessibilityInfo.isReduceMotionEnabled()`
   is true, skip the row-collapse animation and the swipe rubber-banding;
   chips snap into place.

7. **Trailing icon disabled-state contrast.** When the trailing tap is a
   no-op (✓ or — state), reduce the marker's opacity slightly (already at
   0.5–0.7 in current styles) and drop the press feedback so users learn it
   isn't actionable.

I'd build 1–4 in this PR and treat 5–7 as polish in a follow-up if scope
creeps.

## Files touched

| File | Change |
| --- | --- |
| `supabase/migrations/<ts>_habit_overrides_hide_kind.sql` | new — extend `habit_overrides_kind_check` to include `'hide'` (Option A). |
| `app/lib/habits.ts` | new mutations: `skipOccurrence(habitId, dateIso)`, `hideOccurrence(habitId, dateIso)`, `unskipOccurrence(habitId, dateIso)`, `unhideOccurrence(habitId, dateIso)`, `unmarkLastFlexInPeriod(habitId, periodStart)`. Update `HabitOverride.kind` union to add `'hide'`. |
| `app/lib/history.ts` | filter out rows whose latest override on that date is `kind='hide'` from `buildDayGroups`. Optionally surface them in a separate `hiddenRows` array on `DayGroup` for the history view. |
| `app/components/agenda-row.tsx` | wrap trailing marker / `FlexRing` in a `Pressable` with `hitSlop`; remove `onPress` from the outer `Pressable` (body becomes inert); keep `onLongPress` for drag. New prop `onTrailingPress`. |
| `app/components/habit-row-swipeable.tsx` | new — wraps `AgendaRow` with `react-native-gesture-handler/ReanimatedSwipeable`. Owns chip rendering, drawer open/close coordination, full-swipe-to-Hide, optional row-collapse animation. |
| `app/components/calendar-day-view.tsx` | render `HabitRowSwipeable` instead of bare `AgendaRow`; wire the open-drawer ref so opening one closes the others; close all drawers on scroll. |
| `app/components/calendar-3day-view.tsx` | same wrap, per column. |
| `app/components/calendar-schedule-view.tsx` | same wrap. |
| `app/components/calendar-week-view.tsx` | week view is a chip layout, not the pill — **no swipe** here. |
| `app/app/(tabs)/index.tsx` | drop `handleRowPress`'s tap-to-complete branch (now no-op); add `handleTrailingPress` that calls `markScheduledCompleted` / `markFlexCompleted`; add `handleSwipeAction(row, action)` that fans out to the new lib helpers + reload + undo-toast. |
| `app/components/undo-toast.tsx` | new — small bottom-anchored toast with timer + Undo button. Driven by a ref / context. (Use the existing safe-area edge inset.) |

## Library

`react-native-gesture-handler` ships `ReanimatedSwipeable` (the v2 successor
to the deprecated `Swipeable`). Already in our deps via
`react-native-reanimated`. No new package needed.

```tsx
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
```

`ReanimatedSwipeable` composes correctly with `DraggableFlatList`'s vertical
pan and with `PagerView`'s horizontal pan because it claims horizontal
gestures only when the touch begins inside its tap area. If pager-edge
conflicts surface in testing, we tune `failOffsetX` / `activeOffsetX` on the
pager's gesture handler so row-swipe wins inside row bounds.

## Tests (TDD)

Pure-function tests (`lib/__tests__/habits-overrides.test.ts`, new):

- `skipOccurrence` upserts a row with `kind='skip'`.
- `hideOccurrence` upserts a row with `kind='hide'`.
- `unskipOccurrence` / `unhideOccurrence` delete the matching override row
  (no-op if absent).
- `unmarkLastFlexInPeriod` deletes the most-recent completion in the period;
  no-op if the period has zero completions.

History-builder tests (extend `lib/__tests__/history.test.ts`):

- Hidden override on a scheduled habit → row absent from the day group.
- Hidden override on a flex habit → row absent from the day group (see open
  question 1).
- Skip override unchanged from current rendering (sanity check).

UI tests (`components/__tests__/agenda-row.test.tsx`, new):

- Tap on row body fires nothing.
- Tap on trailing fires `onTrailingPress`.
- `onLongPress` still propagates from row body for drag.

Swipe interaction is verified manually in Expo Go.

## Open questions (smaller)

1. **Hide on flex habits.** Flex doesn't have an `occurrence_date` — what
   does "Hide for today only" even mean? Two readings:
   - **Hide the flex row from today's day group only**, so it reappears
     tomorrow. We'd insert a hide override with the day's `iso` as
     `occurrence_date` and special-case the lookup for flex habits.
   - **Disallow Hide on flex.** Drop Hide from the chip set for flex rows.
     Cleaner, but inconsistent with the user's "Hide always" intent.

   *Answer: hide-on-flex hides for that day only. Matches user expectation.*

2. **History "Hidden today" surface.** Hide makes the row vanish — the user
   needs a way to find it again. Add a "Hidden" sub-section in the day's
   history view (parallel to "Completed"), or wait for a real history view
   pass?

   *Lean: ship a minimal "Hidden" sub-section in this PR so undo isn't
   trapped behind the toast timeout.*

3. **Chip color in dark mode.** Spec above uses light-mode tints. Need the
   dark-mode equivalents: chip backgrounds at higher opacity, text white.
   Pull from existing `Colors` constants if present; otherwise add three
   chip-specific tokens.

4. **Pager-edge swipe vs row swipe.** A swipe that begins near the right
   edge of a Day-view row could be intended as "page to next day."
   `ReanimatedSwipeable` claims the gesture once horizontal motion crosses
   ~10pt. If users complain, we tune `failOffsetX` / `activeOffsetX` on the
   pager so row-swipe wins inside row bounds.

## Phasing

Single tranche. Order within:

1. Migration + `lib/habits.ts` mutations + override `kind` union update.
2. `history.ts` filter for hidden rows + tests.
3. `AgendaRow` change: trailing button, body inert.
4. `HabitRowSwipeable` wrapper + chip rendering.
5. Wire into Day view; verify in Expo Go.
6. Wire into 3-day + Schedule views.
7. Undo toast + drawer-coordination polish.
8. Haptics, full-swipe-to-Hide, reduced-motion respect.

## Acceptance criteria

- [ ] Tapping the body of a habit pill does nothing (no completion, no
      navigation).
- [ ] Tapping the trailing icon on a scheduled, open row marks it complete;
      the marker flips `○ → ✓`.
- [ ] Tapping the trailing icon on a completed (`✓`) or skipped (`—`) row
      does nothing.
- [ ] Tapping the trailing ring on a flex row below target adds a
      completion; tapping a full ring is a no-op.
- [ ] Long-pressing the row body still initiates drag (existing behavior
      preserved).
- [ ] Swiping a row left reveals a drawer with chip(s); chip set matches
      the matrix.
- [ ] Tapping Reset undoes the row's most recent state-changing action.
- [ ] Tapping Skip on an open scheduled row inserts a skip override; row
      flips to `—` with strikethrough.
- [ ] Tapping Hide on any row removes it from the day's view; an undo toast
      appears for ~4s with an Undo button that restores the row.
- [ ] Opening a swipe drawer on row B closes any open drawer on row A.
- [ ] Scrolling the list closes any open drawer.
- [ ] Trailing tap target measures ≥44×44pt (HIG); marker visual size
      unchanged.
- [ ] No streak language, no completion-rate stats appear.
- [ ] Day-view horizontal pager swipe still works at the page edges; row
      swipe doesn't trigger a page change.
- [ ] All existing TDD tests still pass; new tests cover skip/hide
      mutations and history filtering.
