-- Allow `until` on flex habits so deleteHabitFuture can soft-expire them.
alter table public.habits drop constraint habits_check;
alter table public.habits add constraint habits_check check (
  (kind = 'scheduled'
     and dtstart is not null and rrule is not null
     and target_count is null and target_period is null)
  or
  (kind = 'flex'
     and target_count is not null and target_count > 0 and target_period is not null
     and dtstart is null and rrule is null)
);
