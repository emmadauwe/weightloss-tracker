import { useMemo } from "react";
import { useGoal } from "./goal-store";
import { useEntries, useSettings } from "./weight-store";
import { computeGoal } from "./nutrition-math";
import { sportOf } from "./workouts";

/**
 * Eén bron van waarheid voor de doelberekening en de actieve macro's
 * (inclusief handmatige aanpassingen) zodat Doel en Planning altijd
 * exact dezelfde cijfers tonen.
 */
export function useGoalTargets() {
  const { goal, setGoal } = useGoal();
  const { settings, setSettings } = useSettings();
  const { entries } = useEntries();

  const toKg = (value?: number) =>
    value === undefined ? undefined : settings.unit === "lb" ? value * 0.453592 : value;

  // Het startgewicht uit je doel telt als eerste meting.
  const currentWeight = entries[entries.length - 1]?.weight ?? settings.startWeight;

  const calc = useMemo(() => {
    if (!currentWeight || !settings.heightCm || !goal.age) return null;
    return computeGoal({
      type: goal.type,
      weightKg: toKg(currentWeight)!,
      startWeightKg: toKg(settings.startWeight),
      goalKg: toKg(settings.goalWeight),
      heightCm: settings.heightCm,
      age: goal.age,
      sex: goal.sex,
      activity: goal.activity,
      lifestyle: goal.lifestyle,
      // Sport wordt per dag bijgeteld op basis van gelogde trainingen.
      sessionsPerWeek: 0,
      minutesPerSession: 0,
      strength: (goal.sports ?? []).some((id) => sportOf(id).kind === "kracht"),
      startDate: settings.startDate,
      endDate: settings.endDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeight, settings, goal]);

  const target = useMemo(
    () => ({
      kcal: goal.overrideKcal ?? calc?.kcal ?? 2000,
      protein: goal.overrideProtein ?? calc?.protein ?? 100,
      carbs: goal.overrideCarbs ?? calc?.carbs ?? 220,
      fat: goal.overrideFat ?? calc?.fat ?? 70,
    }),
    [goal, calc],
  );

  return { goal, setGoal, settings, setSettings, calc, target, currentWeight };
}
