import { useEffect, useState } from "react";
import type { Activity, GoalType, Intensity, Lifestyle, Sex } from "./nutrition-math";

export type GoalSettings = {
  type: GoalType;
  age?: number;
  sex: Sex;
  /** Legacy — kept for back-compat when lifestyle is not set. */
  activity: Activity;
  lifestyle?: Lifestyle;
  sessionsPerWeek?: number;
  minutesPerSession?: number;
  intensity?: Intensity;
  overrideKcal?: number;
  overrideProtein?: number;
  overrideCarbs?: number;
  overrideFat?: number;
};

const KEY = "goal-settings-v1";
const DEFAULT: GoalSettings = {
  type: "afvallen",
  sex: "v",
  activity: "matig",
  lifestyle: "zittend",
  sessionsPerWeek: 2,
  minutesPerSession: 45,
  intensity: "matig",
};

export function useGoal() {
  const [goal, setGoal] = useState<GoalSettings>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setGoal({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(goal));
  }, [goal, loaded]);

  return { goal, setGoal, loaded };
}
