alter table public.feedback
  add column status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  add column category text
    check (category in ('bug', 'feature')),
  add column title text,
  add column github_issue_number int,
  add column processed_at timestamptz;
