# Plan: Guard against null/empty feedback submissions (Issue #5)

## Problem

A feedback submission was received with body = the literal string `null`.
The pipeline triaged it and created a GitHub issue with no actionable content.

## Root Causes

1. `submitFeedback` does not validate internally — it trusts the UI caller to
   have run `validateFeedback` first. Any non-UI path (direct call, test,
   automation) can bypass this and insert invalid data.

2. `validateFeedback` does not guard against a runtime-null argument. If called
   with `null` (e.g. via `as any` cast or from non-TypeScript code), it throws
   instead of returning `{ kind: 'empty' }`.

3. `dispatch-feedback` does not skip records whose body is null or blank before
   calling Claude. A null/empty body wastes API quota and creates noise issues.

## Fix

1. **`lib/feedback.ts` — `validateFeedback`**: coerce `null`/`undefined` to `''`
   via `(body ?? '').trim()` so a runtime-null returns `{ kind: 'empty' }`.

2. **`lib/feedback.ts` — `submitFeedback`**: call `validateFeedback` before
   the DB insert and throw a descriptive error if invalid. Defense in depth.

3. **`supabase/functions/dispatch-feedback/index.ts`**: after claiming the
   record, check if `body` is falsy or blank and skip triage if so.

## Tests (TDD — write failing tests first)

New cases in `lib/__tests__/feedback.test.ts`:
- `validateFeedback(null)` → `{ kind: 'empty' }`
- `submitFeedback('')` → throws 'Feedback cannot be empty.'
- `submitFeedback(body > 2000 chars)` → throws 'Feedback is too long.'
- `submitFeedback` with unauthenticated user → throws 'Not authenticated'
- `submitFeedback` valid input → calls `supabase.from('feedback').insert`
- `submitFeedback` Supabase rate limit error → throws rate limit message

## Files Changed

- `app/lib/feedback.ts`
- `app/lib/__tests__/feedback.test.ts`
- `supabase/functions/dispatch-feedback/index.ts`

## Constraints Checked

- No new npm dependencies.
- No streaks, completion rates, or gamification.
- Max 200 lines per file: all files remain well under the limit.
- Existing migration files untouched.
