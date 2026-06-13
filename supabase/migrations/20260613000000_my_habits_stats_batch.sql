-- Batched streak inputs for the day-view: completion/skip history per lineage
-- for every habit the viewer owns, in one round-trip. The day-view is always
-- the user's own home screen, so — unlike fetch_habit_stats (one lineage, with
-- visibility/blocking checks) — this is strictly owner-scoped and needs none of
-- those checks. The streak itself is computed client-side via lib/streak.ts,
-- exactly as the feed and overview do, so all three always agree.

create or replace function public.fetch_my_habits_stats(
  p_viewer_id uuid
)
returns table (
  lineage_id         uuid,
  completion_history jsonb,
  skip_history       jsonb
)
language sql stable
security definer
set search_path = public
as $$
  -- Distinct lineages the viewer owns. A lineage can span several habit rows
  -- (edits fork a new version), so we aggregate history across the whole
  -- lineage, matching fetch_habit_stats.
  with my_lineages as (
    select distinct h.lineage_id
    from public.habits h
    where h.owner_id = p_viewer_id
  )
  select
    ml.lineage_id,
    -- Last 100 completion dates across the lineage (occurrence_date for
    -- scheduled, period_start for flex), newest first.
    coalesce((
      select jsonb_agg(t.d order by t.d desc)
      from (
        select coalesce(hc.occurrence_date, hc.period_start) as d
        from public.habit_completions hc
        join public.habits hh on hh.id = hc.habit_id
        where hh.lineage_id = ml.lineage_id
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
        where hh.lineage_id = ml.lineage_id and ho.kind = 'skip'
        order by ho.occurrence_date desc
        limit 100
      ) s
    ), '[]'::jsonb) as skip_history
  from my_lineages ml;
$$;

grant execute on function public.fetch_my_habits_stats(uuid) to authenticated;
