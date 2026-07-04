-- Correctness fix (COR-4): habit_completions had no uniqueness on a scheduled
-- occurrence, so a double-tap race or a time-habit's repeated auto-complete
-- could insert several rows for the same (habit_id, occurrence_date). Totals,
-- feed, and history then double-counted, and "reset" only removed one.
--
-- Flex completions are intentionally allowed to repeat within a period
-- (over-target logging is a feature), so the constraint is scoped to rows that
-- represent a scheduled occurrence (occurrence_date is not null).

-- 1. Collapse any existing duplicates, keeping the earliest row per occurrence.
--    (Attachments cascade from the removed duplicates; the kept row is the one
--    the user saw first.)
delete from public.habit_completions a
using public.habit_completions b
where a.occurrence_date is not null
  and a.habit_id = b.habit_id
  and a.occurrence_date = b.occurrence_date
  and (a.created_at, a.id) > (b.created_at, b.id);

-- 2. Enforce one completion per scheduled occurrence going forward.
create unique index if not exists habit_completions_scheduled_occurrence_key
  on public.habit_completions (habit_id, occurrence_date)
  where occurrence_date is not null;
