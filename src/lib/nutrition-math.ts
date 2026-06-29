import type { Dish, Ingredient, MealEntry, Unit } from "./nutrition-store";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

function scale(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  };
}

/**
 * Compute macros for a given amount + unit of an ingredient.
 * If units don't match well, we do the best-effort conversion.
 */
export function ingredientMacros(ing: Ingredient, amount: number, unit: Unit): Macros {
  const base: Macros = { kcal: ing.kcal, protein: ing.protein, carbs: ing.carbs, fat: ing.fat };
  if (ing.baseUnit === "g" || ing.baseUnit === "ml") {
    // base macros are per 100 of baseUnit
    if (unit === ing.baseUnit) return scale(base, amount / 100);
    if (unit === "stuk" || unit === "portie") return scale(base, amount * 1); // assume 100g/ml per stuk fallback
    return scale(base, amount / 100);
  }
  // baseUnit stuk/portie: macros per 1
  return scale(base, amount);
}

export function dishMacros(dish: Dish, ingredients: Ingredient[]): Macros {
  let total = ZERO;
  for (const item of dish.items) {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) continue;
    total = addMacros(total, ingredientMacros(ing, item.amount, item.unit));
  }
  return total;
}

export function dishMacrosPerServing(dish: Dish, ingredients: Ingredient[]): Macros {
  const t = dishMacros(dish, ingredients);
  const s = Math.max(1, dish.servings);
  return scale(t, 1 / s);
}

export function mealEntryMacros(
  e: MealEntry,
  ingredients: Ingredient[],
  dishes: Dish[],
): Macros {
  if (e.kind === "ingredient") {
    const ing = ingredients.find((i) => i.id === e.refId);
    if (!ing) return ZERO;
    return ingredientMacros(ing, e.amount, e.unit);
  }
  const dish = dishes.find((d) => d.id === e.refId);
  if (!dish) return ZERO;
  // amount = servings consumed
  return scale(dishMacrosPerServing(dish, ingredients), e.amount);
}

export function dayMacros(
  date: string,
  meals: MealEntry[],
  ingredients: Ingredient[],
  dishes: Dish[],
): Macros {
  return meals
    .filter((m) => m.date === date)
    .reduce((acc, m) => addMacros(acc, mealEntryMacros(m, ingredients, dishes)), ZERO);
}

/* --------- Goals --------- */

export type GoalType = "afvallen" | "behouden" | "bijkomen" | "spiermassa";
export type Sex = "v" | "m";
export type Activity = "laag" | "matig" | "hoog";

const ACTIVITY_FACTOR: Record<Activity, number> = { laag: 1.3, matig: 1.55, hoog: 1.75 };

export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "m" ? base + 5 : base - 161;
}

export function tdee(weightKg: number, heightCm: number, age: number, sex: Sex, act: Activity) {
  return bmr(weightKg, heightCm, age, sex) * ACTIVITY_FACTOR[act];
}

export type GoalCalc = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  perWeekKg: number; // negative = afvallen
  tdee: number;
  warnings: string[];
};

export function computeGoal(opts: {
  type: GoalType;
  weightKg: number;
  goalKg?: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: Activity;
  startDate?: string;
  endDate?: string;
}): GoalCalc | null {
  const { type, weightKg, goalKg, heightCm, age, sex, activity, startDate, endDate } = opts;
  if (!weightKg || !heightCm || !age) return null;
  const t = tdee(weightKg, heightCm, age, sex, activity);

  let perWeekKg = 0;
  if (goalKg && startDate && endDate && (type === "afvallen" || type === "bijkomen")) {
    const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
    if (days > 0) perWeekKg = ((goalKg - weightKg) / days) * 7;
  }

  let kcal = t;
  if (type === "afvallen") kcal = t + (perWeekKg ? (perWeekKg * 7700) / 7 : -500);
  else if (type === "bijkomen") kcal = t + (perWeekKg ? (perWeekKg * 7700) / 7 : 300);
  else if (type === "spiermassa") kcal = t + 300;

  // Macros
  const proteinPerKg = type === "spiermassa" ? 2.0 : 1.8;
  const protein = Math.round(proteinPerKg * weightKg);
  const fatKcal = kcal * 0.28;
  const fat = Math.round(fatKcal / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  const warnings: string[] = [];
  const minKcal = sex === "v" ? 1500 : 1800;
  if (kcal < minKcal) warnings.push(`Kcal-doel onder ${minKcal} is mogelijk ongezond.`);
  if (type === "afvallen" && perWeekKg < -1.0)
    warnings.push("Tempo > 1 kg/week is te ambitieus — kies een latere einddag.");
  if (type === "bijkomen" && perWeekKg > 0.5)
    warnings.push("Bijkomen > 0,5 kg/week leidt meestal tot extra vet.");
  if (protein / weightKg < 0.8) warnings.push("Eiwitinname is laag voor je gewicht.");

  return {
    kcal: Math.round(kcal),
    protein,
    carbs,
    fat,
    perWeekKg,
    tdee: Math.round(t),
    warnings,
  };
}
