## Always
- Ask clarifying questions before implementation (skip in headless/automated mode)
- Use TDD: write failing tests first, then implement until they pass, then refactor
- Write tests for every new function or bug fix
- Read CONTEXT.md before architectural or test work
- Use CONTEXT.md vocabulary in all code, tests, and discussions

## Code Standards
- Max 200 lines per file. Split if larger.
- Streaks and raw completion counts are allowed (see CONTEXT.md § Stats and history). Still NO completion-rate percentages, freeze tokens, or point/level systems.
- No new npm dependencies without justification in PLAN.md.
- Follow existing patterns: check similar files before writing new ones.
- Colocate tests in `lib/__tests__/` matching the source filename.
- Use structured error objects (`{ kind: 'error_type', ...details }`).
- Prefer pure functions tested without mocks over side-effectful code.
- TypeScript strict mode — no `any` unless unavoidable and commented.

## Security
- Never commit secrets, tokens, or credentials.
- Validate all user input at system boundaries.
- Supabase RLS is the enforcement layer — never bypass it from client code.
- No eval(), no dynamic SQL, no unsanitized interpolation.
- Storage paths must follow `{owner_id}/{completion_id}/{uuid}.{ext}` pattern.

## Database
- Supabase runs as a **remote project** (not local). Use `npx supabase db push` to apply migrations.
- `npx supabase db reset` only affects the local instance and will NOT update the remote database.

## Automated Agent Rules
- Create PLAN.md before writing code.
- Run `cd app && npm run typecheck && npm run lint && npm run test` before committing.
- If tests fail after 3 attempts, stop and document the blocker.
- Do not modify existing migration files — only create new ones.
- Do not delete or rename existing public API functions.
- Maximum 10 files changed per PR. Implement the smallest viable slice.
- PR description must reference the GitHub issue number.
- Streaks are allowed in UI copy. Still no completion-rate percentages.