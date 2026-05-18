-- Rate limit: max 5 feedback submissions per user per day.
-- Prevents spam from driving up triage API costs.
create or replace function public.check_feedback_rate_limit()
returns trigger
language plpgsql
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.feedback
  where user_id = NEW.user_id
    and created_at > now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception 'Feedback rate limit exceeded. Maximum 5 per day.';
  end if;

  return NEW;
end;
$$;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row
  execute function public.check_feedback_rate_limit();
