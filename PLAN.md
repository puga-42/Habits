# Post feed activity event when a user creates a new habit

## Issue
#10 — The social feed shows completions but not habit creation events. Friends
should see a card when someone adds a new habit so they can follow along.

## Approach
1. **Migration** — create `habit_activity(id, habit_id, owner_id, event_type,
   created_at)` with RLS mirroring habit visibility rules (public/friends +
   block check).
2. **`createHabit`** — generate the habit id client-side (UUID) and fire-and-
   forget an insert into `habit_activity`. Failure logs a warning but does not
   block the habit creation.
3. **`feed.ts`** — add `HabitActivityItem` type, `CombinedFeedEntry` union,
   `fetchHabitActivityPage`, and the pure helper `mergeHabitActivityIntoFeed`
   (sort by timestamp desc, kind-stable).
4. **`HabitCreatedCard`** component — lightweight card matching the FeedCard
   visual language (avatar, handle, "started tracking <icon> <title>", time).
5. **`feed.tsx`** — load habit activity alongside completions; merge into a
   `CombinedFeedEntry[]` via `useMemo`; render the appropriate card per kind.

## No new npm dependencies.

## Files changed
- `supabase/migrations/20260518200000_habit_created_activity.sql` (new)
- `app/lib/habits.ts` — `createHabit` generates id + inserts activity
- `app/lib/feed.ts` — new types + `fetchHabitActivityPage` + pure merge helper
- `app/lib/__tests__/feed.test.ts` — tests for `mergeHabitActivityIntoFeed`
- `app/components/habit-created-card.tsx` (new)
- `app/app/(tabs)/feed.tsx` — load, merge, render activity items

## Validation
`cd app && npm run typecheck && npm run lint && npm run test`
