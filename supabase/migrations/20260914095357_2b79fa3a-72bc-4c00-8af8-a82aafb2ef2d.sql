-- Profiles (shared, friend-visible)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_id text,
  share_weight boolean NOT NULL DEFAULT true,
  share_goal boolean NOT NULL DEFAULT true,
  share_macros boolean NOT NULL DEFAULT true,
  share_streak boolean NOT NULL DEFAULT true,
  share_dishes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.friend_status AS ENUM ('pending','accepted');

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  )
$$;

CREATE POLICY "Profiles readable by self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Profiles readable by friends" ON public.profiles FOR SELECT TO authenticated USING (public.are_friends(auth.uid(), id));
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Friendships visible to both" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "Friendships created by requester" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Friendships answered by addressee" ON public.friendships FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
CREATE POLICY "Friendships removable by both" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

-- Shared progress snapshot (only fields the owner allows are written)
CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text,
  unit text,
  start_weight numeric,
  current_weight numeric,
  goal_weight numeric,
  change_kg numeric,
  streak_days integer,
  kcal_target integer,
  kcal_today integer,
  protein_target integer,
  protein_today integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats manage own" ON public.user_stats FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Stats readable by friends" ON public.user_stats FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

-- Shared recipes
CREATE TABLE public.shared_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id text,
  name text NOT NULL,
  servings numeric NOT NULL DEFAULT 1,
  recipe_url text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, local_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_dishes TO authenticated;
GRANT ALL ON public.shared_dishes TO service_role;
ALTER TABLE public.shared_dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared dishes manage own" ON public.shared_dishes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Shared dishes readable by friends" ON public.shared_dishes FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), owner_id));

-- High fives
CREATE TABLE public.high_fives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.high_fives TO authenticated;
GRANT ALL ON public.high_fives TO service_role;
ALTER TABLE public.high_fives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "High fives sent by friends" ON public.high_fives FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid() AND public.are_friends(auth.uid(), to_user));
CREATE POLICY "High fives visible to both" ON public.high_fives FOR SELECT TO authenticated
  USING (auth.uid() IN (from_user, to_user));
CREATE POLICY "High fives updatable by receiver" ON public.high_fives FOR UPDATE TO authenticated
  USING (to_user = auth.uid()) WITH CHECK (to_user = auth.uid());
CREATE POLICY "High fives deletable by sender" ON public.high_fives FOR DELETE TO authenticated
  USING (from_user = auth.uid());

-- Exact-email lookup so emails are never listed
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE (id uuid, display_name text, avatar_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_id
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email)) AND p.id <> auth.uid()
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

CREATE INDEX idx_friendships_addressee ON public.friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON public.friendships (requester_id, status);
CREATE INDEX idx_shared_dishes_owner ON public.shared_dishes (owner_id);
CREATE INDEX idx_high_fives_to ON public.high_fives (to_user, created_at DESC);