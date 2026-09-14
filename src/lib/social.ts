import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Privacy = {
  share_weight: boolean;
  share_goal: boolean;
  share_progress: boolean;
  share_macros: boolean;
  share_streak: boolean;
  share_dishes: boolean;
};

export type ProfileRow = Privacy & {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_id: string | null;
};

export type StatsRow = {
  user_id: string;
  goal_type: string | null;
  unit: string | null;
  start_weight: number | null;
  current_weight: number | null;
  goal_weight: number | null;
  change_kg: number | null;
  progress_percent: number | null;
  streak_days: number | null;
  kcal_target: number | null;
  kcal_today: number | null;
  protein_target: number | null;
  protein_today: number | null;
  updated_at: string;
};

export type SharedDishRow = {
  id: string;
  owner_id: string;
  local_id: string | null;
  name: string;
  servings: number;
  recipe_url: string | null;
  steps: string[];
  items: SharedDishItem[];
  categories: string[];
};

export type SharedDishItem = {
  name: string;
  amount: number;
  unit: string;
  baseUnit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category?: string;
};

/* ---------------- eigen profiel (gedeeld met vrienden) ---------------- */

let cachedProfile: ProfileRow | null = null;
let cachedFor: string | null = null;
let profileLoaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useMyProfile() {
  const { user } = useAuth();
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      cachedProfile = null;
      cachedFor = null;
      profileLoaded = false;
      return;
    }
    if (cachedFor === user.id) return;
    cachedFor = user.id;
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      let row = data as ProfileRow | null;
      if (!row) {
        const { data: ins } = await supabase
          .from("profiles")
          .insert({ id: user.id, email: user.email ?? null })
          .select("*")
          .maybeSingle();
        row = (ins as ProfileRow) ?? null;
      } else if (row.email !== (user.email ?? null)) {
        await supabase.from("profiles").update({ email: user.email ?? null }).eq("id", user.id);
        row = { ...row, email: user.email ?? null };
      }
      cachedProfile = row;
      profileLoaded = true;
      emit();
    })();
  }, [user]);

  const update = useCallback(
    async (patch: Partial<ProfileRow>) => {
      if (!user) return;
      cachedProfile = cachedProfile ? { ...cachedProfile, ...patch } : cachedProfile;
      emit();
      await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    },
    [user],
  );

  return { profile: cachedProfile, loaded: profileLoaded, update };
}

/* ---------------- vrienden ---------------- */

export type FriendLink = {
  id: string;
  friendId: string;
  status: "pending" | "accepted";
  direction: "in" | "out";
  profile: ProfileRow | null;
};

export function useFriends() {
  const { user } = useAuth();
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("friendships").select("*");
    const rows = data ?? [];
    const ids = rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id));
    let profiles: ProfileRow[] = [];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("*").in("id", ids);
      profiles = (ps ?? []) as ProfileRow[];
    }
    setLinks(
      rows.map((r) => {
        const friendId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
        return {
          id: r.id,
          friendId,
          status: r.status as "pending" | "accepted",
          direction: r.requester_id === user.id ? "out" : "in",
          profile: profiles.find((p) => p.id === friendId) ?? null,
        };
      }),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const findByEmail = useCallback(async (email: string) => {
    const { data, error } = await supabase.rpc("find_user_by_email", { _email: email });
    if (error) return null;
    const row = (data ?? [])[0];
    return row ? { id: row.id as string, display_name: row.display_name as string | null, avatar_id: row.avatar_id as string | null } : null;
  }, []);

  const sendRequest = useCallback(
    async (friendId: string) => {
      if (!user) return { error: "Niet ingelogd" };
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user.id, addressee_id: friendId });
      await reload();
      return { error: error ? "Er loopt al een verzoek met deze persoon." : null };
    },
    [user, reload],
  );

  const accept = useCallback(
    async (linkId: string) => {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", linkId);
      await reload();
    },
    [reload],
  );

  const removeLink = useCallback(
    async (linkId: string) => {
      await supabase.from("friendships").delete().eq("id", linkId);
      await reload();
    },
    [reload],
  );

  return {
    links,
    loading,
    friends: links.filter((l) => l.status === "accepted"),
    incoming: links.filter((l) => l.status === "pending" && l.direction === "in"),
    outgoing: links.filter((l) => l.status === "pending" && l.direction === "out"),
    findByEmail,
    sendRequest,
    accept,
    removeLink,
    reload,
  };
}

export function useFriendStats(ids: string[]) {
  const key = ids.join(",");
  const [stats, setStats] = useState<Record<string, StatsRow>>({});
  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) {
      setStats({});
      return;
    }
    void (async () => {
      const { data } = await supabase.from("user_stats").select("*").in("user_id", list);
      const map: Record<string, StatsRow> = {};
      for (const row of (data ?? []) as StatsRow[]) map[row.user_id] = row;
      setStats(map);
    })();
  }, [key]);
  return stats;
}

/* ---------------- high fives ---------------- */

export type HighFiveRow = {
  id: string;
  from_user: string;
  to_user: string;
  kind: string;
  seen: boolean;
  created_at: string;
};

export function useHighFives() {
  const { user } = useAuth();
  const [received, setReceived] = useState<HighFiveRow[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("high_fives")
      .select("*")
      .eq("to_user", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setReceived((data ?? []) as HighFiveRow[]);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = useCallback(
    async (toUser: string, kind: string) => {
      if (!user) return;
      await supabase.from("high_fives").insert({ from_user: user.id, to_user: toUser, kind });
    },
    [user],
  );

  const markSeen = useCallback(async () => {
    if (!user) return;
    await supabase.from("high_fives").update({ seen: true }).eq("to_user", user.id).eq("seen", false);
    await reload();
  }, [user, reload]);

  const markSeenOne = useCallback(
    async (id: string) => {
      setReceived((rows) => rows.map((r) => (r.id === id ? { ...r, seen: true } : r)));
      await supabase.from("high_fives").update({ seen: true }).eq("id", id);
    },
    [],
  );

  return { received, unseen: received.filter((h) => !h.seen), send, markSeen, markSeenOne, reload };
}

/* ---------------- gedeelde gerechten ---------------- */

export function useFriendDishes(ownerId: string | undefined) {
  const [dishes, setDishes] = useState<SharedDishRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ownerId) return;
    void (async () => {
      const { data } = await supabase.from("shared_dishes").select("*").eq("owner_id", ownerId);
      setDishes(((data ?? []) as unknown[]).map((d) => d as SharedDishRow));
      setLoading(false);
    })();
  }, [ownerId]);
  return { dishes, loading };
}

/* ---------------- highlights voor de vriendenfeed ---------------- */

/** Hoeveel iemand in de goede richting is opgeschoven (kg, altijd positief). */
export function progressKg(stats?: StatsRow | null): number | null {
  if (!stats || stats.change_kg == null) return null;
  const gained = stats.change_kg > 0;
  const wantsGain = stats.goal_type === "bijkomen" || stats.goal_type === "spiermassa";
  const good = wantsGain ? gained : !gained;
  return good ? Math.abs(stats.change_kg) : -Math.abs(stats.change_kg);
}

export function goalReached(stats?: StatsRow | null): boolean {
  if (!stats || stats.current_weight == null || stats.goal_weight == null) return false;
  const wantsGain = stats.goal_type === "bijkomen" || stats.goal_type === "spiermassa";
  return wantsGain ? stats.current_weight >= stats.goal_weight : stats.current_weight <= stats.goal_weight;
}

export function goalProgressPercent(stats?: StatsRow | null): number | null {
  if (
    !stats ||
    stats.start_weight == null ||
    stats.current_weight == null ||
    stats.goal_weight == null ||
    stats.start_weight === stats.goal_weight
  ) return null;
  const progress = ((stats.current_weight - stats.start_weight) / (stats.goal_weight - stats.start_weight)) * 100;
  return Math.max(0, Math.min(100, progress));
}

export function friendHighlights(stats?: StatsRow | null): string[] {
  if (!stats) return [];
  const out: string[] = [];
  const unit = stats.unit ?? "kg";

  if (goalReached(stats)) out.push("Doelgewicht bereikt 🎉");

  const progress = goalProgressPercent(stats);
  if (progress != null && !goalReached(stats)) out.push(`${progress.toFixed(0)}% vooruitgang naar doel`);

  if (stats.current_weight != null && stats.goal_weight != null && !goalReached(stats)) {
    out.push(`Nog ${Math.abs(stats.current_weight - stats.goal_weight).toFixed(1)} ${unit} te gaan`);
  }

  if (stats.streak_days != null && stats.streak_days >= 3) {
    out.push(`${stats.streak_days} dagen op rij bijgehouden`);
  }
  return out;
}
