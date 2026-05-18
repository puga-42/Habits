# Plan: Fix keyboard covering login fields on Android (Issue #1)

## Problem

On Android (reported: Pixel 10 Pro Fold), tapping the email or password input
on the login screen causes the software keyboard to obscure the focused field.
The user cannot see what they are typing.

## Root Cause

`sign-in.tsx` wraps content in `KeyboardAvoidingView` with:

```tsx
behavior={Platform.OS === 'ios' ? 'padding' : undefined}
```

On Android the behavior is `undefined`, so `KeyboardAvoidingView` is a no-op.
The `ScrollView` has nowhere to scroll because the container height never
shrinks to account for the keyboard.

## Fix

1. Export a pure helper `keyboardAvoidingBehavior(os: string)` from
   `app/lib/sign-in.ts` that returns `'padding'` on iOS, `'height'` on
   Android, and `undefined` otherwise.

2. Replace the inline ternary in `sign-in.tsx` with the helper.

Using `'height'` on Android shrinks the `KeyboardAvoidingView` by the keyboard
height, allowing the inner `ScrollView` to scroll the focused field into view.

## Tests

Add unit tests for `keyboardAvoidingBehavior` to
`app/lib/__tests__/sign-in.test.ts` (covers ios / android / web).

## Files Changed

- `app/lib/sign-in.ts` — add `keyboardAvoidingBehavior`
- `app/app/sign-in.tsx` — use the helper in `KeyboardAvoidingView`
- `app/lib/__tests__/sign-in.test.ts` — new tests for the helper

## Constraints Checked

- No new npm dependencies.
- No streaks, completion rates, or gamification.
- Max 200 lines per file: all files remain well under the limit.
- Existing migration files untouched.
