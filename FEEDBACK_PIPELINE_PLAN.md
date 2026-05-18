# Feedback Pipeline — Implementation Plan

Automated pipeline: user feedback lands in `public.feedback` → Edge Function
triages and creates a GitHub issue → Claude Code routine (Pro plan) picks up
new issues, implements, and opens a PR for review.

## Architecture

```
User submits feedback (app/app/feedback.tsx)
        │
        ▼
┌─────────────────────┐
│  feedback table      │──── INSERT webhook
└─────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  Edge Function: dispatch-feedback │
│  1. Claim row (status→processing) │
│  2. Triage via Claude Sonnet API  │
│  3. Create labeled GitHub Issue   │
│  4. Update row → done             │
└──────────────────────────────────┘
        │
        │  issue labeled "automated" appears on GitHub
        ▼
┌──────────────────────────────────────────┐
│  Claude Code Scheduled Routine (Pro plan) │
│  Polls GitHub for open "automated" issues │
│                                           │
│  For each issue without a linked PR:      │
│  1. Create branch                         │
│  2. Write PLAN.md                         │
│  3. Implement feature/fix                 │
│  4. Run typecheck + lint + test           │
│  5. Push + open PR                        │
└──────────────────────────────────────────┘
        │
        ▼
   Human reviews PR
```

**Why this approach:**
- **Secrets stay in Supabase** — the Edge Function holds API keys; the routine needs zero secrets
- Implementation compute is covered by your Pro subscription
- Only lightweight CI check uses GitHub Actions minutes
- Clean separation: Edge Function handles triage + bookkeeping, routine handles implementation

---

## Component 1: Database Schema Changes

**File:** `supabase/migrations/20260517200000_feedback_pipeline.sql`

Extend the existing `feedback` table with pipeline state tracking:

```sql
alter table public.feedback
  add column status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  add column category text
    check (category in ('bug', 'feature')),
  add column title text,
  add column github_issue_number int,
  add column processed_at timestamptz;
```

State machine: `pending` → `processing` → `done`/`failed`

---

## Component 2: Edge Function — `dispatch-feedback`

**File:** `supabase/functions/dispatch-feedback/index.ts`

Follows the same pattern as `notify-on-friend-request`. Triggered by a DB
webhook on feedback INSERT. Triages with Claude Sonnet API and creates a
labeled GitHub issue. The routine (Component 3) picks up from there.

### Secrets (set via `supabase secrets set`)

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude Sonnet triage calls |
| `GITHUB_TOKEN` | Fine-grained PAT: Issues (read/write) on puga-42/Habits |
| `GITHUB_OWNER` | `puga-42` |
| `GITHUB_REPO` | `Habits` |

### Webhook config (Supabase Studio → Database → Webhooks)

| Name | Table | Event | Function |
|------|-------|-------|----------|
| `feedback_inserted` | `feedback` | `INSERT` | `dispatch-feedback` |

---

## Component 3: Claude Code Scheduled Routine

Created via `/schedule` in Claude Code. Runs on Anthropic's cloud infrastructure.
Polls GitHub for open issues labeled `automated` that have no linked PR, then
implements each one.

**No secrets needed** — the routine accesses GitHub via the Claude GitHub App.

### Routine prompt

```
You are the feedback pipeline agent for the Habits app (github.com/puga-42/Habits).

## Your job
Check GitHub for open issues labeled "automated" that do not yet have a linked PR.
Use: gh issue list --label automated --state open --json number,title,body,labels

For each issue (process at most 3 per run):

1. Check if a branch `feedback/{issue-number}-*` or a PR referencing the issue already
   exists. If so, skip it.

2. Create a branch: `feedback/{issue-number}-{title-slug}`

3. Read CONTEXT.md and CLAUDE.md thoroughly.

4. Write a concise PLAN.md (< 50 lines) at the repo root describing your approach.

5. Implement the change following existing codebase patterns.
   - Write tests for every new function (colocate in app/lib/__tests__/).
   - Use TDD: write failing tests first, then implement until they pass.

6. Run validation: cd app && npm run typecheck && npm run lint && npm run test
   Fix failures (max 3 attempts). If stuck, note the blocker in PLAN.md.

7. Commit and push the branch.

8. Open a PR with `gh pr create` that closes the issue:
   Title: the issue title
   Body: Closes #{issue-number}, summary of changes, verification checklist.

If no open automated issues need work, exit immediately.

## Constraints
- Use CONTEXT.md vocabulary exactly.
- No streaks, completion rates, or gamification.
- No new npm dependencies without strong justification noted in PLAN.md.
- Max 200 lines per file; split if larger.
- Follow existing patterns (check similar files before creating new ones).
- Do not modify existing migration files — create new ones only.
- Max 10 files changed per PR. Implement the smallest viable slice.
- No UI copy that mentions streaks, percentages, or "days in a row."
```

### Schedule

Every hour (minimum allowed interval). The routine is idempotent — if no
unlinked automated issues exist, it exits immediately.

---

## Component 4: CI Quality Gate (all PRs)

**File:** `.github/workflows/ci.yml`

Lightweight GitHub Actions workflow — only runs on PRs to validate independently.

```yaml
name: CI
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd app && npm ci
      - run: cd app && npm run typecheck
      - run: cd app && npm run lint
      - run: cd app && npm run test -- --ci
```

---

## Component 5: Guardrails — CLAUDE.md

Already updated with Code Standards, Security, and Automated Agent Rules sections.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/20260517200000_feedback_pipeline.sql` | Create — adds pipeline columns |
| `supabase/functions/dispatch-feedback/index.ts` | Create — triage + issue creation |
| `.github/workflows/ci.yml` | Create — PR quality gate |
| `CLAUDE.md` | Update — guardrails for agents |

The routine itself lives in Anthropic's cloud — no file in the repo.

---

## Setup Checklist (manual, one-time)

1. **Run the migration:** `supabase db push`

2. **Create GitHub labels:**
   ```bash
   gh label create automated --color 0e8a16
   gh label create bug --color d73a4a
   gh label create feature --color a2eeef
   gh label create "priority:low" --color c5def5
   gh label create "priority:medium" --color fbca04
   gh label create "priority:high" --color b60205
   ```

3. **Set Supabase Edge Function secrets:**
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set GITHUB_TOKEN=github_pat_...
   supabase secrets set GITHUB_OWNER=puga-42
   supabase secrets set GITHUB_REPO=Habits
   ```

4. **Deploy the Edge Function:** `supabase functions deploy dispatch-feedback`

5. **Configure webhook** in Supabase Studio → Database → Webhooks:
   - Table: `feedback`, Event: `INSERT`, Function: `dispatch-feedback`

6. **Install Claude GitHub App** on puga-42/Habits

7. **Set up the Claude Code routine** via `/schedule` (every hour)

---

## Verification

| Test | How |
|------|-----|
| Edge Function | `supabase functions serve dispatch-feedback` + curl a test payload |
| Routine | Insert test feedback → verify issue created → routine picks up → PR opened |
| Guardrail | Submit "add streaks" → verify agent doesn't add gamification |
| CI gate | Push branch with type error → CI fails |

---

## Cost

| Component | Cost |
|-----------|------|
| Claude Sonnet triage (Edge Function) | ~$0.01 per feedback item |
| Claude Code routine (Pro plan) | $0 incremental (covered by subscription) |
| GitHub Actions CI (~2 min per PR) | ~$0.01 per PR |
| **Total per feedback item** | **~$0.02** |

---

## Latency

- Feedback submitted → Edge Function fires: **< 1 second** (webhook)
- Triage + issue creation: **~5 seconds**
- Routine picks up issue: **0–60 minutes** (hourly poll)
- Implementation + tests + PR: **5–30 minutes**
- **Total end-to-end: ~5–90 minutes**
