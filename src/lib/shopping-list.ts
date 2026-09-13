import type { Dish, Ingredient, IngredientCategory, MealEntry, Unit } from "./nutrition-store";
import { INGREDIENT_CATEGORIES } from "./nutrition-store";

export const SHOPPING_CHECKS_KEY = "nutrition-shopping-checks-v1";

export type ShoppingGroup = {
  category: IngredientCategory;
  items: { name: string; amount: number; unit: Unit }[];
};

export function buildShoppingList(
  dates: string[],
  meals: MealEntry[],
  ingredients: Ingredient[],
  dishes: Dish[],
): ShoppingGroup[] {
  const totals = new Map<string, { name: string; amount: number; unit: Unit; category: IngredientCategory }>();
  for (const entry of meals.filter((meal) => dates.includes(meal.date))) {
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