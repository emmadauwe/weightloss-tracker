import { useCloudDoc } from "./cloud-store";
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

export const GOAL_KEY = "goal-settings-v1";
export const DEFAULT_GOAL: GoalSettings = {
  type: "afvallen",
  sex: "v",
  activity: "matig",
  lifestyle: "zittend",
  sessionsPerWeek: 2,
  minutesPerSession: 45,
  intensity: "matig",
};

export function useGoal() {
  const { value, setValue, loaded } = useCloudDoc<GoalSettings>(GOAL_KEY, DEFAULT_GOAL);
  return { goal: { ...DEFAULT_GOAL, ...value }, setGoal: setValue, loaded };
}
