# Plan: User Profile Page

**Goal:** When a user taps an avatar or handle anywhere in the app, navigate to
a profile page showing that user's enlarged avatar, habits (as filter chips),
mutual friends, and completion feed. Viewing your own profile shows the same
page others see (Me tab remains for settings).

---

## Design

### Layout (ScrollView header + FlatList)

```
┌─────────────────────────────┐
│        ┌──────────┐         │
│        │  Avatar  │  96px   │
│        └──────────┘         │
│         @handle             │
│     [ Friends ✓ ]           │  ← status badge + action btn
│    3 mutual friends ○○○     │  ← overlapping avatars
├─────────────────────────────┤
│  6 habits                   │
│ [All] [Meditate🧘] [Gym💪]… │  ← horizontal chip scroll
├─────────────────────────────┤
│  ┌─ FeedCard ─────────────┐ │
│  │ completed Meditate 🧘  │ │  ← reuses existing FeedCard
│  │ 📸 attachment carousel │ │
│  │ ❤ 3   💬 1             │ │
│  └────────────────────────┘ │
│  ┌─ FeedCard ─────────────┐ │
│  │ ...                    │ │
│  └────────────────────────┘ │
│         ⏳ load more        │
└─────────────────────────────┘
```

### Sections

1. **Hero** — enlarged `FeedAvatar` (96px), `@handle`, friendship
   status/action button, overflow menu (block/report for non-self).
2. **Mutual friends** — overlapping avatar row + count label. Hidden when
   viewing self or when no mutual friends exist.
3. **Habit chips** — horizontal FlatList. First chip is "All" (selected by
   default). Each subsequent chip shows habit icon + title, colored by the
   habit's color. Tapping a chip filters the feed to that habit's lineage.
4. **Completion feed** — paginated, reverse-chronological. Reuses
   `FeedCard` / `FeedActivityCard`. Same like/comment/report interactions.
   Filtered by selected chip (or all if "All" selected).

### Key interactions

- **Friendship button** — states: "Add friend" / "Request sent" (cancel) /
  "Friends" (remove). Hidden when viewing self.
- **Chip filter** — selecting a chip re-fetches feed filtered to that
  habit's `lineage_id`. "All" resets to unfiltered.
- **Self-view** — same page layout, no friendship controls. Gives users a
  preview of how they appear to friends.
- **Overflow** — block user, report user (non-self only).

---

## Data Requirements

### New Supabase RPCs

1. **`get_user_profile_page(p_target_id, p_viewer_id)`** — returns profile
   row + friendship status enum (`'none' | 'friends' | 'request_sent' |
   'request_received'`) + friends_since timestamp + mutual friend count.
   Returns empty if blocked.

2. **`get_user_visible_habits(p_target_id, p_viewer_id)`** — habits the
   viewer can see. Self: all non-deleted. Friend: public + friends-only.
   Non-friend: public only. Blocked: empty. Returns: id, lineage_id,
   title, icon, color, kind.

3. **`get_user_feed_page(p_target_id, p_cursor, p_limit,
   p_habit_lineage_id)`** — like `fetch_feed_page` but scoped to one
   owner. Optional lineage filter for chip selection. Same visibility/RLS
   rules as the main feed.

4. **`get_mutual_friends(p_user_a, p_user_b, p_limit)`** — returns profile
   rows (id, handle, avatar_url) of users who are friends with both.

### Existing code reused (no changes)

- `likeCompletion / unlikeCompletion / likeActivity / unlikeActivity`
- `postComment / fetchComments`
- `sendFriendRequest / acceptFriendRequest / removeFriend / blockUser`
- `FeedCard`, `FeedActivityCard`, `FeedActionBar`, `FeedCommentsSheet`
- `FeedAvatar` (used at larger size)

---

## Implementation — Single PR (14 files, exceeds 10-file limit by design)

> **Note:** Combined into one PR for end-to-end testability. The page is
> not useful without navigation hookups, and the hookups can't be tested
> without the page.

### New files (7)

| # | File | Description |
|---|------|-------------|
| 1 | `supabase/migrations/2026XXXX_user_profile_rpcs.sql` | All four RPCs above |
| 2 | `app/lib/user-profile.ts` | TS wrappers + types: `fetchUserProfile()`, `fetchUserHabits()`, `fetchUserFeedPage()`, `fetchMutualFriends()`, friendship status type |
| 3 | `app/lib/__tests__/user-profile.test.ts` | Tests for pure helpers (cursor building, type narrowing, empty-state guards) |
| 4 | `app/components/user-hero.tsx` | Large avatar, handle, friendship badge + action button, overflow menu |
| 5 | `app/components/user-habit-chips.tsx` | Horizontal chip row with "All" default, colored per-habit chips, selection state |
| 6 | `app/components/mutual-friends-row.tsx` | Overlapping avatars + "N mutual friends" label |
| 7 | `app/app/user/[id].tsx` | Screen: orchestrates hero + chips + feed FlatList, pagination, chip filtering, comments sheet |

### Modified files (7)

| # | File | Description |
|---|------|-------------|
| 8 | `app/app/_layout.tsx` | Add `user/[id]` to root stack navigator |
| 9 | `app/components/feed-avatar.tsx` | Add optional `onPress` prop, wrap in `Pressable` when set |
| 10 | `app/components/feed-card.tsx` | Pass `onPress` to avatar + make handle tappable → `router.push(/user/${id})` |
| 11 | `app/components/feed-activity-card.tsx` | Same avatar/handle tap → user page |
| 12 | `app/components/feed-comment-row.tsx` | Avatar/handle tap → user page |
| 13 | `app/components/friend-row.tsx` | Row tap → user page |
| 14 | `app/components/friend-search-result-row.tsx` | Row tap → user page |

---

## Risks & Mitigations

- **200-line file limit:** Screen file is the most at risk. Mitigated by
  extracting hero, chips, and mutual-friends into dedicated components.
  The screen orchestrates state + renders a FlatList with header.
- **RPC complexity:** `get_user_feed_page` mirrors existing `fetch_feed_page`
  with an added `owner_id` filter. Copy-and-modify, not generalize.
- **No new npm deps:** All UI uses RN primitives + expo-image.
- **Visibility correctness:** All filtering is server-side in RPCs + RLS.
  The client never sees data the viewer shouldn't access.
- **Gamification guard:** No stats, streaks, or completion rates on the
  profile page. Chips show only title + icon + color. Feed shows
  individual completions as discrete events.
- **Blocked users:** RPCs return empty result sets for blocked users. The
  screen shows an empty/not-found state.

---

## Open Questions

1. Should the profile show "Joined [date]" metadata? (Answer: no)
2. Tapping the mutual friends row — open a full list modal, or just show
   names inline as a tooltip? (Answer: open a full list modal and allow for tapping on those users)
3. When viewing yourself, should there be a small "Settings" link to the
   Me tab? (Answer: no)
