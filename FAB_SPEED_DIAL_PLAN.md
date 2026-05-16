# Expanding FAB speed-dial — new habit + feedback

Transform the existing `CalendarFAB` from a single-action button into an
expandable speed-dial that reveals two options ("New habit" and "Feedback")
expanding upward. The "+" icon rotates 45deg to become "x" when expanded. A
dimmed backdrop covers the screen and dismisses on tap.

## Decisions locked in (from clarifying questions)

| Decision | Choice |
| --- | --- |
| Feedback action | **In-app feedback form** — modal screen with text input, stored in a `feedback` Supabase table. |
| Option style | **Icon + text label** — each action item shows a small icon and a short label. |
| Dismiss behavior | **Backdrop dimming** — semi-transparent overlay; tapping anywhere on it collapses the FAB. |

## Visual spec

```
┌──────────────────────────────────────┐
│                                      │
│           (dimmed backdrop)          │
│                                      │
│                                      │
│                  ┌─────────────────┐ │
│                  │  💬  Feedback   │ │
│                  └─────────────────┘ │
│                  ┌─────────────────┐ │
│                  │  ＋  New habit  │ │
│                  └─────────────────┘ │
│                        ┌────┐        │
│                        │  × │        │  ← rotated "+"
│                        └────┘        │
└──────────────────────────────────────┘
```

- "New habit" is closest to the FAB (primary action).
- "Feedback" is above it.
- Action items are right-aligned, expanding upward from the FAB.

## Architecture overview

The `FabSpeedDial` component replaces `CalendarFAB` in the calendar screen. It
manages expanded/collapsed state internally and accepts an `actions` array prop
so additional items can be added in the future without changing the component.

Animations use `react-native-reanimated` (already in deps). The feedback form
is a new modal screen backed by a simple Supabase table.

## New files

| File | Role |
| --- | --- |
| `app/components/fab-speed-dial.tsx` | Expandable FAB with backdrop, rotation animation, and staggered action items. |
| `app/app/feedback.tsx` | In-app feedback form screen (modal presentation). |
| `app/lib/feedback.ts` | `submitFeedback(text)` — validates and inserts into `feedback` table. |
| `app/lib/__tests__/feedback.test.ts` | Tests: non-empty validation, char-limit boundary, success path. |
| `supabase/migrations/20260516000000_feedback_table.sql` | Creates `feedback` table with RLS. |

## Changed files

| File | Change |
| --- | --- |
| `app/app/(tabs)/index.tsx` | Replace `<CalendarFAB>` with `<FabSpeedDial>`. Pass actions array. Remove `CalendarFAB` import. |
| `app/app/_layout.tsx` | Add `feedback` screen to root Stack (modal presentation). |

## Component: `FabSpeedDial`

### Props

```ts
type FabAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

type Props = {
  actions: FabAction[];
};
```

### State and animation

- `expanded` boolean toggled by tapping the main FAB button.
- Reanimated shared values:
  - `rotation`: `withSpring(expanded ? 45 : 0)` — rotates the "+" to "x".
  - `backdropOpacity`: `withTiming(expanded ? 1 : 0, { duration: 200 })`.
  - Per-action `translateY` and `opacity`: staggered `withSpring` from hidden (0 offset, opacity 0) to final position. Each item offsets ~70px above the previous.

### Layout

```
<View style={StyleSheet.absoluteFill} pointerEvents={expanded ? 'auto' : 'box-none'}>
  {/* Backdrop — only receives touches when expanded */}
  <Pressable onPress={collapse}>
    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
  </Pressable>

  {/* Action items — positioned above the FAB */}
  {actions.map((action, i) => (
    <Animated.View style={[styles.actionRow, animatedItemStyle(i)]}>
      <Pressable onPress={() => { action.onPress(); collapse(); }}>
        {action.icon}
        <Text>{action.label}</Text>
      </Pressable>
    </Animated.View>
  ))}

  {/* Main FAB button */}
  <Pressable onPress={toggle}>
    <Animated.View style={[styles.fab, { transform: [{ rotate: rotationDeg }] }]}>
      <Text style={styles.plus}>+</Text>
    </Animated.View>
  </Pressable>
</View>
```

### Action item styling

- Pill-shaped: `borderRadius: 24`, horizontal padding 16, height 48.
- Background: white (light) / `#1c1c1e` (dark), matching system theme.
- Shadow: same as the main FAB but lighter (`shadowOpacity: 0.12`).
- Icon: 20px, in the app's purple (`#7c3aed`).
- Label: 14px, medium weight, primary text color.
- Right-aligned: items are `position: 'absolute'`, `right: 24`, bottom computed per index.

### Dismiss behavior

- Tap backdrop → `collapse()`.
- Tap main FAB → `toggle()`.
- Tap an action → fire `onPress`, then `collapse()`.

## Feedback form: `app/app/feedback.tsx`

### Layout

```
┌──────────────────────────────────────┐
│  Cancel    Send Feedback       Submit │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────────┐│
│  │ What's on your mind?            ││
│  │                                  ││
│  │                                  ││
│  └──────────────────────────────────┘│
│                                      │
│                          1,847/2,000 │
└──────────────────────────────────────┘
```

### Behavior

- Header: "Send Feedback" title. Cancel (left) dismisses. Submit (right) validates and sends.
- Body: multiline `TextInput`, placeholder "What's on your mind?", 2000 char max.
- Character count shown when >1800 chars (same pattern as completion note editor).
- Submit disabled when body is empty or whitespace-only.
- On success: dismiss modal, show brief success toast.
- On error: show inline error, keep form open.

## Schema: `feedback` table

```sql
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
```

No admin read policy in this migration — admin access is via the Supabase
dashboard or a future admin panel.

## `app/lib/feedback.ts`

```ts
import { supabase } from './supabase';

export const MAX_FEEDBACK_LENGTH = 2000;

export type FeedbackValidationError =
  | { kind: 'empty' }
  | { kind: 'too_long'; max: number; actual: number };

export function validateFeedback(body: string): FeedbackValidationError | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { kind: 'empty' };
  if (trimmed.length > MAX_FEEDBACK_LENGTH)
    return { kind: 'too_long', max: MAX_FEEDBACK_LENGTH, actual: trimmed.length };
  return null;
}

export async function submitFeedback(body: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, body: body.trim() });
  if (error) throw error;
}
```

## Tests: `app/lib/__tests__/feedback.test.ts`

- `validateFeedback` — empty string → `{ kind: 'empty' }`.
- `validateFeedback` — whitespace-only → `{ kind: 'empty' }`.
- `validateFeedback` — exactly 2000 chars → `null` (valid).
- `validateFeedback` — 2001 chars → `{ kind: 'too_long' }`.
- `validateFeedback` — normal input → `null`.

## Wiring in `index.tsx`

```tsx
import { FabSpeedDial } from '@/components/fab-speed-dial';
import { Ionicons } from '@expo/vector-icons';

// Inside the component render, replacing <CalendarFAB onPress={...} />:
<FabSpeedDial
  actions={[
    {
      key: 'new-habit',
      label: 'New habit',
      icon: <Ionicons name="add-circle-outline" size={20} color="#7c3aed" />,
      onPress: () => router.push('/habit/new'),
    },
    {
      key: 'feedback',
      label: 'Feedback',
      icon: <Ionicons name="chatbubble-outline" size={20} color="#7c3aed" />,
      onPress: () => router.push('/feedback'),
    },
  ]}
/>
```

## Animation timing

| Animation | Type | Config |
| --- | --- | --- |
| "+" rotation (0 → 45deg) | `withSpring` | `damping: 12, stiffness: 180` |
| Backdrop opacity (0 → 0.4) | `withTiming` | `duration: 200, easing: Easing.out(Easing.ease)` |
| Action item translate + opacity | `withSpring` | `damping: 14, stiffness: 160`, stagger delay 50ms per item |
| Collapse (all reversed) | Same curves | Reverses naturally by targeting 0 values |

## Phasing (implementation order)

1. **`app/components/fab-speed-dial.tsx`** — the animated component. Hardcode two placeholder actions for manual testing.
2. **Wire into `app/app/(tabs)/index.tsx`** — replace `CalendarFAB`. Confirm "New habit" action still works.
3. **Migration** — `supabase/migrations/20260516000000_feedback_table.sql`.
4. **`app/lib/feedback.ts`** + **`app/lib/__tests__/feedback.test.ts`** — validation and submit logic.
5. **`app/app/feedback.tsx`** — the feedback form screen.
6. **`app/app/_layout.tsx`** — add feedback route (modal presentation).
7. **Manual test** — expand/collapse, backdrop dismiss, both actions navigate, feedback submits.

## Acceptance criteria

- [ ] Tapping FAB expands two labeled options upward with a staggered spring animation.
- [ ] The "+" rotates 45deg to "x" during expansion.
- [ ] Semi-transparent backdrop appears behind the action items.
- [ ] Tapping backdrop collapses the FAB (with reverse animation).
- [ ] Tapping the FAB button itself toggles expanded/collapsed.
- [ ] "New habit" navigates to `/habit/new` (identical to current behavior).
- [ ] "Feedback" navigates to the feedback form modal.
- [ ] Feedback form enforces non-empty body and 2000 char limit.
- [ ] Submitting feedback inserts a row and dismisses the modal.
- [ ] Collapsing reverses all animations smoothly.
- [ ] FAB remains in the same visual position as the current implementation (bottom-right).
- [ ] All existing tests pass; new feedback validation tests pass.

## Risks / trade-offs

1. **Full-screen overlay container** — `FabSpeedDial` renders a `StyleSheet.absoluteFill` view to capture backdrop taps. When collapsed, `pointerEvents="box-none"` ensures it doesn't intercept touches meant for content below. This is the standard pattern for speed-dials but must be rendered last in the parent to layer correctly (already the case with `CalendarFAB`).
2. **Two items today, N tomorrow** — the `actions` array makes the component generic. Adding a third action (e.g., "Quick complete") later requires zero changes to the component itself.
3. **No haptic on expand** — can add `Haptics.impactAsync(ImpactFeedbackStyle.Light)` if desired; omitted to keep the interaction lightweight.
4. **Feedback is write-only for users** — users can submit but not view/edit past feedback. Intentional for v1; an admin reviews via the Supabase dashboard.
5. **CalendarFAB not deleted** — the old component file is left in place since it's a separate cleanup concern. It will have no imports after this work.
