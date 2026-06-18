-- Add 'rest' to the like_target_kind enum so the shared likers reader
-- (fetch_likers_page) can return who liked a rest post. Kept in its own
-- migration: a new enum value can't be USED in the same transaction that adds
-- it, and the next migration's fetch_likers_page references 'rest'.

alter type public.like_target_kind add value if not exists 'rest';
