import type { Dish, Ingredient, IngredientCategory, Meal, MealEntry, Unit } from "./nutrition-store";
import { INGREDIENT_CATEGORIES } from "./nutrition-store";

export const SHOPPING_CHECKS_KEY = "nutrition-shopping-checks-v1";

export type ShoppingGroup = {
  category: IngredientCategory;
  items: { name: string; amount: number; unit: Unit }[];
};

/** Uur waarop een maaltijd als bereid/gegeten beschouwd wordt. */
const MEAL_DONE_HOUR: Record<Meal, number> = { ontbijt: 10, lunch: 14, diner: 21, snack: 23 };

/**
 * Is deze maaltijd al bereid? Bij restjes telt de dag waarop gekookt werd,
 * want dan zijn de boodschappen toen al gedaan.
 */
export function isMealDone(entry: MealEntry, now = new Date()): boolean {
  const cookDate = entry.leftoverFrom ?? entry.date;
  const done = new Date(`${cookDate}T00:00:00`);
  done.setHours(MEAL_DONE_HOUR[entry.meal] ?? 23, 0, 0, 0);
  return now.getTime() > done.getTime();
}

export function buildShoppingList(
  dates: string[],
  meals: MealEntry[],
  ingredients: Ingredient[],
  dishes: Dish[],
  options: { includeDone?: boolean; now?: Date } = {},
): ShoppingGroup[] {
  const totals = new Map<string, { name: string; amount: number; unit: Unit; category: IngredientCategory }>();
  const relevant = meals.filter((meal) => {
    if (!dates.includes(meal.date)) return false;
    if (meal.skipShopping) return false;
    if (!options.includeDone && isMealDone(meal, options.now)) return false;
    return true;
  });
  for (const entry of relevant) {
    if (entry.kind === "ingredient") {
      const ingredient = ingredients.find((item) => item.id === entry.refId);
      if (!ingredient) continue;
      const key = `${ingredient.id}:${entry.unit}`;
      const current = totals.get(key);
      totals.set(key, {
        name: ingredient.name,
        amount: (current?.amount ?? 0) + entry.amount,
        unit: entry.unit,
        category: ingredient.category ?? "voedselkast",
      });
      continue;
    }

    const dish = dishes.find((item) => item.id === entry.refId);
    if (!dish) continue;
    for (const item of dish.items) {
      const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
      if (!ingredient) continue;
      const key = `${ingredient.id}:${item.unit}`;
      const current = totals.get(key);
      totals.set(key, {
        name: ingredient.name,
        amount: (current?.amount ?? 0) + item.amount * entry.amount / Math.max(1, dish.servings),
        unit: item.unit,
        category: ingredient.category ?? "voedselkast",
      });
    }
  }

  return INGREDIENT_CATEGORIES.map((category) => ({
    category,
    items: [...totals.values()]
      .filter((item) => item.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, "nl")),
  })).filter((group) => group.items.length > 0);
}

export function shoppingCheckKey(weekStart: string, name: string, unit: Unit) {
  return `${weekStart}:${name}:${unit}`;
}

export function formatShoppingAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(".0", "");
}

export function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
