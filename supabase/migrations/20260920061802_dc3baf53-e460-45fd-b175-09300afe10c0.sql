ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS min_speed numeric;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS plan_id uuid;

CREATE TABLE public.workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_owner uuid,
  source_plan uuid,
  source_name text,
  source_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT ALL ON public.workout_plans TO service_role;

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workout plans manage own" ON public.workout_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workout plans readable by friends" ON public.workout_plans
  FOR SELECT TO authenticated
  USING (
    public.are_friends(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = workout_plans.user_id AND p.share_workouts)
  );

CREATE TRIGGER update_workout_plans_updated_at
  BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();