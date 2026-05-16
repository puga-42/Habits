create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
