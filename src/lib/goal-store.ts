import { useEffect, useState } from "react";
import type { Activity, GoalType, Sex } from "./nutrition-math";

export type GoalSettings = {
  type: GoalType;
  age?: number;
  sex: Sex;
  activity: Activity;
  overrideKcal?: number;
  overrideProtein?: number;
  overrideCarbs?: number;
  overrideFat?: number;
};

const KEY = "goal-settings-v1";
const DEFAULT: GoalSettings = { type: "afvallen", sex: "v", activity: "matig" };

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
