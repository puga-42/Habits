-- Store the original (uncropped) photo and crop parameters so users can
-- re-edit their avatar without losing the full image.

alter table public.profiles
  add column avatar_original_url text,
  add column avatar_crop_params  jsonb;
