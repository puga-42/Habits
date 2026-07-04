# Habits App — Security & Code Review

**Date:** 2026-07-04
**Reviewer:** Senior engineering review (5 parallel audit passes: DB/RLS, edge & client security, dead/duplicated code, data-flow efficiency, correctness & standards)
**Scope:** `app/` (React Native + Expo, TypeScript), `supabase/migrations/` (23 files), `supabase/functions/` (4 edge functions), `supabase/seed.sql`, repo hygiene.

Every finding below was verified against source. Claims that turned out to be non-issues are recorded in the "Verified sound" section so they don't get re-flagged later.

---

## Executive summary

Two issues are **release-blocking** and should be fixed before any further App Store work:

1. **`SEC-1` — Private data bypass across 8 RLS functions.** A whole family of `SECURITY DEFINER` RPCs trust a client-supplied `p_viewer_id` instead of `auth.uid()`. Any signed-in user can read any other user's private habits, completions, notes, and social graph by passing a forged UUID. This is the single most important thing in this document.
2. **`COR-1` — Every weekly/monthly habit renders on the wrong day for users east of UTC.** A timezone bug in RRULE expansion, empirically reproduced against the installed `rrule@2.8.1`. It corrupts display, completion, streaks, and alerts for the entire eastern hemisphere — and is invisible in US-timezone development.

Beyond those, the recurring themes are exactly what you predicted from AI-generated code: **systemic copy-paste** (the feed-social layer, attachment CRUD, and media-pick flow are each triplicated — ~600 duplicated lines), **refetch-everything data flow** (the calendar tab does ~15 network round trips to mark one habit done), and a **cluster of flex-habit period bugs** where the write path ignores `target_period`.

**Counts:** 2 Critical · 9 High · 15 Medium · ~20 Low, plus 4 dead files, ~12 dead functions, 13 duplication clusters, and 29 files over the 200-line project limit.

### Priority order (what I'd fix first)

| # | Finding | Severity | Complexity |
|---|---------|----------|------------|
| 1 | `SEC-1` viewer-id RLS bypass (8 functions) | Critical | Small each |
| 2 | `COR-1` RRULE timezone day-shift | Critical | Medium–Large |
| 3 | `COR-2` flex `period_start` ignores `target_period` | High | Medium |
| 4 | `COR-4` duplicate completions (no idempotency) | High | Medium |
| 5 | `SEC-2` edge functions trust unauthenticated webhook payloads | High | Small |
| 6 | `EFF-1/2` calendar-tab refetch storm | High | Medium |
| 7 | `COR-3` stale `today` across midnight | High | Small |
| 8 | `EFF-3` group-overview N+1 stats | High | Small |
| 9 | `EFF-4` per-card signed-URL storm | High | Small–Medium |

---

## 1. Security

### SEC-1 — CRITICAL — Private-data bypass: 8 `SECURITY DEFINER` RPCs trust `p_viewer_id` instead of `auth.uid()`

A systemic flaw. These functions bypass RLS (that's what `SECURITY DEFINER` does) and then take the **viewer's identity as a plain parameter**. The client passes it (confirmed: `habit-stats.ts:127` sends `p_viewer_id: viewerId`, `user-profile.ts` sends it to four RPCs). Any authenticated user can call the RPC directly via PostgREST with a forged argument. The common exploit is passing `p_viewer_id = p_target_id`, which trips the "self" branch and returns everything, including `private` rows.

**Worst case, verified:** `fetch_my_habits_stats(p_viewer_id)` has *no visibility check at all* — just `where h.owner_id = p_viewer_id`. Calling it with any user's UUID dumps that user's entire completion + skip history across all habits.

| Function | File:line | Leaks | Severity |
|----------|-----------|-------|----------|
| `fetch_my_habits_stats` | `20260613000002_lineage_segments.sql:106` | Full completion/skip history of **any** user (no visibility check) | Critical |
| `get_user_completions_range` | `20260613000003_user_day_view.sql:68` | Private completions + notes | Critical |
| `get_user_visible_habits` | `20260613000003_user_day_view.sql:21` | All habits incl. private schedule/visibility | Critical |
| `get_user_overrides_range` | `20260613000003_user_day_view.sql:121` | Private-habit override/skip data | Critical |
| `fetch_habit_stats` | `20260613000002_lineage_segments.sql:39` | Private habit stats/history | Critical |
| `get_user_activity_heatmap` | `20260518000000_initial.sql:1770` | Private completion histogram | Critical |
| `get_user_profile_page` | `20260518000000_initial.sql:1477` | Defeats blocks; leaks friendship/mutual-friend data | High |
| `get_mutual_friends` | `20260518000000_initial.sql:1731` | Mutual-friends of **any two** arbitrary users (no `auth.uid()` at all) | High |

> Note: the superseded `fetch_habit_stats` at `20260612000001_habit_stats_rpc.sql:10` has the same flaw and is still callable — fold it into the same fix.

**Proposed fix:** Drop the `p_viewer_id` parameter from each function and derive the viewer from `auth.uid()` internally. The codebase already has the correct template: **`get_user_feed_page` (`20260518000000_initial.sql:1571`)** takes only `p_target_id` and uses `auth.uid()` for all block/friend checks. Copy that pattern. Then drop the arg from the client call sites (`habit-stats.ts`, `user-profile.ts`, `activity-heatmap.ts`). New migrations only — don't edit existing ones (project rule).

**Complexity:** Small per function; Medium as a coordinated change (8 functions + client call sites + regression tests). This should be one focused PR.

---

### SEC-2 — HIGH — Edge functions trust unauthenticated webhook payloads (push-notification spoofing)

None of the four edge functions verify a shared webhook secret or that the request actually came from a Supabase DB webhook. They parse `payload.record` from the body and trust it. With open signup (`config.toml: enable_signup = true`), the only gate is the platform JWT check, which admits any authenticated user's token.

- `notify-on-engagement/index.ts:49-68,131-163` — POST a crafted body to send any user an Expo push with attacker-controlled `title`/`body` (arbitrary phishing text on a victim's lock screen), or spoof "@x commented" notifications.
- `notify-on-friend-request/index.ts:15-37` — spam "X sent you a friend request" pushes to any `to_user`.
- `dispatch-feedback/index.ts:37-48` — invoke with arbitrary `record.id` to flip feedback rows, burn the Anthropic API budget, and create GitHub issues on demand.
- `flush-like-notifications/index.ts:38-108` — unauthenticated, side-effecting cron flush; external callers can force premature batch flushes + extra DB load.

**Proposed fix:** Require a shared secret header on every function (`if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return 401`), set on both the DB webhook config and as a function secret. Alternatively move notification creation into `SECURITY DEFINER` DB triggers so there's no public entry point.
**Complexity:** Small.

---

### SEC-3 — MEDIUM — Prompt injection: untrusted feedback → LLM triage → auto-labeled GitHub issue → automated implementation

`dispatch-feedback/index.ts:94-131,154-179` interpolates raw user free-text (`desired_behavior` / `current_behavior`, up to 2000 chars) into the Claude prompt and the issue body, then unconditionally labels every issue `"automated"` — which (per the function's own header) a Claude Code routine picks up for implementation. A user can inject instructions that steer triage output and, downstream, an autonomous coding agent, or inject arbitrary markdown/links into internal issues.

**Proposed fix:** Treat feedback as data, not instructions — wrap in delimiters, add a system instruction marking it untrusted, escape markdown, and require **human triage** before the `automated` label is applied.
**Complexity:** Medium.

---

### SEC-4 — MEDIUM — Auth session stored in plaintext AsyncStorage, not SecureStore

`app/lib/supabase.ts:16-23` persists the session (access + long-lived refresh token) in unencrypted `AsyncStorage`. `expo-secure-store` is declared in `app.json` but used nowhere. On a compromised/backed-up device the refresh token is readable in cleartext → session theft and long-term impersonation.

**Proposed fix:** Provide a SecureStore-backed storage adapter (Keychain/Keystore) to `createClient({ auth: { storage } })`, per Supabase's Expo guide.
**Complexity:** Small.

---

### SEC-5 — MEDIUM — Spoofable "habit adopted" notifications via direct `habit_activity` insert

`20260518000000_initial.sql:724-726` — policy `habit_activity_owner` is `for all using (owner_id = auth.uid())` with **no `WITH CHECK`**. A client can insert `habit_activity` with `event_type='adopted'`, `adopted_from_user_id=<victim>`; the `trg_adoption_notification` trigger then fires a "X adopted your habit" notification to the victim → notification spam / social engineering.

**Proposed fix:** Add a `WITH CHECK` restricting client inserts (e.g., only `event_type='created'`), or block direct inserts and rely on the `trg_habit_created_activity` trigger.
**Complexity:** Medium.

---

### SEC-6 — MEDIUM — `expo_push_tokens` has no global uniqueness on `token`

`20260518000000_initial.sql:259-267` — PK is `(user_id, token)`. When a device switches accounts, the old `(user_id, token)` row survives, so pushes intended for user A can land on a device now used by user B (cross-user notification-content leak).

**Proposed fix:** Delete stale token rows on re-registration, or make `token` globally unique (last-writer-wins).
**Complexity:** Medium.

---

### SEC-7 — MEDIUM — Two `SECURITY DEFINER` functions lack `set search_path`

Search-path hijacking risk (also flagged by Supabase's own linter):
- `20260607000000_notifications.sql:151` — `create_engagement_notification()`.
- `20260609000000_adopt_habit.sql:271` — `invoke_notify_on_engagement()` — matters more: it reads `vault.decrypted_secrets` (service-role key) and calls `extensions.http_post`.

**Proposed fix:** Add `set search_path = ''` (references are already schema-qualified). All *other* definer functions correctly set it.
**Complexity:** Small.

---

### SEC-8 — LOW — Miscellaneous RLS tightening

- **Completions against another user's habit** (`initial.sql:625`): `habit_completions_insert` checks `owner_id` but not that `habit_id` belongs to the caller. Add `WITH CHECK exists(select 1 from habits h where h.id = habit_id and h.owner_id = auth.uid())`. Same shape applies to `time_entries` and attachments. — Small
- **Feedback pipeline columns** (`initial.sql:716`): insert policy lets the client set `status`/`github_issue_number`/`processed_at`. Constrain via `WITH CHECK`. — Small
- **Profile preference leak** (`initial.sql:560`): `profiles_select` exposes `notify_likes`/`notify_comments`/`week_start` to all non-blocked users. Project only public columns via a view/RPC. — Medium
- **Block doesn't sever friendship** (`initial.sql:72-78,594-597`): inserting a `blocks` row leaves `friendships`/`friend_requests` intact, so `are_friends()` stays true. Read paths are saved today by `is_blocked` checks, but the `friend_feed` view (dead, see DUP-14) relied only on `are_friends`. On block, delete the friendship and decline pending requests. — Medium
- **Feedback screenshot update is RLS-denied** (`feedback.ts:100`, no UPDATE policy at `initial.sql:716`): `submitFeedback` uploads then `update({screenshot_path})`, which RLS rejects → throws after the file is uploaded, orphaning storage objects. Set `screenshot_path` in the initial insert (upload first), or add a scoped UPDATE policy. — Small
- **Video 30s cap is client-only** (`attachments.ts:62`): the bucket enforces MIME + 50 MB (good) but not duration; a modified client can upload >30s. Document as a UX limit, or add server-side validation. — Medium

---

### SEC-9 — LOW — Dependency vulnerabilities

`npm audit` reports 25 vulnerabilities (1 critical `shell-quote`, 5 high, 18 moderate), all in the dev/build toolchain (Expo/Metro/`ws`/`tar`), none in shipped runtime paths. `npm audit fix` clears the non-breaking ones. Track but not release-blocking.

**Verified clean:** no committed secrets (`app/.env` is untracked and holds only public `EXPO_PUBLIC_*` values; `app.json`/`eas.json` expose only non-secret identifiers); no `eval()` / `dangerouslySetInnerHTML`; Apple Sign-In nonce handling is correct (hashed to Apple, raw to Supabase); storage-path forgery is blocked server-side by `foldername[1] = auth.uid()` policies; push-token RLS is per-user correct; all 29 tables have RLS enabled; no `anon` grants; account-deletion cascade is complete.

---

## 2. Correctness

### COR-1 — CRITICAL — Weekly/monthly RRULEs render one day late for every UTC+ user

**Empirically reproduced** against `rrule@2.8.1` with `TZ=Asia/Tokyo`. `draftToInsert` (`habit-form.tsx:139-150`) stores `dtstart` as a local-midnight *instant* via `.toISOString()`. `rrule.js` reads `BYDAY`/`BYMONTHDAY` from the **UTC** fields of dtstart. For any UTC+ timezone, local midnight is the *previous* UTC day, so the rule shifts.

Verified: "every Monday" starting Mon 2026-07-06 → stored `2026-07-05T15:00:00Z` → `rule.between(<local Monday window>)` returns `[]`; the occurrence lands in the local **Tuesday** window and renders as a Tuesday. Every weekly, weekday-preset, and monthly habit is displayed, completed, streak-counted, and alerted on the wrong day for UTC+ users. Negative-offset (US) users are unaffected, which masks it in development.

**Affected call sites:** `history.ts:197-210` (`expandHabit`), `habits.ts:96-102` (`todaysScheduledOccurrences`), plus `streak.ts` and `alerts.ts` expansion.
**Proposed fix:** Adopt rrule.js's "fake-UTC" convention — build dtstart with `Date.UTC(y,m,d)` from the local calendar date, expand with UTC-midnight windows, read results with `getUTC*`. Centralize in one conversion layer; storage format can stay if converted on read. Add tests with `TZ` overrides.
**Complexity:** Medium–Large.

---

### COR-2 — HIGH — `markFlexCompleted` hardcodes `period_start = Monday-of-this-week`, ignoring `target_period` and the logged day

`habits.ts:132-145` always writes `period_start = isoDate(weekStart(new Date()))`. The read side is period-aware (`flexPeriodStartFor`, `history.ts:518`: returns `dayIso` for `'day'`, month-start for `'month'`). Verified independently by two audit passes. Consequences:

- A **day-period** flex habit's completion is filed under Monday; the count filter (`history.ts:259`) looks for `period_start === dayIso` → count stays 0 forever, target never reached, streak always 0.
- **Retroactive** flex logging (supported by `canCompleteOn`) always credits the *current* week.
- **Swipe-reset** asymmetry: `unmarkLastFlexInPeriod(..., flexPeriodStartFor(...))` (`index.tsx:518`) deletes nothing for day/month habits.
- Same weekly-only assumption in `fetchTodayCompletions` (`habits.ts:78`) and the widget builder (`widget-sync.ts:74`).

**Proposed fix:** `markFlexCompleted(habitId, ownerId, target_period, dateIso)` computing `flexPeriodStartFor(dateIso, target_period)`; update the three call sites, `fetchTodayCompletions`, `buildWidgetPayload`, and `checkAndAutoComplete`.
**Complexity:** Medium.

---

### COR-3 — HIGH — `today` captured once per mount; app crossing midnight misbehaves

`index.tsx:92` — `const today = useMemo(() => new Date(), [])`. Tab screens stay mounted for the app's lifetime, so `today` never refreshes. After midnight, `canCompleteOn(dateIso, today)` (`index.tsx:401`) rejects completing the *actual* today as "future" (tapping silently does nothing), the today circle isn't highlighted, and streaks show yesterday's value. `useFocusEffect` reruns `load()` but never updates `today`.

**Proposed fix:** Make `today` state refreshed on focus / AppState-active: `useFocusEffect(() => setToday(new Date()))`.
**Complexity:** Small.

---

### COR-4 — HIGH — Duplicate completions: no idempotency anywhere

`habit_completions` has **no** unique `(habit_id, occurrence_date)` constraint (only `habit_overrides` does, `initial.sql:136`). Two paths create duplicates:
- `checkAndAutoComplete` (`time-entries.ts:139-159`) inserts a completion whenever total time ≥ target, with no existence check — a second timer session the same day inserts a second row.
- Rapid double-tap of `handleTrailingPress` (`index.tsx:399`) has no in-flight guard (unlike `use-habit-overview`'s `busy` flag) and races two inserts before `load()` returns.

Result: total counts, feed, and history double-count; "reset" removes only one.
**Proposed fix:** (a) new migration adding a partial unique index `on habit_completions (habit_id, occurrence_date) where occurrence_date is not null`, insert with upsert/ignore-conflict; (b) existence check in `checkAndAutoComplete`; (c) `busy` guard in `handleTrailingPress`.
**Complexity:** Medium.

---

### COR-5 — HIGH — "Delete all future occurrences" is a no-op for flex habits

`deleteHabitFuture` (`habits.ts:375`) sets `habits.until`, but the flex row-emission in `buildDayGroups` (`history.ts:256-273`) and `buildWidgetPayload` (`widget-sync.ts:75`) never checks `until` — only scheduled habits respect it (via `expandHabit`). The "log it" row keeps rendering forever on every day; only alerts stop.
**Proposed fix:** Skip days after `isoDate(new Date(habit.until))` in the flex branch of `buildDayGroups` and `buildWidgetPayload`.
**Complexity:** Small.

---

### COR-6 — MEDIUM — Flex completions vanish at fetch-window edges (UTC vs local date)

`fetchCompletionCountsByDate` (`history.ts:559`) and `fetchRange` (`history.ts:658`) filter flex completions by `completed_at.gte/lt` (Postgres casts at UTC midnight) but bucket for display by local day. Completions within `|utcOffset|` hours of local midnight fall out of the window and render as if nothing was logged.
**Proposed fix:** Widen the `completed_at` filter by ±1 day (bucketing re-filters anyway), or filter on a computed local date server-side.
**Complexity:** Small.

---

### COR-7 — MEDIUM — Rest/edit overrides clobber each other

One row per `(habit_id, occurrence_date)` holds either a skip or an edit. `restHabitDays` (`habits.ts:495`) upserts `kind:'skip'`, destroying any existing `edit`/`reschedule`; `applyEditThis` (`habits.ts:345`) upserts `kind:'edit'`, silently un-resting a day and orphaning the `rest_id` linkage. Renaming an occurrence then resting through it permanently loses the rename.
**Proposed fix:** Read existing overrides in-range before upsert; skip/merge/refuse on conflict (minimum: `restHabitDays` skips dates with an `edit`; `applyEditThis` refuses when a `skip` exists).
**Complexity:** Medium.

---

### COR-8 — MEDIUM — `applyEditFuture` is non-atomic and forks with `sort_index = 0`

`habits.ts:321-343` — two sequential writes (cap old `until`, then insert new lineage row). If the insert fails mid-flight, the habit's future silently disappears (no rollback; the in-code `TODO: wrap in an RPC` marks a real data-loss path). Also the insert omits `sort_index`, so the forked row defaults to 0 and jumps to the top of every list.
**Proposed fix:** Single RPC for the split (matches the existing `fetch_*` RPC pattern); pass `sort_index: original.sort_index` in the interim.
**Complexity:** Small (sort_index) + Medium (RPC).

---

### COR-9 — MEDIUM — Concurrent alert resyncs double-schedule past the iOS 64 cap

`resyncHabitAlerts` (`alert-scheduler.ts:84-122`) is fire-and-forget with no mutex/debounce. Two overlapping calls (save racing sign-in resync) each snapshot-then-cancel-then-schedule; B's stale snapshot misses A's new IDs, so every alert is scheduled twice (up to ~120 > iOS ~64). iOS silently drops the excess → later-window alerts vanish.
**Proposed fix:** Serialize with a module-level promise chain (`lastResync = lastResync.then(run)`) or debounce like `syncWidgetData`.
**Complexity:** Small.

---

### COR-10 — LOW — Timer-state hazards in AsyncStorage

`index.tsx:230-236` / `use-stopwatch.ts:84` — unguarded `JSON.parse` of `timer:*` throws on a corrupt/legacy value (unhandled rejection breaks timer restore permanently); two independent writers on the same keys can re-write an already-stopped entry; `restoreTimer` adopts the *first* `timer:` key by storage order rather than the newest.
**Proposed fix:** try/catch + delete bad key; pick newest by `startedAt` and close the rest; consider a single timer-state module.
**Complexity:** Small.

**Verified sound (won't re-flag):** `streak.ts` scheduled walk-back (today-neutral, skip-neutral, lineage segment union, ≤100 cap under-reports safely); `group-streak.ts` UTC-noon DST dodge and gap bridging; `recurrence.ts` UNTIL inclusivity and the `splitTime − 1s` until math; `day-diff.ts`, `units.ts`, `start-date.ts`, `planAlerts`' 60-alert cap.

---

## 3. Data-flow & architecture efficiency

The feed page read, friends lists, heatmap, batch signed-URLs (`signedUrlsForPaths`), and memoized streaks are all done **well** — single-RPC, cursor-paginated, local realtime patching. The problems concentrate in the calendar tab's load orchestration, the group overview, and per-card URL signing.

### EFF-1 — HIGH — Calendar tab refetches everything on every focus, day-step, and mutation

`index.tsx:180-221`. `load()` fires 7 queries (habits, range, profile, stats, strip counts, groups, memberships) + the per-time-habit fan-out (EFF-2), and reruns on: every focus (`useFocusEffect:215`); every anchor change (deps include `anchorIso`/`dataRange`, so a single arrow tap in day view refetches 28 days of completions + all the anchor-independent data); and every completion toggle (`:415,437,531,553` each `await load()`).

**Realistic cost:** ~11 round trips per arrow tap; ~15 round trips to mark one habit done (insert + 11 + widget-sync's 3).
**Proposed fix:** Split the effect — anchor-scoped fetch (`fetchRange`) keyed separately from static data (habits/profile/groups/memberships/stats); patch `completions` state locally after mark/unmark (the insert returns the id, the row shape is known); widen the day-view window and only refetch when the anchor leaves it (the profile screen at `user-profile-view.tsx:150` already does this).
**Complexity:** Medium.

### EFF-2 — HIGH — Per-time-habit `fetchTimeEntries` fan-out inside `load()`

`index.tsx:204-212` — one `time_entries` query per time habit, serial after the main `Promise.all`, on every `load()`. 6 time habits → 6 extra trips each focus/step/mutation.
**Proposed fix:** One `.in('habit_id', ids)` query (or a small batch RPC), bucket client-side with the existing `sumDurationSeconds`.
**Complexity:** Small.

### EFF-3 — HIGH — Group overview: per-lineage stats N+1 despite an existing batch RPC

`use-group-overview.ts:67-69` calls `fetch_habit_stats` once per lineage — 10 habits → 10 RPCs running the same aggregation. The batch `fetch_my_habits_stats` already exists and is used by the day view; it's only avoided here because it omits `completion_count`. The hook also fetches *all* memberships + *all* habits to derive one group.
**Proposed fix:** Add `completion_count` to `fetch_my_habits_stats` (new migration), call it once here; filter memberships by `group_id` server-side.
**Complexity:** Small.

### EFF-4 — HIGH — Feed signed URLs fetched per-card, re-signed on every refetch, never cached

`feed-attachment-carousel.tsx:28-37` signs each card's attachments in a mount effect keyed on an array that gets a new identity every feed refetch. 20-item page with 10 media cards → 1 feed RPC + 10 separate sign calls, re-signed on every focus / pull-refresh / realtime insert. `use-habit-overview.ts` shows the correct batch pattern.
**Proposed fix:** After `fetchFeedPage`, collect all `storage_path`s and make **one** `signedUrlsForPaths` call held in a screen-level `Map` (path → {url, expiry}) passed to cards; only sign uncached paths.
**Complexity:** Small–Medium.

### EFF-5 — MEDIUM — Cluster of avoidable round trips

- **Realtime INSERT → full first-page refetch** (`feed.tsx:78-121`): every friend completion triggers a full expensive `fetch_feed_page`. Fetch just the new item(s) and merge via `mergeFeedPages`; debounce bursts. — Small–Medium
- **Unfiltered realtime on 9 tables, re-subscribed every focus** (`feed-realtime.ts:29-189`; same in `friends.ts:187`): RLS must evaluate every WAL change against every client (O(clients × writes)); channel torn down/rebuilt on each focus. Subscribe once at navigator level; drop tables whose handlers are no-ops. — Medium
- **Drag-reorder = one UPDATE per row** (`habits.ts:258`, `group-mutations.ts:54`, `completions.ts:185`, `rest-attachments.ts`): 20 habits → 20 UPDATEs per drag, each firing `set_updated_at`. Replace with a single `reorder_habits(uuid[])` RPC using `unnest … with ordinality`. — Small
- **Habit-overview waterfall** (`use-habit-overview.ts:173-207`): `fetchHabit → fetchHabitCompletions (2 queries) → sign URLs → loadStats`, strictly sequential, 7–9 trips. Collapse completions+attachments into one embedded select (`.select('*, completion_attachments(*)')`); run `loadCompletions`/`loadStats`/`fetchProfile` in `Promise.all`; patch locally on ±. — Small–Medium
- **Widget sync refetches what `load()` just loaded** (`widget-sync.ts:96-110`): +3 queries per focus and per toggle. Pass the already-loaded `{habits, completions, overrides}` into `buildWidgetPayload` (already pure). — Small
- **Profile screen loads in 2 serial waves** (`user-profile-view.tsx:61-79`): `[profile,habits]` then `[feed,mutuals]` though independent — one `Promise.all`. Also `fetchRange` fetches completions then overrides serially. — Small
- **Social counts: 3 queries per target** (`feed-completion.ts:24`, `feed-activity.ts:13`, `feed-rest.ts:17`): swiping 5 completions in overview → 15 queries. One `fetch_social_counts(kind, id)` RPC. — Small
- **Badge polling every 30s app-wide** (`pending-count-provider.tsx`, `unread-count-provider.tsx`): two queries every 30s regardless of foreground, despite realtime channels already existing for these tables. Drive from realtime / tab-focus; pause when backgrounded. — Small

**Also flagged:** `get_user_feed_page` (profile feed) was never extended with the rest branch `fetch_feed_page` gained in `20260617000004`, so rests don't appear on profile feeds — confirm whether that's intentional.

---

## 4. Dead & duplicated code

### Dead files (delete outright) — verified 0 external references each
| File | Note |
|------|------|
| `components/calendar-fab.tsx` | Superseded by `fab-speed-dial.tsx` |
| `components/month-picker.tsx` (125 lines) | Superseded by `calendar-month-view` + `week-strip` |
| `components/color-wheel-icon.tsx` | Superseded by `color-wheel.tsx`; update stale comment in `streak-flame-icon.tsx:5` |
| `components/ui/collapsible.tsx` | `create-expo-app` scaffold leftover |

### Dead functions/exports (Medium)
`habits.ts`: `todaysScheduledOccurrences` (+ `ScheduledOccurrence` type), `restHabitDays` (superseded by `rests.ts`). `group-mutations.ts`: `reorderGroups`, `removeHabitFromGroupAll`. `time-entries.ts`: `dateParamsForHabit`. `history.ts`: `completionCountByDate` (superseded by `countCompletionsByDate`), `agendaDatesForMonth`, `nextMonth` (test-only). `friends.ts`: `mergeRequestPages` (test-only). `user-profile.ts`: `habitsCompletedOnDate` (test-only). `constants/colors.ts`: `primaryRgba`. Plus ~35 exported-but-never-imported types to un-export (batch, Small).

### Duplication clusters (High ones first)

| ID | What | Locations | Fix | Complexity |
|----|------|-----------|-----|------------|
| DUP-1 | **Feed social API triplicated** (~450 lines, ~85% identical: counts, like/unlike, comment CRUD, comment-like) | `feed-completion.ts` ≡ `feed-activity.ts` ≡ `feed-rest.ts` | `makeSocialApi({tables, fk, rpc})` factory → 3 one-line instantiations | Medium |
| DUP-2 | **Attachment CRUD duplicated** (~80 lines byte-identical) | `completions.ts:115-196` ≡ `rest-attachments.ts:27-105` | `makeAttachmentCrud({table, fkColumn})` | Medium |
| DUP-3 | **Pick→validate→upload triplicated** | `attachment-actions.ts:30`, `use-rest-media.ts:48`, `completion/[id].tsx:108` | Extract `pickValidatedMedia()` | Medium |
| DUP-4 | `validationMessage` duplicated verbatim | `habit-overview.ts:105` vs `completion/[id].tsx:279` | Import the shared one; delete local copy | Small |
| DUP-5 | 9 near-identical realtime handlers | `feed-realtime.ts:35-188` | `onTable()` helper → ~60 lines | Small |
| DUP-6 | Cursor-pagination scaffold copied across 5 screens (+ per-screen `PAGE_SIZE`) | `feed.tsx`, `notifications.tsx`, `friends.tsx`, `likers/[kind]/[id].tsx`, `user-profile-view.tsx` | `useCursorPage()` hook | Medium |
| DUP-7 | Optimistic like-toggle duplicated; 3 structurally identical togglers | `feed.tsx:159`, `user-profile-view.tsx:107`, `feed-helpers.ts:122-159` | `useOptimisticLike()` + one generic `toggleLiked<T>` | Small |
| DUP-8 | Local ISO-date parser defined 6× | `history.ts:430`, `streak.ts:167`, `feed-helpers.ts:94`, `rest-until-modal.tsx:21`, `user-profile-view.tsx:275`, `week-strip.tsx:202`, `index.tsx:809` | One `parseIsoLocal(iso, hour=0)` in `habits.ts` | Small |
| DUP-9 | "Day before" helper triplicated | `group-streak.ts:74`, `group-mutations.ts:163`, `rests.ts:35` | One `dayBeforeIso` | Small |
| DUP-10 | `FriendshipStatus` type defined twice (drifting) | `friends.ts:8` vs `user-profile.ts:21` | Canonical in `friends.ts`, `| 'self'` at use site | Small |
| DUP-11 | `currentPeriodStart` implemented twice | `habit-overview.ts:21` vs `streak.ts:146` | `streak.ts` calls the exported one | Small |
| DUP-12 | `ProgressRing` vs `AnimatedProgressRing` near-identical | `progress-ring.tsx` vs `animated-progress-ring.tsx` | Delete `progress-ring.tsx`; point `stopwatch-panel` at animated | Small |
| DUP-13 | Calendar-view scaffolding duplicated (index maps, measured-scroll, day header, chip) | `calendar-{day,3day,week,month,schedule}-view.tsx` | `calendar-shared.tsx`: `useIndexMaps`, `MeasuredScrollView`, `CalendarDayHeader`, `HabitChip` | Medium |
| DUP-14 | **Dead SQL view** `friend_feed` (still live in remote DB) | `initial.sql:796-812` | New migration `drop view if exists public.friend_feed;` | Small |

> SQL supersession hygiene is otherwise **clean** — every `fetch_feed_page`/`fetch_habit_stats`/`get_user_visible_habits` recreation drops the old signature first, so no orphaned overloads (aside from the SEC-1 superseded `fetch_habit_stats`, which is a security issue, not dead code).

---

## 5. Project-standard violations

- **200-line limit — 29 files over.** Worst: `index.tsx` (832), `history.ts` (675), `habits.ts` (542), `friends.tsx` (501), `feed.tsx` (385), `user-profile.ts` (352), `agenda-row.tsx` (351), `completion/[id].tsx` (348), `feedback.tsx` (346). The DUP-6/7/8 extractions alone would pull `index.tsx` and `user-profile-view.tsx` down substantially.
- **Structured error objects not used** (Medium aggregate): raw `Error(string)` throws in `feed-activity.ts:85`, `feed-completion.ts:107`, `feed-rest.ts:87` (the same "Comment must be 1-500 characters" ×3), `feedback.ts`, `profile.ts`, `completions.ts:130`, `habit/[id].tsx`. Silent swallows (`.catch(() => {})`) in `unread-count-provider.tsx:31`, `pending-count-provider.tsx:33`, `mutual-friends-modal.tsx:25`, `notifications.tsx:94`, plus ~10 bare `catch {}`. `onPress` async handlers in `index.tsx` (`handleTrailingPress`, `handleSwipeAction`) have no catch — a failed insert surfaces as nothing. Introduce a shared `{ kind, ...details }` error type + result helpers.
- **Uncommented `any`** (Low): `feed-realtime.ts` (9×) and `friends.ts:195,203` (`'postgres_changes' as any`), `habit/new.tsx:49`, `completion/[id].tsx:155` (`(err as any)?.message`). No `@ts-ignore` anywhere.
- **Missing colocated tests** (Low–Medium): no test for 19 lib files, notably `feed-activity.ts`/`feed-completion.ts`/`feed-rest.ts` (pure validation logic the rules require tests for), `use-habit-overview.ts`, `alert-scheduler.ts`. Also a naming mismatch: `day-item-key.ts`'s test lives at `__tests__/day-content-key.test.ts` — rename.
- **Stale comment** (Low): `history.ts:3` still says "No streaks, no completion rates, ever" — contradicts the 2026-06-12 streaks reversal. Gamification rules are otherwise **clean** — no percentages, freeze tokens, or point systems found.

---

## Appendix — method

Five independent audit passes ran in parallel, each reading source directly (not sampling): (1) DB schema + RLS across all 23 migrations tracking final effective state; (2) edge functions + client security surfaces + repo-wide secret grep; (3) dead/duplicated code with per-symbol repo-wide grep verification; (4) data-flow efficiency tracing hot paths end-to-end; (5) correctness + project-standard conformance, including an executed RRULE timezone repro. The two Critical findings (`SEC-1`, `COR-1`) and the top High findings (`COR-2`) were independently re-verified against source during compilation.
