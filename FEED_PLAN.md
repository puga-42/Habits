# Feed — Feature Plan

The Feed is the main social surface of the app. A reverse-chronological stream
of friends' (and your own) **habit completions**, with inline photos, videos,
and notes — plus likes and comments. Modeled after the Instagram main feed in
visual feel, but every card celebrates the act, not a streak (per CONTEXT.md).

## Decisions locked in (from clarifying questions)

| Decision | Choice |
| --- | --- |
| Social graph for feed | **Friends only** + self. No one-way "follow" in v1. |
| Reaction style | **Single heart (like)**. One binary like per viewer per completion. |
| Comments | **Flat list.** No threads/replies. |
| Comment interactions | **Likes on comments** (same single-heart model). No replies. |
| Likes list | Tapping "N likes" opens a **likers list screen** showing profiles who liked, paginated. Same for comment likes. |
| Realtime | **Yes** — Supabase Realtime subscribes to completions/likes/comments in view. |
| Push notifications | **Engagement only** — push on like/comment to the post owner (or comment author for comment likes). **No** push for friend completions. |
| Read-path architecture | **Single RPC** (`fetch_feed_page`) returns joined feed rows including aggregate counts and viewer-liked flag. One round-trip per page. Closer to the long-run shape Instagram/TikTok converged on, behind a cache layer (we add the cache later). |
| Share button | **Skipped for v1.** |
| Stories rail | **Skipped for v1** — separate plan to follow. Visual scaffolding in `feed.tsx` should leave a hook for it (e.g., a `ListHeaderComponent` slot that's empty for now). |

## What's NOT in scope for this PR

- One-way follow (skipped per decision above; reserve the term for later).
- Multi-emoji or Slack-style reactions.
- Threaded comments / replies to comments.
- **Stories rail** — a separate plan + PR will follow. We leave a `ListHeaderComponent` hook in the feed screen so it can slot in without churn.
- **Share button** on cards.
- Algorithmic ranking. Feed is strict reverse-chronological.
- Full "Completion detail" editor for the user's own posts (screen 3 in WIREFRAMES.md). The Feed will open a *read-focused* completion view that supports comments + likes; the editor that adds attachments / edits notes / changes visibility stays gated behind History → tap-completion. Two consumers, two layouts.
- Push notifications for **friend completions** (only engagement triggers push).
- Edge Function code itself for push delivery. We add the **plumbing** (push-token table, client registration, DB trigger that POSTs to the function) but the function body is a follow-up task.
- Redis/Memcached caching of feed rows. Single-RPC path is the stepping stone; cache comes when needed.
- Denormalized aggregate count columns (`habit_completions.like_count`, etc.). Same — comes with the cache layer.

## Vocabulary additions

Add to CONTEXT.md (under Vocabulary):

- **Like** — a single user's binary heart on a completion. Unique per `(completion_id, user_id)`. Has no semantic weight beyond "I saw this and reacted positively"; **not** counted as gamification of the post owner's habit.
- **Comment** — a flat text post (1–500 chars) attached to a completion. Author may edit/delete their own; the post owner may delete any comment on their own post. No replies in v1.
- **Engagement** — the umbrella term for likes + comments on a completion.

The existing **Feed** entry is updated:

> **Feed** — the live stream of the viewer's own and friends' visible
> completions, with likes and comments. Filtered by each habit's visibility +
> blocks via Postgres RLS. Subscribed to via Supabase Realtime.

## Schema changes

New migration `supabase/migrations/20260514200000_feed_likes_comments.sql`.

### `completion_likes`

```sql
create table public.completion_likes (
  completion_id  uuid not null references public.habit_completions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (completion_id, user_id)
);

create index completion_likes_completion_idx on public.completion_likes (completion_id);
create index completion_likes_user_idx       on public.completion_likes (user_id);

alter table public.completion_likes enable row level security;

-- Like is visible if you can view the parent completion, and the like author
-- is not in a block relationship with you.
create policy completion_likes_select on public.completion_likes for select
  using (
    public.can_view_completion(auth.uid(), completion_id)
    and not public.is_blocked(auth.uid(), user_id)
  );

create policy completion_likes_insert on public.completion_likes for insert
  with check (
    auth.uid() = user_id
    and public.can_view_completion(auth.uid(), completion_id)
  );

create policy completion_likes_delete on public.completion_likes for delete
  using (auth.uid() = user_id);
```

### `completion_comments`

```sql
create table public.completion_comments (
  id             uuid primary key default gen_random_uuid(),
  completion_id  uuid not null references public.habit_completions(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index completion_comments_completion_idx
  on public.completion_comments (completion_id, created_at);
create index completion_comments_author_idx
  on public.completion_comments (author_id);

create trigger completion_comments_updated_at
  before update on public.completion_comments
  for each row execute function public.set_updated_at();

alter table public.completion_comments enable row level security;

create policy completion_comments_select on public.completion_comments for select
  using (
    public.can_view_completion(auth.uid(), completion_id)
    and not public.is_blocked(auth.uid(), author_id)
  );

create policy completion_comments_insert on public.completion_comments for insert
  with check (
    auth.uid() = author_id
    and public.can_view_completion(auth.uid(), completion_id)
  );

create policy completion_comments_update on public.completion_comments for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- The author may delete their own comment; the post owner may also delete any
-- comment on their post (moderation / App Store compliance).
create policy completion_comments_delete on public.completion_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.habit_completions c
      where c.id = completion_id and c.owner_id = auth.uid()
    )
  );
```

### `comment_likes`

Same shape as `completion_likes`, just a different target. Kept as a separate
table (not a unified `likes(target_kind, target_id)`) because per-target RLS is
cleaner and the visibility predicates differ: a comment-like requires you to
be able to see the comment (which in turn requires seeing the completion).

```sql
create table public.comment_likes (
  comment_id  uuid not null references public.completion_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);
create index comment_likes_user_idx    on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

-- A comment-like is visible if you can view the parent comment (i.e., its
-- parent completion is visible to you AND neither party is blocked).
create policy comment_likes_select on public.comment_likes for select
  using (
    exists (
      select 1 from public.completion_comments cc
      where cc.id = comment_id
        and public.can_view_completion(auth.uid(), cc.completion_id)
        and not public.is_blocked(auth.uid(), cc.author_id)
    )
    and not public.is_blocked(auth.uid(), user_id)
  );

create policy comment_likes_insert on public.comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.completion_comments cc
      where cc.id = comment_id
        and public.can_view_completion(auth.uid(), cc.completion_id)
    )
  );

create policy comment_likes_delete on public.comment_likes for delete
  using (auth.uid() = user_id);
```

### Drop `friend_feed`, add `fetch_feed_page` RPC

Per the Option C architectural decision, page reads go through a single
Postgres function. The function applies `LIMIT` to the base `habit_completions`
join *before* computing per-row aggregates, so subqueries only run for the 20
rows on the page — not for every completion ever written.

```sql
drop view if exists public.friend_feed;

-- Single round-trip page read. Returns the feed item shape the client uses
-- directly. `security_invoker` semantics via SECURITY INVOKER (default) so
-- RLS on the base tables still gates visibility.
create or replace function public.fetch_feed_page(
  cursor_completed_at timestamptz default null,
  cursor_id           uuid        default null,
  page_limit          int         default 20
)
returns table (
  id                   uuid,
  habit_id             uuid,
  owner_id             uuid,
  occurrence_date      date,
  period_start         date,
  completed_at         timestamptz,
  note                 text,
  visibility_override  habit_visibility,
  owner_handle         citext,
  owner_display_name   text,
  owner_avatar_url     text,
  habit_title          text,
  habit_icon           text,
  habit_color          text,
  habit_kind           habit_kind,
  attachments          jsonb,
  like_count           int,
  comment_count        int,
  viewer_liked         boolean
)
language sql stable
as $$
  with page as (
    select c.*
    from public.habit_completions c
    where (c.owner_id = auth.uid()
           or public.are_friends(auth.uid(), c.owner_id))
      and (
        cursor_completed_at is null
        or (c.completed_at, c.id) < (cursor_completed_at, cursor_id)
      )
    order by c.completed_at desc, c.id desc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.habit_id,
         page.owner_id,
         page.occurrence_date,
         page.period_start,
         page.completed_at,
         page.note,
         page.visibility_override,
         p.handle,
         p.display_name,
         p.avatar_url,
         h.title,
         h.icon,
         h.color,
         h.kind,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'id',               a.id,
                     'kind',             a.kind,
                     'storage_path',     a.storage_path,
                     'mime_type',        a.mime_type,
                     'width',            a.width,
                     'height',           a.height,
                     'duration_seconds', a.duration_seconds
                   ) order by a.created_at)
            from public.completion_attachments a
            where a.completion_id = page.id),
           '[]'::jsonb
         ) as attachments,
         (select count(*)::int
            from public.completion_likes l
            where l.completion_id = page.id) as like_count,
         (select count(*)::int
            from public.completion_comments cc
            where cc.completion_id = page.id) as comment_count,
         exists (
           select 1 from public.completion_likes l
           where l.completion_id = page.id and l.user_id = auth.uid()
         ) as viewer_liked
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  order by page.completed_at desc, page.id desc;
$$;

grant execute on function public.fetch_feed_page(timestamptz, uuid, int) to authenticated;
```

Why a function and not a materialized view: writes need to be visible
immediately (someone hits Complete, swipes to Feed, expects to see it), so
materializing is out. A regular view with subqueries computes aggregates
for *every* completion before applying `LIMIT` — the function pushes the
LIMIT into a CTE so subqueries only run for the page.

The "who liked" + "full comment list" paths are **separate endpoints**, not
part of this RPC — both Instagram and TikTok do it this way. Specifically:

- `fetch_likers(target_kind text, target_id uuid, cursor timestamptz)` —
  returns paginated `(profile, liked_at)` rows for a completion or a comment.
- `fetch_comments(completion_id uuid, cursor timestamptz)` — returns
  paginated comment rows with author profile and `viewer_liked` per comment.

### `expo_push_tokens` (push plumbing)

```sql
create table public.expo_push_tokens (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  device_id   text,
  platform    text,                              -- 'ios' | 'android'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, token)
);

create index expo_push_tokens_user_idx on public.expo_push_tokens (user_id);

alter table public.expo_push_tokens enable row level security;

create policy expo_push_tokens_select on public.expo_push_tokens for select
  using (auth.uid() = user_id);
create policy expo_push_tokens_modify on public.expo_push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The Edge Function (`supabase/functions/notify-on-engagement/index.ts`,
written in a follow-up PR) is invoked from a DB webhook on inserts to
`completion_likes` and `completion_comments` *and* `habit_completions`. It
looks up the recipient's push token and calls the Expo Push API. Out of scope
to implement the function itself in this PR — but the table, the client-side
registration on app start, and an inline TODO/comment in the migration get
us there.

## App-side architecture

### New module: `app/lib/feed.ts`

```ts
export type FeedItem = {
  id: string;                  // completion id
  habit_id: string;
  owner_id: string;
  occurrence_date: string | null;
  period_start: string | null;
  completed_at: string;
  note: string | null;
  visibility_override: Visibility | null;
  owner_handle: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  habit_title: string;
  habit_icon: string | null;
  habit_color: string | null;
  habit_kind: HabitKind;
  attachments: Attachment[];
  like_count: number;
  comment_count: number;
  viewer_liked: boolean;
};

export type Attachment = {
  id: string;
  kind: 'photo' | 'video';
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type Comment = {
  id: string;
  completion_id: string;
  author_id: string;
  author_handle: string;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  viewer_liked: boolean;
};

export type Liker = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  liked_at: string;
};

export type FeedCursor = { completed_at: string; id: string };

// ─── Page read (single RPC) ────────────────────────────────────────────
export async function fetchFeedPage(
  cursor?: FeedCursor,
  limit = 20,
): Promise<FeedItem[]>;

// ─── Comments ──────────────────────────────────────────────────────────
export async function fetchComments(
  completionId: string,
  cursor?: { created_at: string; id: string },
  limit?: number,
): Promise<Comment[]>;

export async function postComment(
  completionId: string,
  authorId: string,
  body: string,
): Promise<Comment>;

export async function deleteComment(commentId: string): Promise<void>;

// ─── Likes ─────────────────────────────────────────────────────────────
export async function likeCompletion(completionId: string, viewerId: string): Promise<void>;
export async function unlikeCompletion(completionId: string, viewerId: string): Promise<void>;
export async function likeComment(commentId: string, viewerId: string): Promise<void>;
export async function unlikeComment(commentId: string, viewerId: string): Promise<void>;

// Likers list — paginated. `target` is either a completion id or a comment id.
export async function fetchLikers(
  target: { kind: 'completion' | 'comment'; id: string },
  cursor?: { liked_at: string; user_id: string },
  limit?: number,
): Promise<Liker[]>;

// ─── Storage ───────────────────────────────────────────────────────────
export async function signedUrlsForPaths(paths: string[]): Promise<Map<string, string>>;

// ─── Realtime ──────────────────────────────────────────────────────────
export function subscribeToFeed(handlers: {
  onCompletion:    (event: 'insert' | 'update' | 'delete', id: string) => void;
  onLike:          (event: 'insert' | 'delete',           completionId: string) => void;
  onComment:       (event: 'insert' | 'update' | 'delete', completionId: string, commentId: string) => void;
  onCommentLike:   (event: 'insert' | 'delete',           commentId: string) => void;
}): () => void; // returns unsubscribe

// ─── Pure helpers (TDD'd in __tests__/feed.test.ts) ────────────────────
export function formatRelativeTime(timestampIso: string, now: Date): string;
export function mergeFeedPages(existing: FeedItem[], next: FeedItem[]): FeedItem[];
export function applyLikeToggle(item: FeedItem, liked: boolean): FeedItem;
export function applyCommentLikeToggle(comment: Comment, liked: boolean): Comment;
```

### Push token registration

In `app/lib/auth.tsx` (or a new `app/lib/push.ts` called from the root layout
after sign-in): request notification permission, fetch the Expo push token,
upsert it into `expo_push_tokens`. Deregister on sign-out.

### Components

| File | Role |
| --- | --- |
| `app/components/feed-card.tsx` | One card: header (avatar + handle + relative time + `⋯`), habit line ("completed Meditate 🧘" + optional flex-period summary), attachment area (single photo full-bleed; multiple photos = horizontal pager; video with inline `expo-video`), optional note (2-line excerpt with "more"), action bar (heart, comment). |
| `app/components/feed-attachment.tsx` | Self-contained photo/video viewer. Resolves a signed URL on mount, caches it. Photos via `expo-image`; videos via `expo-video` (built-in to expo 54). Plays in-view inline only when scrolled into view (perf). |
| `app/components/feed-action-bar.tsx` | Heart toggle (optimistic + haptic), comment icon (opens sheet). Tapping the like count opens the **likers screen**. Renders "N likes" as a tappable button; "View all 7 comments" opens the sheet. |
| `app/components/feed-comments-sheet.tsx` | Bottom sheet (react-native-gesture-handler + reanimated, mirroring the existing `calendar-menu-drawer.tsx` patterns). Renders the comment list, composer, send button. Each comment row has its own heart icon + like count (tap count → likers screen). Long-press a comment → delete (if author or post owner). |
| `app/components/feed-empty.tsx` | Empty state when viewer has no friends and no own completions yet: CTA to invite friends. |
| `app/components/feed-new-pill.tsx` | "N new completions ↑" button that fades in at the top when Realtime pushes inserts while the user has scrolled away from the top. Tap → scrolls to top + reloads. |
| `app/app/likers/[kind]/[id].tsx` | NEW screen — paginated list of users who liked a completion (`kind=completion`) or a comment (`kind=comment`). Tapping a row goes to that user's profile (read-only view, separate PR). |

### Screen rewrite: `app/app/(tabs)/feed.tsx`

`FlatList` (we already have `react-native-draggable-flatlist` in deps but
plain `FlatList` is fine for the feed since it doesn't need drag — bundle
size matters more than features here).

Lifecycle:

1. On mount: fetch first page (20). Render.
2. On reach end: fetch next page using `(completedAt, id)` as keyset cursor.
3. On focus: subscribe to feed Realtime. On blur: unsubscribe.
4. On `onCompletion(insert)`: if user is at top, optimistically refetch the feed; otherwise increment "N new" pill counter.
5. Pull-to-refresh: invalidates cache, refetches page 1.
6. Like tap: optimistically toggle `viewer_liked` + `like_count`; rollback on RLS rejection. Trigger Expo haptic.
7. Comment tap: open bottom sheet for that completion.

Empty state if (a) viewer has no friends AND (b) no own completions: render `feed-empty`. Otherwise render the card list (always shows the viewer's own posts, even with no friends).

### Tab layout

No changes to `app/app/(tabs)/_layout.tsx`. The Feed tab already exists and is wired.

## Data flow per card

```
FeedItem (joined client-side)
   ├── from `feed` view: completion + habit + owner profile
   ├── attachments[] from `completion_attachments` (one query per page, joined by completion_id)
   ├── like_count + viewer_liked from `completion_likes` (one query per page)
   └── comment_count from `completion_comments` (one query per page)
```

Three follow-up queries after the main `feed` SELECT, then merged into
`FeedItem[]`. Cheaper than per-row subqueries in the view and lets each
collection update independently via Realtime.

## Realtime architecture

One Supabase Realtime channel per active feed screen, with four subscriptions:

| Subscription | Filter | Reaction |
| --- | --- | --- |
| `habit_completions` INSERT | none (RLS gates what arrives) | If owner is self or a friend: bump "N new" pill (or prepend if at top). |
| `habit_completions` DELETE | none | Remove from local cache. |
| `completion_likes` INSERT / DELETE | `completion_id=in.(<ids in view>)` | Recompute that card's `like_count` + `viewer_liked`. |
| `completion_comments` INSERT / UPDATE / DELETE | `completion_id=in.(<ids in view>)` | If sheet open for that completion, mutate sheet's list; bump comment count on card. |
| `comment_likes` INSERT / DELETE | `comment_id=in.(<comment ids in open sheet>)` | Only active when the comments sheet is open. Recompute that comment's `like_count` + `viewer_liked`. |

Filter membership lists are updated as the user scrolls / opens-closes the
sheet (debounced). This avoids subscribing to every event in the database.

## Push notifications

**Engagement only.** No push for friend completions in v1 — we want push to feel
useful, not noisy, and the in-app feed already surfaces friend completions in
realtime.

Trigger surfaces (Edge Function `notify-on-engagement` — body in a follow-up PR):

| Event | Recipient | Body |
| --- | --- | --- |
| `completion_likes` INSERT | Completion owner (skip if self-like) | "Maya liked your Meditate completion." |
| `completion_comments` INSERT | Completion owner (skip if self) + previous distinct commenters on that completion (skip if self) | "Maya commented on your Meditate completion: <first 80 chars>" |
| `comment_likes` INSERT | Comment author (skip if self-like) | "Maya liked your comment." |

The DB webhook is configured via Supabase Studio (not in code) but we leave a
README pointer in `supabase/functions/notify-on-engagement/README.md` so it
isn't forgotten. (The function body itself is the follow-up scope.)

A "notification preferences" toggle is **deferred** to a profile settings PR.
For v1, push is always-on for engagement events.

## App Store compliance hooks

All baked into v1 (these are Apple requirements, not nice-to-haves):

- **Report content** — `⋯` menu on every feed card and every comment. Tapping it inserts a row into a new `content_reports` table (`reporter_id, target_kind ('completion'|'comment'), target_id, reason text, created_at`). Migration adds this table.
- **Block user** — `⋯` menu. Reuses existing `blocks` table. After block, feed refetches and the user's content disappears.
- **Mute this habit** — `⋯` menu. Inserts into new `muted_habits(user_id, habit_id)`. Feed query excludes muted habit ids. Migration adds this table.
- **Delete-account flow** — already covered by `on delete cascade` on profiles; feed inherits this. The Me tab will surface the deletion UI in its own PR.

## Files added / changed

| File | Change |
| --- | --- |
| `supabase/migrations/20260514200000_feed_likes_comments.sql` | NEW — `completion_likes`, `completion_comments`, `comment_likes`, `content_reports`, `muted_habits`, `expo_push_tokens`; drop `friend_feed`; add `fetch_feed_page`, `fetch_comments`, `fetch_likers` SQL functions. |
| `supabase/functions/notify-on-engagement/README.md` | NEW — describes the webhook wiring + Expo Push API shape for engagement events. (Function body deferred.) |
| `app/lib/feed.ts` | NEW — types, RPC-backed queries, mutations, Realtime, pure helpers. |
| `app/lib/__tests__/feed.test.ts` | NEW — TDD coverage for `formatRelativeTime`, `mergeFeedPages`, `applyLikeToggle`, `applyCommentLikeToggle`. |
| `app/lib/push.ts` | NEW — Expo push token registration; called from `auth.tsx` after sign-in. |
| `app/lib/auth.tsx` | Tiny: call `registerPushToken()` on session change. |
| `app/components/feed-card.tsx` | NEW. |
| `app/components/feed-attachment.tsx` | NEW. |
| `app/components/feed-action-bar.tsx` | NEW. |
| `app/components/feed-comments-sheet.tsx` | NEW. |
| `app/components/feed-comment-row.tsx` | NEW — single comment line with its own like heart + count. Used inside the comments sheet. |
| `app/components/feed-empty.tsx` | NEW. |
| `app/components/feed-new-pill.tsx` | NEW. |
| `app/app/(tabs)/feed.tsx` | REWRITE — list + realtime + pagination + empty state + a `ListHeaderComponent` hook for the future stories rail. |
| `app/app/likers/[kind]/[id].tsx` | NEW — likers list screen for both completion-likes and comment-likes. |
| `CONTEXT.md` | Append: Like, Comment, Engagement entries; update Feed entry to mention self + likes + comments + Realtime. |
| `app/package.json` | Add: `expo-notifications`, `expo-video`. (`expo-image` is already in deps for photos.) |

## Tests

Per CLAUDE.md: **write tests for every new function or bug fix**. Pure
functions are unit-tested; queries/components are not (matches existing
repo pattern).

`app/lib/__tests__/feed.test.ts`:

- `formatRelativeTime` — just now, "5m", "1h", "yesterday", explicit date.
- `mergeFeedPages` — dedupe by id; preserves descending `completed_at` order; appends new pages at end.
- `applyLikeToggle` — toggling on increments `like_count`, sets `viewer_liked=true`; toggling off decrements, sets `viewer_liked=false`; idempotent (off-when-already-false is a no-op).
- `applyCommentLikeToggle` — same semantics for comments.

## Visual spec

```
┌──────────────────────────────────────┐
│ ◉  Maya · @maya_b · just now    ⋯   │   <- header row
│                                      │
│    completed Meditate 🧘             │   <- habit line
│                                      │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │       [ photo / video ]          │ │   <- attachment (full-width)
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ♡ 12   💬 3                          │   <- action bar (no share)
│                                      │
│ 12 likes ›                           │   <- tap → likers list
│                                      │
│ "5am club. quiet morning."           │   <- 2-line note excerpt
│                                      │
│ View all 3 comments ›                │   <- tap → opens comments sheet
│                                      │
└──────────────────────────────────────┘
```

### Comments sheet

```
┌──────────────────────────────────────┐
│                ⎯⎯⎯                    │   <- drag handle
│ Comments                             │
├──────────────────────────────────────┤
│ ◉ tomc · 2h                          │
│   nice work 🙌                  ♡ 3  │   <- tap count → likers screen
│                                      │
│ ◉ s_lopez · 1h                       │
│   5am huh? respect.             ♡ 1  │
│                                      │
│ ◉ maya_b · just now                  │
│   thanks!                       ♡    │
├──────────────────────────────────────┤
│ ┌──────────────────────────┐ [Send]  │
│ │ Add a comment…           │         │
│ └──────────────────────────┘         │
└──────────────────────────────────────┘
```

| Element | Spec |
| --- | --- |
| Card padding | 14pt horizontal, 12pt vertical, 18pt between cards. |
| Card background | Theme-aware `surface` color (flat off-canvas color for v1). |
| Avatar | 36pt circle, fallback initial bubble in habit color. |
| Habit line | 15pt 600 weight; icon emoji inline; tap → habit profile (read-only). |
| Attachment carousel | Full card width, 4:5 aspect for photos, 16:9 for video; pager dots if >1. |
| Like heart | 28pt tap target; haptic on tap; filled red when `viewer_liked`. |
| Heart burst | Double-tap on attachment area triggers like + reanimated heart-burst (scale 0→1.2→1, fade). |
| Like count "N likes" | Below action bar; tap → likers screen (`/likers/completion/<id>`). |
| Comment row like | Trailing heart at row end; tap heart toggles like; tap count → `/likers/comment/<id>`. |
| Note excerpt | 14pt; 2 lines + "more" inline. |
| Relative time | `formatRelativeTime` — "just now" / "Nm" / "Nh" / "yesterday" / "Mon" / "May 4". |

## Edge cases to handle

- **Self-completion appears immediately** — when the viewer's own completion is inserted (from Today screen), the realtime event flows back and the feed picks it up. The cache may already have it from the optimistic write; dedupe by id.
- **Visibility narrowed retroactively** — completion you previously saw becomes `private`. Realtime UPDATE fires; we drop it from the list.
- **Block after seeing content** — when a viewer blocks an author, refetch and rebuild from server. Don't try to filter client-side; trust RLS.
- **Attachment signed-URL expiry** — Supabase signed URLs default to 1 hour. We sign on visibility (when the card scrolls in) and re-sign if stale.
- **Empty handle / no avatar** — fall back to initial bubble + display name. Already handled by avatar component.
- **Long note** — clamp at 2 lines with "more" expander. Tapping expands inline; doesn't navigate.
- **Video autoplay policy** — autoplay muted only when fully in-view; never play sound without an explicit tap. This is the Instagram baseline and avoids App Store rejections for autoplay-with-sound.

## Risks / trade-offs

1. **Realtime + RLS scaling**: every connected client gets a Realtime channel. At v1 scale (single-digit thousands) this is fine; at scale we may need to gate Realtime behind "screen visible" — which we already do.
2. **Likes data model is binary** — switching to multi-reaction later requires a column addition (`kind text default 'heart'`) plus a tombstone. Cheap migration if we go that way.
3. **Comments without threads** is a v1 simplification. Adding `parent_comment_id` later is additive (NULL-able column + index), no breaking change.
4. **Self in feed** is debatable UX — Instagram doesn't show your own posts in the home feed. User explicitly wants this. We could later move "own posts" to the profile and keep the feed friends-only. Cheap to revert.
5. **Push relies on a follow-up PR** for the function body — if the Feed lands first, engagement events won't push notify. The plumbing is in place so it's a one-PR follow-up.
6. **`fetch_feed_page` runs four subqueries per row** in the page (attachments + like_count + comment_count + viewer_liked). At 20 rows = 80 small indexed lookups per page request. Fine at v1 scale. The escape hatch when this hurts: add denormalized counts (`habit_completions.like_count`, etc.) maintained by triggers, then have the RPC read them directly. Schema change, no API change.
7. **No moderation queue**: reports just accumulate in `content_reports`. Per CONTEXT.md we commit to a 24-hour review SLA — that requires an admin path that doesn't exist yet. Flag for App Store submission readiness, not feature completeness.
8. **Comment-likes RLS has a nested subquery** (visible → parent comment visible → parent completion visible). Postgres optimizes this fine for individual row checks but it adds a join compared to `completion_likes`. Acceptable.

## Open knobs (remaining)

- **Notification preferences** — global on/off per user is in scope (default on); per-friend granular muting is not. Per-habit muting *is* in scope via "mute this habit." Acceptable trade?
- **Comment edit window** — can a user edit their own comment forever, or only within N minutes? Plan default: forever (matches Instagram). RLS already allows it.
- **Likers screen empty state** — when N is 0, the count won't show at all, so the screen isn't reachable. Confirmed safe — no design needed.
