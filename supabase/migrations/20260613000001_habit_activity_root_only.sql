-- Feed "started"/"adopted" events must fire only for a habit's lineage ROOT,
-- never for a fork. A "This and future" edit (applyEditFuture) inserts a new
-- habits row sharing the original's lineage_id to preserve each era's schedule.
-- The old trigger fired on EVERY insert, so a fork wrote a habit_activity
-- 'created' row that fetch_feed_page surfaced as a spurious "started" event.
--
-- A genuine create and an adoption both insert a lineage ROOT: neither passes an
-- explicit lineage_id, so set_habit_lineage sets lineage_id := id. A fork passes
-- the original's lineage_id, so lineage_id <> id. Gating on lineage_id = id thus
-- keeps create/adopt events and drops fork events. (set_habit_lineage is a
-- BEFORE INSERT trigger, so new.lineage_id is already populated when this
-- AFTER INSERT trigger's WHEN is evaluated.)

drop trigger if exists trg_habit_created_activity on public.habits;

create trigger trg_habit_created_activity
  after insert on public.habits
  for each row
  when (new.lineage_id = new.id)
  execute function public.insert_habit_created_activity();

-- Backfill: scrub the spurious activity rows past forks already wrote. A row is
-- spurious iff its habit is not its lineage root.
delete from public.habit_activity a
using public.habits h
where a.habit_id = h.id
  and h.lineage_id <> h.id
  and a.event_type in ('created', 'adopted');
