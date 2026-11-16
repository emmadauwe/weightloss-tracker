import { analyseExerciseMuscles, exerciseMuscleKey, type MuscleAnalysis } from "./muscles";

export const MUSCLE_CACHE_KEY = "exercise-muscle-analysis-v1";
export const EMPTY_MUSCLE_CACHE: Record<string, MuscleAnalysis> = {};
const pending = new Map<string, Promise<MuscleAnalysis>>();

/** Share an in-flight analysis across the editor and exercise view. */
export function analyseMusclesOnce(name: string, analyse = analyseExerciseMuscles) {
  const key = exerciseMuscleKey(name);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = analyse(name).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}