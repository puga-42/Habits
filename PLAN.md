# Issue #7 — Custom handle

## Problem
Users cannot change their handle. Auto-generated handles (random strings) make it
hard for friends to find each other by handle.

## Approach
Smallest viable slice: expose handle editing from the Me tab.

## Files changed (≤ 10)
1. `app/lib/profile.ts` — add `validateHandle` (pure) and `updateHandle` (mutation)
2. `app/lib/__tests__/profile.test.ts` — new file; TDD `validateHandle`; smoke-tests `updateHandle`
3. `app/app/(tabs)/me.tsx` — add an inline edit-handle row (same optimistic-update pattern as week_start)

## No new migration needed
The `handle` column already exists on `profiles` with:
- `citext unique not null`
- `CHECK (handle ~ '^[a-zA-Z0-9_]{3,30}$')`

The DB enforces uniqueness and format server-side. The client adds a lightweight
guard so the user sees a friendly message before the round-trip.

## Validation rules (mirrors DB CHECK constraint)
- 3–30 characters (after trim)
- Only `a-zA-Z0-9_`
- Uniqueness is enforced by the DB; a Postgres 23505 error is surfaced as
  "Handle already taken."

## Constraints honoured
- No streaks, no gamification.
- No new npm dependencies.
- All new functions tested in `lib/__tests__/profile.test.ts`.
