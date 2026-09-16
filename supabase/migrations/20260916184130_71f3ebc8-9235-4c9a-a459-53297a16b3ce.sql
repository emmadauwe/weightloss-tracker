ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_workouts boolean NOT NULL DEFAULT true;

CREATE TABLE public.workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sport text NOT NULL,
  duration_min numeric,
  distance_km numeric,
  avg_speed numeric,
  max_speed numeric,
  intensity text,
  note text,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workouts manage own" ON public.workouts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workouts readable by friends" ON public.workouts FOR SELECT TO authenticated
  USING (
    public.are_friends(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = workouts.user_id AND p.share_workouts)
  );

CREATE INDEX workouts_user_date_idx ON public.workouts (user_id, date DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();