# Fix: Habit detail view clips/crops selected habit icon

## Issue
#12 — When opening an existing habit's detail view, the habit icon (emoji) is
partially clipped/cropped.

## Root cause
In `view.tsx`, `heroIcon` sets `fontSize: 40` with no explicit `lineHeight`.
`ThemedText` with the default type applies `lineHeight: 24` from its base style
— smaller than the 40 px font size. React Native clips text to the lineHeight
bounding box, so tall emoji glyphs are cut off at the top or bottom.

## Fix
Add `lineHeight: 52` to `heroIcon` (≈ 1.3 × fontSize). This gives emoji enough
vertical room to render fully without clipping.

## Files changed
- `app/app/habit/view.tsx` — `heroIcon` style: add `lineHeight: 52`

## Tests
No new pure function is introduced; this is a layout-only style fix. The full
test suite confirms no regressions.

## Validation
`cd app && npm run typecheck && npm run lint && npm run test`
