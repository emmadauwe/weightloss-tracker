import type { Dish, Ingredient, Meal, MealEntry } from "./nutrition-store";
import { dishMacrosPerServing, type Macros } from "./nutrition-math";

export type MacroPriority = "balans" | "eiwit" | "vet";

export const MEAL_ORDER: Meal[] = ["ontbijt", "lunch", "diner", "snack"];

export type PlanPick = { date: string; meal: Meal; dishId: string };

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function sum(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

function scaleMacros(m: Macros, f: number): Macros {
  return { kcal: m.kcal * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f };
}

/** Lower is better. Calories always weigh heaviest; the priority tunes the rest. */
export function dayScore(day: Macros, target: Macros, priority: MacroPriority): number {
  // Relatieve afwijking zodat alle macro's even zwaar meetellen t.o.v. hun doel.
  const kcalDev = Math.abs(day.kcal - target.kcal) / Math.max(1, target.kcal);
  const proteinShort = Math.max(0, target.protein - day.protein) / Math.max(1, target.protein);
  const proteinOver = Math.max(0, day.protein - target.protein * 1.25) / Math.max(1, target.protein);
  const fatOver = Math.max(0, day.fat - target.fat) / Math.max(1, target.fat);
  const carbsOver = Math.max(0, day.carbs - target.carbs) / Math.max(1, target.carbs);
  const carbsShort = Math.max(0, target.carbs - day.carbs) / Math.max(1, target.carbs);

  const base = kcalDev * 100 + carbsShort * 6 + proteinOver * 4;
  if (priority === "vet") return base + fatOver * 60 + proteinShort * 12 + carbsOver * 8;
  if (priority === "balans") return base + proteinShort * 20 + fatOver * 20 + carbsOver * 10;
  // "eiwit": eiwitdoel halen weegt het zwaarst na de calorieën.
  return base + proteinShort * 45 + fatOver * 14 + carbsOver * 8;
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
    byDate.set(p.date, sum(byDate.get(p.date) ?? ZERO, m));
  }
  return byDate;
}

function candidatesFor(meal: Meal, dishes: Dish[]): Dish[] {
  return dishes.filter((d) => d.categories?.includes(meal));
}

/**
 * Kies het gerecht dat de dag het dichtst bij het doel brengt, rekening
 * houdend met hoeveel maaltijden er die dag nog volgen.
 */
function pickForSlot(opts: {
  candidates: Dish[];
  existing: Macros;
  ingredients: Ingredient[];
  target: Macros;
  priority: MacroPriority;
  remainingSlots: number;
}): Dish | undefined {
  const { candidates, existing, ingredients, target, priority } = opts;
  if (candidates.length === 0) return undefined;
  const slots = Math.max(1, opts.remainingSlots);
  // Tussendoel: het deel van het resterende budget dat bij deze maaltijd hoort.
  const partial: Macros = {
    kcal: existing.kcal + (target.kcal - existing.kcal) / slots,
    protein: existing.protein + (target.protein - existing.protein) / slots,
    carbs: existing.carbs + (target.carbs - existing.carbs) / slots,
    fat: existing.fat + (target.fat - existing.fat) / slots,
  };
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  let best: Dish | undefined;
  let bestScore = Infinity;
  for (const candidate of shuffled) {
    const score = dayScore(sum(existing, dishMacrosPerServing(candidate, ingredients)), partial, priority);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/**
 * Generate a plan for one or more days.
 * `cookCount` limits how many *different* cooked dishes (lunch/diner) are used
 * across the whole period — leftovers fill the remaining cooked slots.
 *
 * Kookritme: 's avonds wordt een verse maaltijd in 2 (of 3) porties gemaakt.
 * De restjes worden meteen de volgende dag(en) 's middags gegeten; daarna
 * wordt er 's avonds opnieuw gekookt.
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
  const attempts = opts.attempts ?? 140;
  if (dates.length === 0) return [];

  const slots = dates.length * 2; // lunch + diner
  const cookCount = Math.max(1, Math.min(opts.cookCount ?? dates.length, slots));
  // 2 of 3 porties per kookbeurt.
  const portions = Math.min(3, Math.max(2, Math.round(slots / cookCount)));

  const lunchOnly = candidatesFor("lunch", dishes);
  const dinnerCandidates = candidatesFor("diner", dishes);

  const buildAttempt = (): PlanPick[] => {
    const picks: PlanPick[] = [];
    const dayMacrosMap = new Map<string, Macros>();
    const dayOf = (date: string) => dayMacrosMap.get(date) ?? ZERO;
    const push = (date: string, meal: Meal, dish: Dish) => {
      picks.push({ date, meal, dishId: dish.id });
      dayMacrosMap.set(date, sum(dayOf(date), dishMacrosPerServing(dish, ingredients)));
    };

    // Ontbijt eerst: vast deel van het dagbudget.
    for (const date of dates) {
      const dish = pickForSlot({
        candidates: candidatesFor("ontbijt", dishes),
        existing: dayOf(date),
        ingredients,
        target,
        priority,
        remainingSlots: 4,
      });
      if (dish) push(date, "ontbijt", dish);
    }

    // Lunch en diner met kook-/restjesritme.
    let leftoverDish: Dish | undefined;
    let leftoverCount = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const usedToday = new Set(picks.filter((p) => p.date === date).map((p) => p.dishId));

      // Lunch: bij voorkeur restjes van gisteren.
      if (leftoverDish && leftoverCount > 0 && !usedToday.has(leftoverDish.id)) {
        push(date, "lunch", leftoverDish);
        usedToday.add(leftoverDish.id);
        leftoverCount -= 1;
      } else {
        const dish = pickForSlot({
          candidates: (lunchOnly.length ? lunchOnly : dishes).filter((d) => !usedToday.has(d.id)),
          existing: dayOf(date),
          ingredients,
          target,
          priority,
          remainingSlots: 3,
        });
        if (dish) {
          push(date, "lunch", dish);
          usedToday.add(dish.id);
        }
      }

      // Diner: nieuwe kookbeurt zolang er geen restjes meer zijn.
      if (leftoverDish && leftoverCount > 0 && !usedToday.has(leftoverDish.id)) {
        push(date, "diner", leftoverDish);
        usedToday.add(leftoverDish.id);
        leftoverCount -= 1;
      } else {
        const dish = pickForSlot({
          candidates: (dinnerCandidates.length ? dinnerCandidates : dishes).filter((d) => !usedToday.has(d.id)),
          existing: dayOf(date),
          ingredients,
          target,
          priority,
          remainingSlots: 2,
        });
        if (dish) {
          push(date, "diner", dish);
          usedToday.add(dish.id);
          leftoverDish = dish;
          leftoverCount = portions - 1;
        }
      }

      // Snack sluit de dag af en vult het resterende budget aan.
      const snack = pickForSlot({
        candidates: candidatesFor("snack", dishes),
        existing: dayOf(date),
        ingredients,
        target,
        priority,
        remainingSlots: 1,
      });
      if (snack) push(date, "snack", snack);
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
      score += dayScore(byDate.get(date) ?? ZERO, target, priority);
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

export const __internal = { scaleMacros };
