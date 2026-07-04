-- Habit alerts: per-habit reminder times, delivered as on-device local
-- notifications (CONTEXT.md § Notifications — local for reminders, push for
-- social). Stored on the habit row like color/visibility so create, edit-all,
-- and "this and future" fork inserts all carry them via draftToInsert.
--
-- Value is a jsonb array of "HH:MM" 24-hour local-time strings, e.g.
-- ["07:30","21:00"]. Format is validated client-side at the form boundary
-- (normalizeAlertTimes); the CHECK pins the shape to an array.

alter table public.habits
  add column alert_times jsonb not null default '[]'::jsonb;

alter table public.habits add constraint habits_alert_times_check
  check (jsonb_typeof(alert_times) = 'array');
