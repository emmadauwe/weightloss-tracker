import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type SportKind = "cardio" | "kracht" | "rustig" | "overig";

export type SportType = { id: string; label: string; kind: SportKind };

/** Alle sporten die je kunt bijhouden. */
export const SPORTS: SportType[] = [
  { id: "lopen", label: "Lopen", kind: "cardio" },
  { id: "fietsen", label: "Fietsen", kind: "cardio" },
  { id: "wandelen", label: "Wandelen", kind: "cardio" },
  { id: "zwemmen", label: "Zwemmen", kind: "cardio" },
  { id: "roeien", label: "Roeien", kind: "cardio" },
  { id: "skien", label: "Skiën", kind: "cardio" },
  { id: "krachttraining", label: "Krachttraining", kind: "kracht" },
  { id: "calisthenics", label: "Calisthenics", kind: "kracht" },
  { id: "yoga", label: "Yoga", kind: "rustig" },
  { id: "pilates", label: "Pilates", kind: "rustig" },
  { id: "stretchen", label: "Stretchen", kind: "rustig" },
  { id: "hiit", label: "HIIT", kind: "overig" },
  { id: "voetbal", label: "Voetbal", kind: "overig" },
  { id: "tennis", label: "Tennis", kind: "overig" },
  { id: "padel", label: "Padel", kind: "overig" },
  { id: "basketbal", label: "Basketbal", kind: "overig" },
  { id: "volleybal", label: "Volleybal", kind: "overig" },
  { id: "dansen", label: "Dansen", kind: "overig" },
  { id: "klimmen", label: "Klimmen", kind: "overig" },
  { id: "vechtsport", label: "Vechtsport", kind: "overig" },
  { id: "anders", label: "Andere sport", kind: "overig" },
];

export const INTENSITIES = ["rustig", "gemiddeld", "intensief"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export function sportOf(id: string): SportType {
  return SPORTS.find((s) => s.id === id) ?? { id, label: id, kind: "overig" };
}

export type WorkoutSet = { weight?: number; reps?: number };
export type WorkoutExercise = { name: string; sets: WorkoutSet[] };

export type Workout = {
  id: string;
  user_id: string;
  date: string;
  sport: string;
  duration_min: number | null;
  distance_km: number | null;
  avg_speed: number | null;
  max_speed: number | null;
  intensity: string | null;
  note: string | null;
  exercises: WorkoutExercise[];
  created_at: string;
};

export type WorkoutInput = Omit<Workout, "id" | "user_id" | "created_at"> & { id?: string };

function normalise(row: Record<string, unknown>): Workout {
  return {
    ...(row as unknown as Workout),
    exercises: Array.isArray(row["exercises"]) ? (row["exercises"] as WorkoutExercise[]) : [],
  };
}

/** Je eigen sportprestaties. */
export function useWorkouts() {
  const { user } = useAuth();
  const [items, setItems] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    setItems(((data ?? []) as Record<string, unknown>[]).map(normalise));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (input: WorkoutInput) => {
      if (!user) return;
      const row = {
        user_id: user.id,
        date: input.date,
        sport: input.sport,
        duration_min: input.duration_min,
        distance_km: input.distance_km,
        avg_speed: input.avg_speed,
        max_speed: input.max_speed,
        intensity: input.intensity,
        note: input.note,
        exercises: input.exercises,
      };
      if (input.id) await supabase.from("workouts").update(row).eq("id", input.id);
      else await supabase.from("workouts").insert(row);
      await reload();
    },
    [user, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("workouts").delete().eq("id", id);
      await reload();
    },
    [reload],
  );

  return { items, loading, save, remove, reload };
}

/** Gedeelde sportprestaties van vrienden (alleen wat zij delen). */
export function useFriendWorkouts(ids: string[]) {
  const [byUser, setByUser] = useState<Record<string, Workout[]>>({});
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setByUser({});
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .in("user_id", list)
        .order("date", { ascending: false });
      const out: Record<string, Workout[]> = {};
      for (const raw of (data ?? []) as Record<string, unknown>[]) {
        const w = normalise(raw);
        (out[w.user_id] ??= []).push(w);
      }
      setByUser(out);
    })();
  }, [key]);

  return byUser;
}

export function heaviestSet(w: Workout): number | null {
  let best: number | null = null;
  for (const ex of w.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      if (s.weight != null && (best == null || s.weight > best)) best = s.weight;
    }
  }
  return best;
}

export function totalReps(w: Workout): number {
  return (w.exercises ?? []).reduce(
    (t, ex) => t + (ex.sets ?? []).reduce((n, s) => n + (s.reps ?? 0), 0),
    0,
  );
}

/** Korte samenvatting van één sessie, afhankelijk van het type sport. */
export function workoutSummary(w: Workout): string {
  const parts: string[] = [];
  if (w.distance_km != null) parts.push(`${w.distance_km} km`);
  if (w.duration_min != null) parts.push(`${w.duration_min} min`);
  if (w.avg_speed != null) parts.push(`⌀ ${w.avg_speed.toFixed(1)} km/u`);
  const heavy = heaviestSet(w);
  if (heavy != null) parts.push(`max ${heavy} kg`);
  if (parts.length === 0 && w.intensity) parts.push(w.intensity);
  return parts.join(" · ");
}

/**
 * Is dit een persoonlijk record binnen deze sport?
 * We kijken naar afstand (cardio) en het zwaarste gewicht (kracht).
 */
export function personalRecord(
  workout: Workout,
  history: Workout[],
): { kind: "afstand" | "gewicht" | "duur"; value: number } | null {
  const earlier = history.filter(
    (w) => w.sport === workout.sport && w.id !== workout.id && w.date <= workout.date,
  );
  if (earlier.length === 0) return null;
  const best = (pick: (w: Workout) => number | null) =>
    earlier.reduce<number | null>((m, w) => {
      const v = pick(w);
      return v == null ? m : m == null || v > m ? v : m;
    }, null);

  if (workout.distance_km != null) {
    const b = best((w) => w.distance_km);
    if (b != null && workout.distance_km > b) return { kind: "afstand", value: workout.distance_km };
  }
  const heavy = heaviestSet(workout);
  if (heavy != null) {
    const b = best(heaviestSet);
    if (b != null && heavy > b) return { kind: "gewicht", value: heavy };
  }
  if (workout.distance_km == null && heavy == null && workout.duration_min != null) {
    const b = best((w) => w.duration_min);
    if (b != null && workout.duration_min > b) return { kind: "duur", value: workout.duration_min };
  }
  return null;
}
