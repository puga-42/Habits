# Configurable default habit visibility with bulk update option

## Issue
#11 — Users want: (1) the default visibility for new habits changed from
Private to Public; (2) a setting to choose their preferred default visibility
(Public / Friends / Private); (3) a bulk-update option to apply that preference
to all existing habits retroactively.

## Approach
1. Add `default_visibility` column to `profiles` (migration, default `'public'`).
2. Expose `updateDefaultVisibility` in `lib/profile.ts`.
3. Add `bulkUpdateHabitVisibility` in `lib/habits.ts`.
4. Export `defaultDraft(vis?: Visibility)` from `lib/habit-form.tsx`; accept
   `defaultVisibility` prop in `HabitFormProvider` so new habits start with
   the user's preference.
5. `habit/_layout.tsx` loads the profile and passes `default_visibility` to
   the Provider; the form reflects the preference without a separate network
   call in the form screen.
6. `me.tsx` gains a "Habits" settings section with a "Default visibility" row.
   Tapping opens a `pageSheet` modal with radio options and an
   "Apply to all existing habits" button.

## Files changed
- `supabase/migrations/20260518100000_add_default_visibility.sql` (new)
- `app/lib/profile.ts` — add `default_visibility` field + `updateDefaultVisibility`
- `app/lib/habits.ts` — add `bulkUpdateHabitVisibility`
- `app/lib/habit-form.tsx` — export `defaultDraft`, add `defaultVisibility` prop
- `app/app/habit/_layout.tsx` — load profile, pass `defaultVisibility`
- `app/app/(tabs)/me.tsx` — add default visibility settings section
- `app/lib/__tests__/habit-form.test.ts` — tests for `defaultDraft`

## No new npm dependencies.

## Validation
`cd app && npm run typecheck && npm run lint && npm run test`
