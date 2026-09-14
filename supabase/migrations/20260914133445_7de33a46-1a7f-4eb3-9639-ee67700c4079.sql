ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_progress boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS progress_percent numeric;