# WIREFRAMES

Low-fidelity ASCII wireframes for the key screens. Phone-width frames.
Annotations use the vocabulary from [CONTEXT.md](CONTEXT.md).

Five tabs across the bottom: **Today · History · Feed · Friends · Me**.

---

## 1. Today

The home screen. Shows the user's own scheduled occurrences due today, grouped
by time-of-day, plus an at-a-glance row for each flex habit's progress this
period. No streaks. No completion rate.

```
┌──────────────────────────────────────┐
│ Today    Wed · May 13         ⚙   ↗  │
├──────────────────────────────────────┤
│ Morning                              │
│  ◯ Meditate                 7:00 AM  │
│  ◯ Walk dog                 7:30 AM  │
│                                      │
│ Afternoon                            │
│  ● Take vitamin   1:00 PM    add ›   │
│  ◯ Stretch                  3:00 PM  │
│                                      │
│ Flex this week                       │
│  Gym                ● ● ○   2 of 3   │
│  Read 30 min      ○ ○ ○ ○   0 of 4   │
│                                      │
│         [  +  add habit  ]           │
│                                      │
├──────────────────────────────────────┤
│  Today   History   Feed  Friends  Me │
└──────────────────────────────────────┘
```

- Tap a circle to mark the occurrence completed (writes to `habit_completions`).
- A completed item shows an inline `add ›` affordance; if it already has
  attachments it shows their kinds instead (e.g. `📷 📝 ›`).
- Tapping a completed item opens **Completion detail** (screen 3).
- Long-press an item → edit / skip / reschedule (triggers the **edit scope modal**, screen 6).
- The "+" opens the **habit editor** (screen 4).

---

## 2. History

The primary backward-looking surface. A month grid up top; tap any day to expand
the agenda below. Each entry shows what was completed (or explicitly skipped via
an override), with attachment indicators. No "X% completed" anywhere.

```
┌──────────────────────────────────────┐
│ ←  History               May 2026 ▾  │
├──────────────────────────────────────┤
│   S    M    T    W    T    F    S    │
│                  1    2    3    ·    │
│   4    5    6    7    8    9   10    │
│  11   12  ◉13   14   15   16   17    │
│  18   19   20   21   22   23   24    │
│  25   26   27   28   29   30   31    │
│                                      │
│ Filter:  ● All habits             ▾  │
│                                      │
│ Wed · May 13                         │
│   ✓ Meditate         7:02 AM  📷📝  │
│   ✓ Take vitamin     1:05 PM   📷   │
│   ✓ Gym              6:30 PM   🎥   │
│                                      │
│ Tue · May 12                         │
│   ✓ Meditate         7:08 AM        │
│   —  Walk dog       (skipped)       │
│                                      │
├──────────────────────────────────────┤
│  Today   History   Feed  Friends  Me │
└──────────────────────────────────────┘
```

- Calendar dots can be density-coded (more dots = more completions that day) — never a streak indicator.
- Filter chip drops down a habit picker.
- Icons next to a row indicate context: `📷` photo, `🎥` video, `📝` note (a non-empty note on the completion).
- Tap a row → **Completion detail** (screen 3).
- Skipped entries come from `habit_overrides` of kind `skip`.

---

## 3. Completion detail

Where users add and review the photos, videos, and text notes attached to a
single completion. Reached by tapping any completed item on Today, History, or
Feed (own posts only — friends' completions on Feed open a read-only view).

```
┌──────────────────────────────────────┐
│ ←  Meditate · Wed May 13       ⋯    │
├──────────────────────────────────────┤
│ Completed 7:02 AM                    │
│                                      │
│ Attachments                          │
│ ┌────────┐  ┌────────┐  ┌────────┐  │
│ │  📷    │  │  🎥    │  │   +    │  │
│ │ photo  │  │  0:18  │  │  add   │  │
│ └────────┘  └────────┘  └────────┘  │
│                                      │
│ Note                                 │
│ ┌──────────────────────────────────┐ │
│ │ Felt restless today; tried       │ │
│ │ box-breathing for the last 5 min.│ │
│ └──────────────────────────────────┘ │
│                                      │
│       [ + photo ]   [ + video ]      │
│                                      │
│ Visibility                           │
│   ●  Same as habit (friends)         │
│   ◯  Only me                         │
│  ⓘ  Override can only narrow.        │
│                                      │
└──────────────────────────────────────┘
```

- Tap any attachment tile → full-screen viewer with swipe between tiles.
- Long-press a tile → delete (hard-deletes the row and the Storage object; no undo).
- The "+" tile and the bottom row are equivalent entry points to attach.
- The **note** field is always present and editable inline (tap to edit); up to 2000 chars. One note per completion.
- Camera/photo picker uses the OS sheet; video uploads are validated client-side against the 30 s / 50 MB cap before upload.
- The **Visibility** control only narrows: the radio options are derived from the parent habit's visibility (`public` → friends/private; `friends` → private; `private` → no override possible, control is hidden).
- Read-only friend view: hides the bottom action row, the "+" tile, long-press, the note editor (note is read-only), and the visibility control; shows a `⋯` with **Report content** and **Block user**.

---

## 4. Habit editor (new / edit)

One screen creates either kind of habit. Toggling **Scheduled** vs **Flex**
swaps the middle section.

```
┌──────────────────────────────────────┐
│ ←  New habit                   Save  │
├──────────────────────────────────────┤
│ Title                                │
│ ┌──────────────────────────────────┐ │
│ │ Meditate                         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Kind                                 │
│   [  Scheduled  ] [    Flex     ]   │
│                                      │
│ ─ Scheduled fields ───────────────── │
│  Time            7:00 AM         ›   │
│  Repeats         Every weekday   ›   │
│  Starts          May 13, 2026    ›   │
│  Ends            Never           ›   │
│                                      │
│ ─ (or) Flex fields ──────────────── │
│  Target          3 times             │
│  Per             ◯ day ● week ◯ mo  │
│                                      │
│ Color   ○ ● ○ ○ ○ ○                  │
│ Icon    🧘                            │
│                                      │
│ Visibility                           │
│  ◯ Public      ● Friends   ◯ Private │
│                                      │
│ Notes (optional)                     │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- Switching kinds keeps title/color/icon/visibility/notes; resets the kind-specific fields.
- `Repeats` → screen 5 (recurrence builder).
- On save: if editing, prompt the **edit scope modal** (screen 6) before writing.

---

## 5. Recurrence builder

Opened from `Repeats`. Quick-pick patterns first, custom RRULE last. Always
shows a plain-language preview at the bottom so users know what they're
about to commit to.

```
┌──────────────────────────────────────┐
│ ←  Repeats                     Done  │
├──────────────────────────────────────┤
│ Pattern                              │
│  ◯ Daily                             │
│  ◯ Every weekday                     │
│  ● Specific days of the week         │
│  ◯ Every N days                      │
│  ◯ Monthly                           │
│  ◯ Custom (advanced)                 │
│                                      │
│ Days                                 │
│   S  [M] [T] [W] [T] [F]  S          │
│                                      │
│ Time(s)                              │
│   7:00 AM            [+ add time]    │
│                                      │
│ Preview                              │
│  Every Mon, Tue, Wed, Thu, Fri       │
│  at 7:00 AM                          │
│                                      │
└──────────────────────────────────────┘
```

- Each pattern compiles to an RRULE string stored on the habit.
- Multiple times per day = multiple BYHOUR/BYMINUTE entries, producing multiple occurrences per day.
- "Custom (advanced)" exposes a raw RRULE text field for power users.

---

## 6. Edit scope modal

The signature calendar-event behavior. Surfaces every time the user edits or
deletes a scheduled habit that has a recurrence rule.

```
       ┌────────────────────────────────┐
       │       Edit "Meditate"          │
       ├────────────────────────────────┤
       │                                │
       │  Apply changes to:             │
       │                                │
       │   ◯  This occurrence only      │
       │   ●  This and future           │
       │   ◯  All occurrences           │
       │                                │
       │      [ Cancel ]   [ Apply ]    │
       │                                │
       └────────────────────────────────┘
```

Maps to CONTEXT.md edit semantics:
- **This occurrence only** → insert `habit_overrides` row.
- **This and future** → close current habit's RRULE with `until`, insert new habit row sharing `lineage_id`.
- **All** → mutate master `habits` row.

Same modal is reused for delete, with the action button labeled "Delete."

---

## 7. Feed

Reverse-chronological stream of friends' completions, filtered server-side
by RLS. Instagram-style cards with inline media. Each card celebrates the
act, not a streak.

```
┌──────────────────────────────────────┐
│ Feed                            🔔   │
├──────────────────────────────────────┤
│ ●  Maya · @maya_b · just now   ⋯   │
│    completed Meditate  🧘            │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │      [ photo: sunrise ]          │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ "5am club. quiet morning."           │
│                                      │
│ ────────────────────────────────── │
│                                      │
│ ●  Tom · @tomc · 10 min ago    ⋯    │
│    completed Gym  🏋                 │
│    3 of 3 this week ✓                │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │     [ video · 0:18 · ▶ ]         │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ────────────────────────────────── │
│                                      │
│ ●  Sara · @s_lopez · 1 hr ago  ⋯    │
│    completed Walk dog  🐕            │
│                                      │
├──────────────────────────────────────┤
│  Today   History   Feed  Friends  Me │
└──────────────────────────────────────┘
```

- Cards with attachments take more vertical space; cards without are compact one-liners.
- Photo + video render inline; multiple attachments become a swipeable carousel inside the card.
- Flex habits show "X of N this period ✓/—" — an objective period summary, not a streak.
- Tap card body → opens a read-only **Completion detail** (screen 3) for that friend's completion.
- `⋯` opens: **Report content**, **Block user**, **Mute this habit** (the App Store-required content controls).
- Empty state when user has no friends: a single CTA to find friends.

---

## 8. Friends

```
┌──────────────────────────────────────┐
│ Friends                       [  +  ]│
├──────────────────────────────────────┤
│ 🔍 Search by handle                  │
│                                      │
│ Requests (2)                         │
│ ┌──────────────────────────────────┐ │
│ │ @alex_p              [✗]  [✓]    │ │
│ │ @running_rachel      [✗]  [✓]    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Friends                              │
│  ●  Maya         @maya_b         ›   │
│  ●  Tom          @tomc           ›   │
│  ●  Sara         @s_lopez        ›   │
│                                      │
├──────────────────────────────────────┤
│  Today   History   Feed  Friends  Me │
└──────────────────────────────────────┘
```

- "+" opens add-friend by handle.
- Requests row supports accept (creates friendship) or decline (deletes request).
- Long-press a friend → block/remove options.

---

## 9. Profile (own & friend)

Same layout for self and friend. Friend view hides any habit with
`visibility = 'private'` and respects blocks. Self view has an edit affordance
on every row.

```
┌──────────────────────────────────────┐
│ ←  Maya                         ⋯    │
├──────────────────────────────────────┤
│            ┌────────┐                │
│            │   🖼   │                │
│            └────────┘                │
│            Maya Brown                │
│            @maya_b                   │
│                                      │
│ Habits                               │
│  🧘  Meditate            scheduled   │
│  📖  Read 30 min         flex 4/wk   │
│  🚶  Walk                scheduled   │
│                                      │
│ Recent activity                      │
│  Today                               │
│   ✓ Meditate              📷         │
│  Yesterday                           │
│   ✓ Read 30 min                      │
│   ✓ Walk                  📝         │
│                                      │
└──────────────────────────────────────┘
```

- Own profile adds: handle editor, sign-out, account deletion (App Store requirement), notification preferences.
- Friend profile `⋯` adds: **Block** / **Remove friend** / **Report user**.
- Tap a recent-activity row → **Completion detail** (screen 3), read-only for friends.

---

## Cross-cutting notes

- Time-of-day is rendered in the habit's stored `timezone`. Default for new habits is the device's timezone at creation.
- All "completion" interactions are optimistic with rollback on RLS rejection.
- Realtime updates the Feed and a friend's profile in place; Today is local-first and doesn't need Realtime.
- Attachment uploads happen in the background after the completion is written — the user can navigate away while a photo or video uploads. Failed uploads surface a single retry banner; they do not block any other interaction.
- Feed empty-state, friend-list empty-state, and history empty-state copy intentionally avoid streak/loss language ("get back on track," "don't break the chain," etc.).
