# Plan: Show habit creation in the social feed

**Issue:** The social feed only surfaces completions. Friends don't know when
someone starts a new habit. Adding a "habit created" feed event improves social
visibility and encourages engagement.

**Decisions (confirmed):**
- Full interactions (likes + comments) on habit-created cards.
- Creator sees their own card in the feed.
- Always insert the activity row, even for private habits — RLS hides it.
- Postgres trigger on `habits` INSERT creates the activity row automatically.

---

## Architecture

### Current state

The feed is completion-only. `fetch_feed_page` queries `habit_completions`
joined to `habits` and `profiles`. Likes and comments FK to `completion_id`.
The client `FeedItem` type is completion-shaped. `FeedCard` renders a single
layout: "@handle completed Habit".

### New state

The feed becomes a **union of two event kinds**: completions and habit-created
activities. A `feed_kind` discriminator (`'completion' | 'habit_created'`)
tells the client which card to render.

Because activity items need their own likes/comments, we add parallel
`activity_likes` and `activity_comments` tables (same shape as the completion
versions). This avoids touching existing completion interaction tables or
their RLS policies.

---

## Steps (7 files changed)

### 1. Migration: expand `20260518400000_habit_created_activity.sql`

The draft migration already creates `habit_activity` with RLS. Extend it with:

- **Trigger** `trg_habit_created_activity` on `public.habits` AFTER INSERT:
  inserts one row into `habit_activity` with `event_type = 'created'`.
- **`activity_likes`** table — mirrors `completion_likes` schema and RLS
  (FK to `habit_activity(id)` instead of `habit_completions(id)`).
  RLS: can like if `can_view_activity(uid, activity_id)`; delete own likes.
- **`activity_comments`** table — mirrors `completion_comments` schema and
  RLS. Same 1-500 char constraint. Author + activity-owner can delete.
- **Helper function** `can_view_activity(viewer_id, activity_id)` — returns
  true when the viewer is allowed to see the activity row (reuses the
  visibility + friendship + block logic from the existing RLS policy, but
  extracted so likes/comments can reference it).
- **Updated `fetch_feed_page` RPC** — change the CTE to `UNION ALL`
  completions and activities, ordered by `created_at desc, id desc`. Add a
  `feed_kind text` output column (`'completion'` or `'habit_created'`).
  Activity rows return `NULL` for completion-specific fields
  (`occurrence_date`, `period_start`, `completed_at`, `note`,
  `visibility_override`, `attachments`). They carry `like_count`,
  `comment_count`, and `viewer_liked` from the activity tables.
- **`fetch_activity_comments_page` RPC** — same shape as
  `fetch_comments_page` but queries `activity_comments`.
- **Update `fetch_likers_page`** — extend `like_target_kind` enum with
  `'activity'` and add a third UNION arm for `activity_likes`.

### 2. Client types — `app/lib/feed.ts`

- Add `feed_kind: 'completion' | 'habit_created'` to `FeedItem`. Make
  completion-specific fields (`completed_at`, `occurrence_date`, etc.)
  nullable to accommodate activity items.
- Add `created_at: string` field (used as the sort key for activity items;
  completions already have `completed_at`).
- Add a pure helper `feedItemSortKey(item): string` that returns
  `completed_at` for completions or `created_at` for activities. Update
  `mergeFeedPages` to use it instead of raw `completed_at`.
- Add mutation wrappers: `likeActivity`, `unlikeActivity`,
  `postActivityComment`, `deleteActivityComment`, `fetchActivityComments`.
- Update `FeedCursor` to use the generic sort key.

### 3. Client tests — `app/lib/__tests__/feed.test.ts`

- Test `feedItemSortKey` for both kinds.
- Test `mergeFeedPages` with mixed completion + activity items.
- Test that `applyLikeToggle` works on activity items.

### 4. New component — `app/components/feed-activity-card.tsx`

- Same header layout as `FeedCard` (avatar, handle, relative time, overflow).
- Habit line reads: **"started \<Habit Title\> \<icon\>"** (instead of
  "completed").
- No attachment carousel, no note excerpt (activities have neither).
- Full action bar (likes + comments) — reuses `FeedActionBar`.
- Overflow menu: report, block, mute (same as `FeedCard` minus edit).

### 5. Feed screen — `app/app/(tabs)/feed.tsx`

- `renderItem` checks `item.feed_kind`:
  - `'completion'` → `<FeedCard />`
  - `'habit_created'` → `<FeedActivityCard />`
- Update `subscribeToFeed` to also listen to `habit_activity` inserts for
  the new-item pill.
- `FeedCommentsSheet` needs to accept either a `completionId` or an
  `activityId` and call the right comment-fetch/post functions.

### 6. Action bar — `app/components/feed-action-bar.tsx`

- Rename `completionId` prop to a generic `targetId` + `targetKind`
  (`'completion' | 'activity'`). Call the right like/unlike function based
  on kind.

### 7. Comments sheet — `app/components/feed-comments-sheet.tsx`

- Accept `targetKind` + `targetId` instead of only `completionId`.
- Dispatch to `fetchComments` or `fetchActivityComments` based on kind.
- Same for `postComment` / `postActivityComment`.

---

## What this plan does NOT include

- **Push notifications** for habit creation events — can be added later via
  an edge function similar to `notify-on-friend-request`.
- **Realtime for activity likes/comments** — the existing Realtime
  subscription pattern can be extended in a follow-up.
- **Activity card editing** — there's nothing to edit on a "started X" card.
- **Backfilling** existing habits — only new habits created after the
  migration will appear in the feed.

---

## File count: 7

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/20260518400000_habit_created_activity.sql` | Expand |
| 2 | `app/lib/feed.ts` | Edit |
| 3 | `app/lib/__tests__/feed.test.ts` | Edit |
| 4 | `app/components/feed-activity-card.tsx` | **New** |
| 5 | `app/app/(tabs)/feed.tsx` | Edit |
| 6 | `app/components/feed-action-bar.tsx` | Edit |
| 7 | `app/components/feed-comments-sheet.tsx` | Edit |
