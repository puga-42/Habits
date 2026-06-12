-- Habit stats RPC: lineage-wide completion count + the streak inputs
-- (completion/skip history) for the habit overview page. The streak itself is
-- computed client-side (RRULE expansion is client-only here), exactly as the
-- feed does — this returns the same raw material `fetch_feed_page` does so the
-- overview's streak/count always match the feed's for the same habit.
--
-- Visibility mirrors get_user_activity_heatmap: not-blocked, and the lineage's
-- habit is the viewer's own, public, or a friend's friends-visible habit.

create or replace function public.fetch_habit_stats(
  p_target_id  uuid,
  p_viewer_id  uuid,
  p_lineage_id uuid
)
returns table (
  completion_count   int,
  completion_history jsonb,
  skip_history       jsonb
)
language sql stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
    from public.habits h
    where h.lineage_id = p_lineage_id
      and h.owner_id = p_target_id
      and not public.is_blocked(p_viewer_id, p_target_id)
      and (
        p_target_id = p_viewer_id
        or h.visibility = 'public'
        or (h.visibility = 'friends'
            and public.are_friends(p_viewer_id, p_target_id))
      )
    limit 1
  )
  select
    (select count(*)::int
       from public.habit_completions hc
       join public.habits hh on hh.id = hc.habit_id
      where hh.lineage_id = p_lineage_id) as completion_count,
    -- Last 100 completion dates across the lineage (occurrence_date for
    -- scheduled, period_start for flex), newest first.
    coalesce((
      select jsonb_agg(t.d order by t.d desc)
      from (
        select coalesce(hc.occurrence_date, hc.period_start) as d
        from public.habit_completions hc
        join public.habits hh on hh.id = hc.habit_id
        where hh.lineage_id = p_lineage_id
          and coalesce(hc.occurrence_date, hc.period_start) is not null
        order by coalesce(hc.occurrence_date, hc.period_start) desc
        limit 100
      ) t
    ), '[]'::jsonb) as completion_history,
    -- Last 100 skip-override dates across the lineage, newest first. Skips are
    -- neutral in a streak (neither count nor break).
    coalesce((
      select jsonb_agg(s.occurrence_date order by s.occurrence_date desc)
      from (
        select ho.occurrence_date
        from public.habit_overrides ho
        join public.habits hh on hh.id = ho.habit_id
        where hh.lineage_id = p_lineage_id and ho.kind = 'skip'
        order by ho.occurrence_date desc
        limit 100
      ) s
    ), '[]'::jsonb) as skip_history
  where exists (select 1 from allowed);
$$;

grant execute on function public.fetch_habit_stats(uuid, uuid, uuid) to authenticated;
