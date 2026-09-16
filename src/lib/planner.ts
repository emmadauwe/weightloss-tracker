import type { Dish, Ingredient, Meal, MealEntry } from "./nutrition-store";
import { dishMacrosPerServing, type Macros } from "./nutrition-math";

export type MacroPriority = "balans" | "eiwit" | "vet";

export const MEAL_ORDER: Meal[] = ["ontbijt", "lunch", "diner", "snack"];

export type PlanPick = { date: string; meal: Meal; dishId: string; leftoverFrom?: string };

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

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
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: dayScore(sum(existing, dishMacrosPerServing(candidate, ingredients)), partial, priority),
    }))
    .sort((a, b) => a.score - b.score);

  // Variatie zonder de voedingsdoelen los te laten: kies uit de beste passende
  // opties, met een grotere kans voor het gerecht met de laagste afwijking.
  const shortlist = ranked.slice(0, Math.min(4, ranked.length));
  const weights = shortlist.map((_, index) => shortlist.length - index);
  let draw = Math.random() * weights.reduce((total, weight) => total + weight, 0);
  for (let index = 0; index < shortlist.length; index++) {
    draw -= weights[index];
    if (draw <= 0) return shortlist[index].candidate;
  }
  return shortlist[0]?.candidate;
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
  /** Maaltijden die al ingevuld zijn; deze blijven staan en tellen mee. */
  existing?: { date: string; meal: Meal; dishId?: string; macros: Macros }[];
}): PlanPick[] {
  const { dates, dishes, ingredients, target, priority } = opts;
  const attempts = opts.attempts ?? 140;
  if (dates.length === 0) return [];

  const existing = opts.existing ?? [];
  const occupied = new Set(existing.map((e) => `${e.date}|${e.meal}`));
  const baseMacros = new Map<string, Macros>();
  const baseDishes = new Map<string, Set<string>>();
  for (const e of existing) {
    baseMacros.set(e.date, sum(baseMacros.get(e.date) ?? ZERO, e.macros));
    if (e.dishId) {
      const set = baseDishes.get(e.date) ?? new Set<string>();
      set.add(e.dishId);
      baseDishes.set(e.date, set);
    }
  }

  const slots = dates.length * 2; // lunch + diner
  const cookCount = Math.max(1, Math.min(opts.cookCount ?? dates.length, slots));
  // Bij voorkeur 2 porties per kookbeurt; 3 wanneer er weinig kookbeurten zijn.
  const portions = Math.min(3, Math.max(2, Math.round(slots / cookCount)));
  // Een lunch- of dinergerecht mag nooit vaker dan 3 keer per week voorkomen.
  const MAX_PER_DISH = 3;

  const lunchOnly = candidatesFor("lunch", dishes);
  const dinnerCandidates = candidatesFor("diner", dishes);

  const buildAttempt = (): PlanPick[] => {
    const picks: PlanPick[] = [];
    const dayMacrosMap = new Map<string, Macros>(baseMacros);
    const dayOf = (date: string) => dayMacrosMap.get(date) ?? ZERO;
    const push = (date: string, meal: Meal, dish: Dish, leftoverFrom?: string) => {
      picks.push({ date, meal, dishId: dish.id, leftoverFrom });
      dayMacrosMap.set(date, sum(dayOf(date), dishMacrosPerServing(dish, ingredients)));
    };

    const isFree = (date: string, meal: Meal) => !occupied.has(`${date}|${meal}`);

    // Ontbijt eerst: vast deel van het dagbudget.
    for (const date of dates) {
      if (!isFree(date, "ontbijt")) continue;
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
    let leftoverCookDate: string | undefined;
    // Hoe vaak elk lunch-/dinergerecht deze week al gebruikt is (max. 3).
    const useCount = new Map<string, number>();
    const countOf = (id: string) => useCount.get(id) ?? 0;
    const registerUse = (dish: Dish) => useCount.set(dish.id, countOf(dish.id) + 1);
    for (const e of existing) if (e.dishId) registerUse({ id: e.dishId } as Dish);

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const usedToday = new Set([
        ...picks.filter((p) => p.date === date).map((p) => p.dishId),
        ...(baseDishes.get(date) ?? []),
      ]);

      // Lunch: bij voorkeur restjes van gisteren.
      if (!isFree(date, "lunch")) {
        // Deze lunch staat al ingevuld; niet overschrijven.
      } else if (leftoverDish && leftoverCount > 0 && !usedToday.has(leftoverDish.id)) {

        push(date, "lunch", leftoverDish, leftoverCookDate);
        usedToday.add(leftoverDish.id);
        registerUse(leftoverDish);
        leftoverCount -= 1;
      } else {
        const dish = pickForSlot({
          candidates: (lunchOnly.length ? lunchOnly : dishes).filter(
            (d) => !usedToday.has(d.id) && countOf(d.id) < MAX_PER_DISH,
          ),
          existing: dayOf(date),
          ingredients,
          target,
          priority,
          remainingSlots: 3,
        });
        if (dish) {
          push(date, "lunch", dish);
          usedToday.add(dish.id);
          registerUse(dish);
        }
      }

      // Diner: nieuwe kookbeurt zolang er geen restjes meer zijn.
      if (!isFree(date, "diner")) {
        // Dit diner staat al ingevuld; niet overschrijven.
      } else if (leftoverDish && leftoverCount > 0 && !usedToday.has(leftoverDish.id)) {
        push(date, "diner", leftoverDish, leftoverCookDate);
        usedToday.add(leftoverDish.id);
        registerUse(leftoverDish);
        leftoverCount -= 1;
      } else {
        // Een nieuwe kookbeurt levert `portions` porties op; het gerecht mag
        // daarmee nooit boven het weekmaximum van 3 uitkomen.
        const dish = pickForSlot({
          candidates: (dinnerCandidates.length ? dinnerCandidates : dishes).filter(
            (d) => !usedToday.has(d.id) && countOf(d.id) + portions <= MAX_PER_DISH,
          ),
          existing: dayOf(date),
          ingredients,
          target,
          priority,
          remainingSlots: 2,
        });
        if (dish) {
          push(date, "diner", dish);
          usedToday.add(dish.id);
          registerUse(dish);
          leftoverDish = dish;
          leftoverCount = portions - 1;
          leftoverCookDate = date;
        }
      }

      // Snacks sluiten de dag af en vullen het resterende budget aan. Er mogen
      // meerdere (lichte) snacks zijn zolang ze de dag dichter bij het doel brengen.
      if (!isFree(date, "snack")) continue;
      const snackCandidates = candidatesFor("snack", dishes);
      const usedSnacks = new Set<string>();
      for (let s = 0; s < 3; s++) {
        const before = dayScore(dayOf(date), target, priority);
        const snack = pickForSlot({
          candidates: snackCandidates.filter((d) => !usedSnacks.has(d.id)),
          existing: dayOf(date),
          ingredients,
          target,
          priority,
          remainingSlots: 1,
        });
        if (!snack) break;
        const after = dayScore(sum(dayOf(date), dishMacrosPerServing(snack, ingredients)), target, priority);
        if (s > 0 && after >= before) break;
        push(date, "snack", snack);
        usedSnacks.add(snack.id);
      }
    }

    return picks;
  };

  const finalists = new Map<string, { picks: PlanPick[]; score: number }>();
  for (let i = 0; i < attempts; i++) {
    const picks = buildAttempt();
    const byDate = macrosForPicks(picks, dishes, ingredients);
    let score = 0;
    for (const date of dates) {
      score += dayScore(sum(baseMacros.get(date) ?? ZERO, byDate.get(date) ?? ZERO), target, priority);
    }
    const signature = picks.map((pick) => `${pick.date}:${pick.meal}:${pick.dishId}`).join("|");
    const previous = finalists.get(signature);
    if (!previous || score < previous.score) finalists.set(signature, { picks, score });
  }
  const rankedPlans = [...finalists.values()].sort((a, b) => a.score - b.score);
  if (rankedPlans.length === 0) return [];

  // Trek gewogen uit de twaalf beste unieke plannen. Zo blijft een zeer goed
  // passend plan waarschijnlijker, maar levert opnieuw genereren veel variatie.
  const strongPlans = rankedPlans.slice(0, 12);
  const weights = strongPlans.map((_, index) => strongPlans.length - index);
  let draw = Math.random() * weights.reduce((total, weight) => total + weight, 0);
  for (let index = 0; index < strongPlans.length; index++) {
    draw -= weights[index];
    if (draw <= 0) return strongPlans[index].picks;
  }
  return strongPlans[0].picks;
}

export function picksToEntries(picks: PlanPick[]): Omit<MealEntry, "id">[] {
  return picks.map((p) => ({
    date: p.date,
    meal: p.meal,
    kind: "dish" as const,
    refId: p.dishId,
    amount: 1,
    unit: "portie" as const,
    leftoverFrom: p.leftoverFrom,
  }));
}

