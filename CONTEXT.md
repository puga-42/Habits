# CONTEXT

Foundational vocabulary and architecture for the habits app. Per `Claude.md`,
read this before architectural or test work, and use this vocabulary in all
code, tests, and discussions.

## Stack

- **Client:** React Native via Expo (TypeScript). Targets iOS first; App Store launch.
- **Backend:** Supabase (remote project, not local) — Postgres, Auth (Sign in with Apple), Realtime, Storage, Edge Functions.
- **Recurrence:** RFC 5545 RRULE strings, expanded client-side via `rrule.js`.
- **Push:** Expo Notifications (local for reminders, push via Supabase Edge Function for social events).

## Vocabulary

These are the load-bearing terms. Use them exactly.

- **Habit** — a recurring behavior the user wants to track. Two kinds:
  - **Scheduled habit** — RRULE-driven, has occurrences at specific dates/times. Example: "Meditate every weekday at 7am."
  - **Flex habit** — target-driven, no fixed schedule. Has a target count and a period. Example: "Go to the gym 3 times per week."
- **Occurrence** — a specific scheduled date/time of a scheduled habit, derived by expanding the master habit's RRULE in a date window. Occurrences are *computed*, not stored, except where overridden.
- **Completion** — a record that the user did the habit.
  - For a scheduled habit, a completion is tied to a specific occurrence (by `occurrence_date`).
  - For a flex habit, a completion is tied to a period (the week/day it counts toward the target).
- **Override** — a modification to a single occurrence of a scheduled habit: skip, reschedule, or per-occurrence edit (different title/time/note).
- **Lineage** — a chain of master habit rows produced by "this and future" edits, sharing a `lineage_id`. To the user it is one habit; in storage it is N rows, each governing a slice of time.
- **Visibility** — per-habit enum: `public`, `friends`, `private`. Determines whether completions and habit details surface in others' feeds.
- **Friend** — a mutual relationship between two users; both must accept. Symmetric.
- **Friend request** — a pending, directional ask awaiting acceptance.
- **Feed** — the live stream of friends' completions, filtered by each habit's visibility.
- **Block** — a one-way relationship that hides users from each other; required for App Store social compliance.
- **Attachment** — a media file added to a `habit_completion`. Kinds: `photo`, `video`. Multiple attachments per completion are allowed. Files live in Supabase Storage.
- **Note** — a single free-form text field on a `habit_completion` (separate from attachments; one per completion). Up to 2000 characters.

## Data model (sketch)

```
profiles(id, handle, avatar_url, created_at)

habits(
  id, owner_id, lineage_id, kind ('scheduled'|'flex'),
  title, description, color, icon, visibility, timezone,
  -- scheduled-only:
  dtstart, rrule, until,
  -- flex-only:
  target_count, target_period ('day'|'week'|'month'),
  created_at, updated_at, deleted_at
)

habit_overrides(
  id, habit_id, occurrence_date,
  kind ('skip'|'reschedule'|'edit'),
  patch jsonb,   -- new title/time/etc. for 'edit' and 'reschedule'
  created_at
)

habit_completions(
  id, habit_id, owner_id,
  occurrence_date,        -- for scheduled habits
  period_start,           -- for flex habits (e.g., Monday of that week)
  completed_at,
  note,                   -- nullable text, ≤2000 chars
  visibility_override,    -- nullable enum; narrows only (see Visibility)
  created_at, updated_at
)

completion_attachments(
  id, completion_id, owner_id,
  kind ('photo'|'video'),
  storage_path, mime_type, byte_size,
  duration_seconds,       -- nullable; video only
  width, height,
  created_at
)

friendships(user_a, user_b, created_at)  -- user_a < user_b enforced
friend_requests(from_user, to_user, status, created_at)
blocks(blocker_id, blocked_id, created_at)
```

## Edit semantics for scheduled habits

When a user edits or deletes a scheduled habit, they choose one of three scopes:

- **This occurrence only** — insert a row in `habit_overrides` keyed by `occurrence_date`. Master rule untouched.
- **This and following** — set `until` on the current master habit to `occurrence_date - 1 day`. Insert a new `habits` row with the same `lineage_id`, `dtstart = occurrence_date`, and the new fields.
- **All** — mutate the master `habits` row in place. Existing overrides are preserved unless explicitly cleared.

Deletion follows the same three-mode pattern, using `kind='skip'` overrides, an early `until`, or `deleted_at` on the master.

## Visibility + privacy

Privacy is enforced in Postgres via row-level security, not on the client. The rules:

- A user can always read/write their own `habits` and `habit_completions`.
- Each `habit_completion` has an **effective visibility**: its `visibility_override` if set, otherwise the parent habit's `visibility`.
- `visibility_override` can only **narrow** the parent habit's visibility, never widen it. Enforced by a CHECK constraint:
  - habit `public` → override may be `friends` or `private`
  - habit `friends` → override may be `private`
  - habit `private` → override must be `null`
- Another user can read a habit if **both** hold:
  1. The habit's `visibility` is `public`, or `friends` and they are confirmed friends.
  2. Neither user has blocked the other.
- Another user can read a completion if **both** hold:
  1. The completion's *effective* visibility permits them (same public/friends/private logic as for habits).
  2. Neither user has blocked the other.
- Because override only narrows, every visible completion always has a visible parent habit. No orphan completions in the feed.

The feed is a Postgres view (or query) over `habit_completions` joined to `habits` and `friendships`, with RLS doing the filtering. Supabase Realtime subscribes to inserts on that filtered view.

## Attachments and notes

Each `habit_completion` can carry two kinds of context:

- A **note** — a single free-form text field on the completion itself (≤2000 chars). One per completion.
- Zero or more **attachments** — media files of kind `photo` or `video`, stored in Supabase Storage.

Both are optional, can be added at completion time or retroactively from the
history view, and can be edited or removed at any time.

**Visibility.** Attachments and the note are not separately permissioned; they
follow the *effective* visibility of the parent completion. Setting a
completion's `visibility_override` narrows what friends can see of it,
including its attachments and note. Lowering a habit's visibility immediately
hides every past completion's media and note from feeds and friend profiles —
no snapshotting.

**Storage.**
- Supabase Storage bucket: `completion-media`, private (signed URLs only).
- Path: `{owner_id}/{completion_id}/{uuid}.{ext}`.
- Bucket RLS mirrors `habit_completions` RLS — the viewer must be allowed to read the parent completion.
- Photos: client converts HEIC → JPEG on upload; an Edge Function generates a 256×256 thumbnail.
- Videos: **≤30 seconds, ≤50 MB**, enforced client-side before upload. An Edge Function transcodes to a 480p H.264 version for cross-device playback and extracts a poster frame.

**Feed rendering.** Photos and videos render inline as Instagram-style cards.
The note excerpts to ~2 lines with tap-to-expand. Multiple attachments on the
same completion render as a horizontal carousel within the card.

**Editing.** Users can add or remove attachments and edit the note at any
time. Removing an attachment hard-deletes the row and the underlying Storage
object — no soft-delete, no version history.

## Recurrence

- Store the RRULE as a string. Expand it on the client with `rrule.js` to render calendar/agenda views.
- For server-side needs (e.g., notification scheduling), a worker materializes the next ~30 days into a `scheduled_occurrences` table. We do not pre-materialize the entire future.
- All times stored in UTC; the habit's `timezone` field governs how occurrences are rendered and when reminders fire.

## App Store compliance to remember

- Sign in with Apple is required (since we offer Supabase Auth's third-party providers).
- Social apps need: user blocking, content reporting, and a way to delete the account + data in-app (Guideline 5.1.1(v)).
- A privacy policy URL is required at submission.
- User-generated photos, videos, and notes raise the moderation bar (Guideline 1.2):
  - Every feed item must expose a **report content** affordance.
  - Block must hide the blocked user's attachments, notes, and any future content from them.
  - In-app account deletion must purge `completion_attachments` rows, notes, **and** the underlying Storage objects (not just orphan them).
  - We commit to acting on reported content within 24 hours; bake an admin review path into the moderation pipeline before submission.

## Stats and history (resolved)

The app intentionally has **no streaks and no completion-rate stats**. Each habit
occurrence is either completed or not; that's the only state. The primary
backward-looking surface is a **history view** — a calendar/agenda showing which
habits the user completed on which days over weeks and months.

For flex habits, a period (week/day/month) is "hit" or "missed" based on whether
the target was reached, but periods are not chained into streaks. The history view
renders each individual completion as a discrete event, with period markers showing
whether the target was met.

Do not propose streak counters, "X day streak," freeze tokens, "X% completion,"
or similar gamification anywhere in UI or copy. Feed entries celebrate the act
("completed Meditate"), not a streak number.

## Notifications (resolved)

Hybrid delivery:

- **Local notifications** for the rolling ~7-day window of upcoming occurrences, scheduled on-device. Works offline, fires instantly, no server cost.
- **Server push** via a daily Supabase Edge Function that refills the device's local notification queue beyond 7 days, and for any social events (friend request, friend completed a public habit you follow closely).
- iOS caps pending local notifications at ~64. The rolling window keeps us well under that.

## Onboarding (resolved)

- Sign in with Apple via Supabase Auth.
- On first sign-in, **auto-generate a handle** (e.g., `user_d5xxxx`). Handle is the sole user name — there is no separate display name.
- User can edit handle from profile. Handle uniqueness enforced at the DB level (unique index + reserved word list).

## Open questions (tracked for later)

- Whether the feed shows friends' completions of **any** non-private habit, or only those marked `public` (vs `friends`). Currently leaning: `public` shows globally + to friends; `friends` shows only to friends; both surface in the friend feed.
- Onboarding tutorial: skip entirely vs a 2-3 screen intro to the three habit-edit modes.
- Time-of-day handling for flex habits (do they have a "by when" reminder, or are reminders scheduled-only?).
- Multiple attachments per completion: max count cap before we force a new completion (lean toward 10 per completion).
- Whether attachments can be reordered within a carousel by the owner.
- Profile avatar storage: separate `avatars` bucket policy.
