import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type PlanExercise = {
  name: string;
  /** Optionele YouTube-link met uitleg. */
  youtube?: string;
  /** Standaard aantal sets. */
  sets?: number;
  /** Standaard aantal herhalingen. */
  reps?: number;
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  exercises: PlanExercise[];
  source_owner: string | null;
  source_plan: string | null;
  source_name: string | null;
  source_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlanInput = {
  id?: string;
  name: string;
  sort_order?: number;
  exercises: PlanExercise[];
  /** Bron losmaken bij een eigen wijziging. */
  detach?: boolean;
};

function normalise(row: Record<string, unknown>): WorkoutPlan {
  return {
    ...(row as unknown as WorkoutPlan),
    exercises: Array.isArray(row["exercises"]) ? (row["exercises"] as PlanExercise[]) : [],
  };
}

/** Je eigen fitnessschema's. */
export function useWorkoutPlans() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(((data ?? []) as Record<string, unknown>[]).map(normalise));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (input: WorkoutPlanInput) => {
      if (!user) return;
      const base = {
        user_id: user.id,
        name: input.name,
        sort_order: input.sort_order ?? items.length,
        exercises: input.exercises,
      };
      const row = input.detach
        ? { ...base, source_owner: null, source_plan: null, source_name: null, source_synced_at: null }
        : base;
      if (input.id) await supabase.from("workout_plans").update(row).eq("id", input.id);
      else await supabase.from("workout_plans").insert(row);
      await reload();
    },
    [user, items.length, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("workout_plans").delete().eq("id", id);
      await reload();
    },
    [reload],
  );

  /** Neem het schema van een vriend over. */
  const adopt = useCallback(
    async (plan: WorkoutPlan, ownerName: string) => {
      if (!user) return;
      await supabase.from("workout_plans").insert({
        user_id: user.id,
        name: plan.name,
        sort_order: items.length,
        exercises: plan.exercises,
        source_owner: plan.user_id,
        source_plan: plan.id,
        source_name: ownerName,
        source_synced_at: new Date().toISOString(),
      });
      await reload();
    },
    [user, items.length, reload],
  );

  return { items, loading, save, remove, adopt, reload };
}

/** Gedeelde fitnessschema's van vrienden (RLS toont ze alleen bij sport delen). */
export function useFriendWorkoutPlans(ids: string[]) {
  const [byUser, setByUser] = useState<Record<string, WorkoutPlan[]>>({});
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setByUser({});
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("*")
        .in("user_id", list)
        .order("sort_order", { ascending: true });
      const out: Record<string, WorkoutPlan[]> = {};
      for (const raw of (data ?? []) as Record<string, unknown>[]) {
        const p = normalise(raw);
        (out[p.user_id] ??= []).push(p);
      }
      setByUser(out);
    })();
  }, [key]);

  return byUser;
}
