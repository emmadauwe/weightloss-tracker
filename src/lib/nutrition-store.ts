import { useCallback, useEffect } from "react";
import { useCloudDoc } from "./cloud-store";

export type Unit = "g" | "ml" | "stuk" | "portie";

export const INGREDIENT_CATEGORIES = [
  "zuivel en eieren",
  "noten, zaden en peulvruchten",
  "groenten en fruit",
  "vleesvervangers",
  "granen en deegwaren",
  "kruiden en sauzen",
  "vetten en oliën",
  "bereide maaltijden",
  "voedselkast",
  "dranken",
  "koekjes en snoepjes",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export type Ingredient = {
  id: string;
  name: string;
  baseUnit: Unit; // unit the macros are defined for
  // For g/ml: macros per 100 of baseUnit. For stuk/portie: macros per 1 baseUnit.
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category?: IngredientCategory;
};

export type DishItem = {
  ingredientId: string;
  amount: number;
  unit: Unit;
};

export type Meal = "ontbijt" | "lunch" | "diner" | "snack";

export type Dish = {
  id: string;
  name: string;
  servings: number;
  recipeUrl?: string;
  steps?: string[];
  categories?: Meal[];
  items: DishItem[];
};

export type MealEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  kind: "dish" | "ingredient";
  refId: string;
  amount: number;
  unit: Unit;
};

const ING_KEY = "nutrition-ingredients-v1";
const DISH_KEY = "nutrition-dishes-v1";
const MEAL_KEY = "nutrition-meals-v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED_INGREDIENTS: Ingredient[] = [
  { id: "ei", name: "Ei (heel)", baseUnit: "stuk", kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, category: "zuivel en eieren" },
  { id: "kipfilet", name: "Kipfilet", baseUnit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6, category: "vleesvervangers" },
  { id: "rijst", name: "Rijst (gekookt)", baseUnit: "g", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, category: "granen en deegwaren" },
  { id: "havermout", name: "Havermout (droog)", baseUnit: "g", kcal: 379, protein: 13, carbs: 67, fat: 7, category: "granen en deegwaren" },
  { id: "banaan", name: "Banaan", baseUnit: "stuk", kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, category: "groenten en fruit" },
  { id: "olijfolie", name: "Olijfolie", baseUnit: "ml", kcal: 884, protein: 0, carbs: 0, fat: 100, category: "vetten en oliën" },
  { id: "brood-volkoren", name: "Volkorenbrood (snee)", baseUnit: "stuk", kcal: 90, protein: 4, carbs: 16, fat: 1, category: "granen en deegwaren" },
  { id: "melk-halfvol", name: "Melk halfvol", baseUnit: "ml", kcal: 46, protein: 3.4, carbs: 4.7, fat: 1.5, category: "zuivel en eieren" },
  { id: "yoghurt-grieks", name: "Griekse yoghurt", baseUnit: "g", kcal: 97, protein: 9, carbs: 4, fat: 5, category: "zuivel en eieren" },
  { id: "kaas", name: "Kaas (jong belegen)", baseUnit: "g", kcal: 350, protein: 25, carbs: 0, fat: 28, category: "zuivel en eieren" },
  { id: "pasta", name: "Pasta (gekookt)", baseUnit: "g", kcal: 131, protein: 5, carbs: 25, fat: 1.1, category: "granen en deegwaren" },
  { id: "tonijn", name: "Tonijn op water", baseUnit: "g", kcal: 116, protein: 26, carbs: 0, fat: 1, category: "vleesvervangers" },
  { id: "appel", name: "Appel", baseUnit: "stuk", kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, category: "groenten en fruit" },
  { id: "amandelen", name: "Amandelen", baseUnit: "g", kcal: 579, protein: 21, carbs: 22, fat: 50, category: "noten, zaden en peulvruchten" },
  { id: "boter", name: "Boter", baseUnit: "g", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, category: "vetten en oliën" },
  { id: "aardappel", name: "Aardappel (gekookt)", baseUnit: "g", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, category: "groenten en fruit" },
  { id: "broccoli", name: "Broccoli", baseUnit: "g", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, category: "groenten en fruit" },
  { id: "zalm", name: "Zalm", baseUnit: "g", kcal: 208, protein: 20, carbs: 0, fat: 13, category: "vleesvervangers" },
];

const EMPTY_DISHES: Dish[] = [];
const EMPTY_MEALS: MealEntry[] = [];

export function useIngredients() {
  const { value, setValue, loaded } = useCloudDoc<Ingredient[] | undefined>(ING_KEY, undefined);

  useEffect(() => {
    if (loaded && value === undefined) setValue(SEED_INGREDIENTS);
  }, [loaded, value, setValue]);

  const items = (value ?? SEED_INGREDIENTS).map((ing) =>
    (ing.category as string) === "kruiden" ? { ...ing, category: "kruiden en sauzen" as IngredientCategory } : ing,
  );

  const upsert = useCallback(
    (ing: Ingredient) => {
      setValue((prev) => {
        const list = prev ?? SEED_INGREDIENTS;
        const i = list.findIndex((x) => x.id === ing.id);
        if (i === -1) return [...list, ing];
        const c = [...list];
        c[i] = ing;
        return c;
      });
    },
    [setValue],
  );
  const remove = useCallback(
    (id: string) => setValue((prev) => (prev ?? SEED_INGREDIENTS).filter((x) => x.id !== id)),
    [setValue],
  );

  return { items, upsert, remove, loaded, newId: uid };
}

export function useDishes() {
  const { value: items, setValue, loaded } = useCloudDoc<Dish[]>(DISH_KEY, EMPTY_DISHES);

  const upsert = useCallback(
    (d: Dish) => {
      setValue((prev) => {
        const i = prev.findIndex((x) => x.id === d.id);
        if (i === -1) return [...prev, d];
        const c = [...prev];
        c[i] = d;
        return c;
      });
    },
    [setValue],
  );
  const remove = useCallback((id: string) => setValue((prev) => prev.filter((x) => x.id !== id)), [setValue]);

  return { items, upsert, remove, loaded, newId: uid };
}

export function useMeals() {
  const { value: items, setValue, loaded } = useCloudDoc<MealEntry[]>(MEAL_KEY, EMPTY_MEALS);

  const add = useCallback(
    (m: Omit<MealEntry, "id">) => setValue((prev) => [...prev, { ...m, id: uid() }]),
    [setValue],
  );
  const remove = useCallback((id: string) => setValue((prev) => prev.filter((x) => x.id !== id)), [setValue]);
  const update = useCallback(
    (id: string, patch: Partial<MealEntry>) =>
      setValue((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [setValue],
  );

  return { items, add, remove, update, loaded };
}

/** 'stuk' wordt 'stuks' (en 'portie' → 'porties') bij meer dan 1. */
export function formatUnit(unit: Unit, amount: number): string {
  if (Math.abs(amount) === 1) return unit;
  if (unit === "stuk") return "stuks";
  if (unit === "portie") return "porties";
  return unit;
}
