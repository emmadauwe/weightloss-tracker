ALTER TABLE public.shared_dishes
  ADD COLUMN IF NOT EXISTS direct_macros jsonb,
  ADD COLUMN IF NOT EXISTS portion_amount numeric,
  ADD COLUMN IF NOT EXISTS portion_base text;