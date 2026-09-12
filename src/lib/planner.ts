import type { Dish, Ingredient, Meal, MealEntry } from "./nutrition-store";
import { dishMacrosPerServing, type Macros } from "./nutrition-math";

export type MacroPriority = "balans" | "eiwit" | "vet";

export const MEAL_ORDER: Meal[] = ["ontbijt", "lunch", "diner", "snack"];
/** Meals that are typically cooked and can be batch-cooked / leftovers. */
const COOKED_MEALS: Meal[] = ["lunch", "diner"];

export type PlanPick = { date: string; meal: Meal; dishId: string };

function pickRandom<T>(list: T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

function sum(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/** Lower is better. Calories always weigh heaviest; the priority tunes the rest. */
export function dayScore(day: Macros, target: Macros, priority: MacroPriority): number {
  const kcalPenalty = Math.abs(day.kcal - target.kcal);
  const proteinShort = Math.max(0, target.protein - day.protein);
  const fatOver = Math.max(0, day.fat - target.fat);
  const carbsOver = Math.max(0, day.carbs - target.carbs);

  if (priority === "eiwit") {
    return kcalPenalty + proteinShort * 18 + fatOver * 0.5 + carbsOver * 0.2;
  }
  if (priority === "vet") {
    return kcalPenalty + fatOver * 18 + proteinShort * 1.5 + carbsOver * 0.5;
  }
  return kcalPenalty + proteinShort * 5 + fatOver * 5 + carbsOver * 1;
}

function macrosForPicks(
  picks: PlanPick[],
  dishes: Dish[],
  ingredients: Ingredient[],
): Map<string, Macros> {
  const byDate = new Map<string, Macros>();
  for (const p of picks) {
    const dish = dishes.find((d) => d.id === p.dishId);
    if (!dish) continue;
    const m = dishMacrosPerServing(dish, ingredients);
    byDate.set(p.date, sum(byDate.get(p.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }, m));
  }
  return byDate;
}

function candidatesFor(meal: Meal, dishes: Dish[]): Dish[] {
  return dishes.filter((d) => d.categories?.includes(meal));
}

/**
 * Generate a plan for one or more days.
 * `cookCount` limits how many *different* cooked dishes (lunch/diner) are used
 * across the whole period — leftovers fill the remaining cooked slots.
 */
export function generatePlan(opts: {
  dates: string[];
  dishes: Dish[];
  ingredients: Ingredient[];
  target: Macros;
  priority: MacroPriority;
  cookCount?: number;
  attempts?: number;
}): PlanPick[] {
  const { dates, dishes, ingredients, target, priority } = opts;
  const attempts = opts.attempts ?? 40;
  if (dates.length === 0) return [];

  const cookedSlots: { date: string; meal: Meal }[] = [];
  for (const date of dates) for (const meal of COOKED_MEALS) cookedSlots.push({ date, meal });

  const cookCount = Math.max(1, Math.min(opts.cookCount ?? cookedSlots.length, cookedSlots.length));
  const repeats = Math.ceil(cookedSlots.length / cookCount);

  const buildAttempt = (): PlanPick[] => {
    const picks: PlanPick[] = [];

    // Cooked meals: pick a limited pool and spread it over consecutive slots.
    const pool: Dish[] = [];
    const cookedCandidates = dishes.filter((d) =>
      COOKED_MEALS.some((m) => d.categories?.includes(m)),
    );
    for (let i = 0; i < cookCount; i++) {
      const pick = pickRandom(cookedCandidates);
      if (pick) pool.push(pick);
    }
    cookedSlots.forEach((slot, index) => {
      const preferred = pool[Math.floor(index / repeats)];
      const dish =
        preferred && preferred.categories?.includes(slot.meal)
          ? preferred
          : pool.find((d) => d.categories?.includes(slot.meal)) ??
            pickRandom(candidatesFor(slot.meal, dishes));
      if (dish) picks.push({ date: slot.date, meal: slot.meal, dishId: dish.id });
    });

    // Other meals: free choice per day.
    for (const date of dates) {
      for (const meal of MEAL_ORDER) {
        if (COOKED_MEALS.includes(meal)) continue;
        const dish = pickRandom(candidatesFor(meal, dishes));
        if (dish) picks.push({ date, meal, dishId: dish.id });
      }
    }
    return picks;
  };

  let best: PlanPick[] = [];
  let bestScore = Infinity;
  for (let i = 0; i < attempts; i++) {
    const picks = buildAttempt();
    const byDate = macrosForPicks(picks, dishes, ingredients);
    let score = 0;
    for (const date of dates) {
      score += dayScore(
        byDate.get(date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        target,
        priority,
      );
    }
    if (score < bestScore) {
      bestScore = score;
      best = picks;
    }
  }
  return best;
}

export function picksToEntries(picks: PlanPick[]): Omit<MealEntry, "id">[] {
  return picks.map((p) => ({
    date: p.date,
    meal: p.meal,
    kind: "dish" as const,
    refId: p.dishId,
    amount: 1,
    unit: "portie" as const,
  }));
}
