-- Count-habit unit label (steps / reps / pages / meters / kilometers / miles).
-- The behavioral `unit` column stays 'count' | 'time'; this is just the display
-- label for a count goal. Nullable — existing/legacy count habits read as the
-- generic "times".

alter table public.habits add column count_unit text;

alter table public.habits add constraint habits_count_unit_check
  check (
    count_unit is null
    or count_unit in ('count', 'steps', 'reps', 'pages', 'meters', 'kilometers', 'miles')
  );
