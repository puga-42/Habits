-- Groups: identity-based bundles of habits ("become a healthy person"). Member
-- habits render together in a collapsible day-view card and the group carries
-- its own streak. Additive only — no existing migration is modified.
--
-- Membership is TIME-SCOPED and keyed by lineage_id (the user-facing "habit",
-- not a single row — mirrors streak segments / stats RPCs). A membership window
-- [effective_from, effective_until] lets a habit be "removed going forward"
-- (window closed at yesterday) while the group keeps its past completions, OR
-- "removed entirely" (rows deleted). The habit row itself is never touched.

create table public.habit_groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,

  name        text not null check (char_length(name) between 1 and 100),
  color       text,
  icon        text,

  sort_index  integer not null default 0,    -- order of cards on the day-view
  collapsed   boolean not null default false, -- persisted expand/collapse state

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index habit_groups_owner_idx      on public.habit_groups (owner_id);
create index habit_groups_owner_sort_idx on public.habit_groups (owner_id, sort_index, created_at);

create trigger habit_groups_updated_at
  before update on public.habit_groups
  for each row execute function public.set_updated_at();

create table public.habit_group_members (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.habit_groups(id) on delete cascade,
  lineage_id      uuid not null,
  owner_id        uuid not null references public.profiles(id) on delete cascade,

  effective_from  date not null,
  effective_until date,   -- inclusive last member day; null = still a member

  created_at      timestamptz not null default now(),

  check (effective_until is null or effective_until >= effective_from)
);

create index habit_group_members_group_idx   on public.habit_group_members (group_id);
create index habit_group_members_lineage_idx on public.habit_group_members (lineage_id);
create index habit_group_members_owner_idx    on public.habit_group_members (owner_id);

-- One active group per habit at a time: at most one open (effective_until null)
-- membership per lineage. Historical (closed) windows are unconstrained.
create unique index habit_group_members_one_active
  on public.habit_group_members (lineage_id)
  where effective_until is null;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Groups are private to the owner in v1 (no social surface). Owner-only for
-- both read and write. RLS stays the enforcement layer.
alter table public.habit_groups enable row level security;

create policy habit_groups_select on public.habit_groups for select
  using (auth.uid() = owner_id);

create policy habit_groups_modify on public.habit_groups for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

alter table public.habit_group_members enable row level security;

create policy habit_group_members_select on public.habit_group_members for select
  using (auth.uid() = owner_id);

create policy habit_group_members_modify on public.habit_group_members for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
