-- Per-owner user-controlled habit order.
-- Used for drag-to-reorder in the calendar views; ties on creation are
-- resolved by `created_at`.

alter table public.habits
  add column if not exists sort_index integer not null default 0;

create index if not exists habits_owner_sort_idx
  on public.habits (owner_id, sort_index, created_at);

comment on column public.habits.sort_index is
  'User-controlled ordering of habits across views. Sorted ASC, tie-broken by created_at.';
