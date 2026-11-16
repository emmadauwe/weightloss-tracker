import { useCallback } from "react";
import { useCloudDoc } from "@/lib/cloud-store";
import { EMPTY_MUSCLE_CACHE, MUSCLE_CACHE_KEY, analyseMusclesOnce } from "@/lib/muscle-cache";
import { exerciseMuscleKey, type MuscleAnalysis } from "@/lib/muscles";

export function useExerciseMuscles() {
  const { value: cache, setValue, loaded } = useCloudDoc<Record<string, MuscleAnalysis>>(MUSCLE_CACHE_KEY, EMPTY_MUSCLE_CACHE);
  const ensure = useCallback(async (name: string) => {
    const key = exerciseMuscleKey(name);
    if (!loaded || !key) return;
    const saved = cache[key] ?? cache[name.trim().toLowerCase()];
    if (saved) return saved;
    const analysis = await analyseMusclesOnce(name);
    setValue((previous) => ({ ...previous, [key]: analysis }));
    return analysis;
  }, [cache, loaded, setValue]);
  return { cache, loaded, ensure };
}