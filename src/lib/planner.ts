import type { Dish, Ingredient, Meal, MealEntry } from "./nutrition-store";
import { dishMacrosPerServing, type Macros } from "./nutrition-math";

export type MacroPriority = "balans" | "eiwit" | "vet";

export const MEAL_ORDER: Meal[] = ["ontbijt", "lunch", "diner", "snack"];

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

function pickBestComplement(
  meal: Meal,
  existing: Macros,
  dishes: Dish[],
  ingredients: Ingredient[],
  target: Macros,
  priority: MacroPriority,
): Dish | undefined {
  const candidates = candidatesFor(meal, dishes);
  if (candidates.length === 0) return undefined;
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.reduce<Dish | undefined>((best, candidate) => {
    if (!best) return candidate;
    const candidateScore = dayScore(sum(existing, dishMacrosPerServing(candidate, ingredients)), target, priority);
    const bestScore = dayScore(sum(existing, dishMacrosPerServing(best, ingredients)), target, priority);
    return candidateScore < bestScore ? candidate : best;
  }, undefined);
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

  const cookCount = Math.max(1, Math.min(opts.cookCount ?? dates.length, dates.length));

  const buildAttempt = (): PlanPick[] => {
    const picks: PlanPick[] = [];

    // Breakfast and snacks establish part of the daily macro budget first.
    for (const date of dates) {
      for (const meal of ["ontbijt", "snack"] as Meal[]) {
        const current = macrosForPicks(picks.filter((p) => p.date === date), dishes, ingredients).get(date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        const dish = pickBestComplement(meal, current, dishes, ingredients, target, priority);
        if (dish) picks.push({ date, meal, dishId: dish.id });
      }
    }

    // New batch meals always start at dinner. Their extra portions become later leftovers.
    const dinnerCandidates = candidatesFor("diner", dishes);
    const sessions = Array.from({ length: cookCount }, (_, i) =>
      Math.min(dates.length - 1, Math.floor((i * dates.length) / cookCount)),
    );
    const batches = sessions.map((dateIndex, index) => ({
      dateIndex,
      dish: pickRandom(dinnerCandidates),
      uses: 0,
      targetUses: Math.floor((dates.length * 2) / cookCount) + (index < (dates.length * 2) % cookCount ? 1 : 0),
    })).filter((batch): batch is { dateIndex: number; dish: Dish; uses: number; targetUses: number } => Boolean(batch.dish));

    for (const batch of batches) {
      picks.push({ date: dates[batch.dateIndex], meal: "diner", dishId: batch.dish.id });
      batch.uses += 1;
    }

    // Every cooked dinner supplies later leftovers. Prefer the next lunch, then a later dinner.
    for (const batch of batches) {
      for (let day = batch.dateIndex + 1; day < dates.length && batch.uses < batch.targetUses; day++) {
        for (const meal of ["lunch", "diner"] as Meal[]) {
          if (batch.uses >= batch.targetUses) break;
          if (!batch.dish.categories?.includes(meal)) continue;
          if (picks.some((p) => p.date === dates[day] && p.meal === meal)) continue;
          if (picks.some((p) => p.date === dates[day] && p.dishId === batch.dish.id)) continue;
          picks.push({ date: dates[day], meal, dishId: batch.dish.id });
          batch.uses += 1;
        }
      }
    }

    // Fill remaining lunches and dinners as complementary pairs, never duplicating a dish on one day.
    for (let day = 0; day < dates.length; day++) {
      for (const meal of ["lunch", "diner"] as Meal[]) {
        if (picks.some((p) => p.date === dates[day] && p.meal === meal)) continue;
        const sameDayDishIds = new Set(picks.filter((p) => p.date === dates[day]).map((p) => p.dishId));
        const available = dishes.filter((dish) => !sameDayDishIds.has(dish.id));
        const existing = macrosForPicks(picks.filter((p) => p.date === dates[day]), dishes, ingredients).get(dates[day]) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        const dish = pickBestComplement(meal, existing, available, ingredients, target, priority);
        if (dish) picks.push({ date: dates[day], meal, dishId: dish.id });
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
