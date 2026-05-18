# Plan: Allow users to set a display name; fix inconsistent name display

Issue #9

## Problem
- `profiles.display_name` is auto-generated (e.g. `user_d5xxxx`) on sign-in.
- Users have no way to edit it.
- Friend search shows the raw auto-generated display name above `@handle`,
  which looks like an internal identifier.
- The user's own profile page (Me tab) does not show the display name at all,
  making the inconsistency visible: others see a weird name; you can't see or fix it.

## Approach
No migration needed — `display_name text not null` already exists in `profiles`.

### 1. `lib/profile.ts` — add `validateDisplayName` + `updateDisplayName`
- `validateDisplayName(name)`: trim, reject empty, cap at 50 chars.
  Returns `DisplayNameValidation` discriminated union (mirrors `HandleValidation`).
- `updateDisplayName(userId, name)`: calls `validateDisplayName`, then Supabase
  `.update({ display_name })`.

### 2. `lib/__tests__/profile.test.ts` — new tests (TDD first)
- Empty / whitespace → error
- > 50 chars → error
- Valid name → ok
- Trim before validating

### 3. `app/(tabs)/me.tsx`
- Add "Display name" row to the Profile section (below Handle row).
- Shows current `display_name` so users can see the auto-generated value.
- Tapping opens new `DisplayNameEditor` modal (same pattern as `HandleEditor`).
- Optimistic update + revert on error (same pattern as `onSaveHandle`).

## Constraints
- No new npm dependencies.
- No streaks, gamification, or completion-rate copy.
- Max 200 lines per file; me.tsx is currently ~337 lines — adding DisplayNameEditor
  adds roughly 55 lines, staying within limit.
- No migration files modified or created.
