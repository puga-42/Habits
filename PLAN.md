# Plan: Remove display_name; handle is the sole user name

## Problem
The app has two name fields — `handle` (unique, user-editable) and
`display_name` (non-unique, set from Apple name on signup). We want
handle to be the only user-facing name. Search already works by handle.

## Approach

### 1. Migration — drop display_name from profiles + update all DB objects
New migration that, in order:
- Replaces `handle_new_user()` trigger to stop inserting `display_name`.
- Replaces `friend_feed` view to drop `owner_display_name`.
- Replaces `fetch_feed_page()` to drop `owner_display_name` from return.
- Replaces `fetch_comments_page()` to drop `author_display_name` from return.
- Replaces `fetch_likers_page()` to drop `display_name` from return.
- Replaces `search_profiles()` to drop `display_name` from return.
- Replaces `fetch_friends_page()` — cursor/sort on `(handle, id)` instead
  of `(display_name, id)`.
- Replaces `fetch_friend_requests_page()` to drop `display_name` from return.
- Drops `display_name` column from `profiles`.

### 2. Client types + lib
- `lib/profile.ts` — remove `display_name` from `Profile` type;
  delete `validateDisplayName`, `updateDisplayName`, related types.
- `lib/feed.ts` — remove `owner_display_name` from `FeedItem`,
  `author_display_name` from `Comment`, `display_name` from `Liker`;
  update `postComment` select to stop fetching `display_name`.
- `lib/friends.ts` — remove `display_name` from `FriendProfile`;
  change `FriendCursor` to `{ handle: string; id: string }`;
  update `mergeFriendsPages` sort to compare by `handle`;
  update `fetchFriendsPage` cursor param; update `sendFriendRequest`
  join select; update `mapRequestRows`.

### 3. UI components — show @handle everywhere
- `feed-avatar.tsx` — rename prop `displayName` → `handle`.
- `feed-card.tsx` — show `@{owner_handle}` as primary name.
- `friend-row.tsx` — show `@{handle}` only; use handle in removal alert.
- `friend-search-result-row.tsx` — show `@{handle}` only.
- `friend-request-row.tsx` — show `@{handle}` only.
- `feed-comment-row.tsx` — pass handle to avatar.
- `likers/[kind]/[id].tsx` — show `@{handle}` only.
- `me.tsx` — remove display name row, editor modal, state, handler.
- `friends.tsx` — update cursor to use `handle` instead of `display_name`.

### 4. Edge function
- `notify-on-friend-request/index.ts` — select `handle` instead of
  `display_name`; use `@handle` in notification body.

### 5. Tests (TDD — update tests first, then make them pass)
- `profile.test.ts` — delete `validateDisplayName` describe block.
- `friends.test.ts` — remove `display_name` from `makeProfile`,
  update sort assertions for handle-based ordering.
- `feed.test.ts` — remove display_name fields from fixtures.

### 6. Docs
- `CONTEXT.md` — update data model sketch and onboarding section.

## Constraints
- No modification of existing migration files — new migration only.
- 19 files touched (exceeds 10-file guideline; unavoidable for a
  cross-cutting removal — splitting would leave broken intermediate states).
- No new npm dependencies.
