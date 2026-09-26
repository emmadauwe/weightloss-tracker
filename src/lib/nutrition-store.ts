import { useCallback } from "react";
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
  /** Voor stuk/portie: hoeveel gram of ml één stuk/portie weegt. */
  unitGrams?: number;
  /** Of unitGrams in gram of milliliter is. */
  unitBase?: "g" | "ml";
  /** Verduidelijking, bv. "1 snee" of "1 middelgrote appel". */
  unitNote?: string;
  /** Via "snel toevoegen" gemaakt: niet zichtbaar in de ingrediëntenlijst. */
  quick?: boolean;
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
  /** Kant-en-klaar gerecht: macro's per portie rechtstreeks ingevuld, zonder ingrediënten. */
  directMacros?: { kcal: number; protein: number; carbs: number; fat: number };
  /** Kant-en-klaar: hoeveel gram of ml één portie weegt (optioneel). */
  portionAmount?: number;
  /** Of portionAmount in gram of milliliter is. */
  portionBase?: "g" | "ml";
  /** Overgenomen van een vriend: blijft automatisch meeveranderen tot je het eigen maakt. */
  source?: {
    ownerId: string;
    localId: string;
    /** Naam van de vriend; wordt bijgewerkt als die zijn naam aanpast. */
    name: string;
    /** Laatste versie die we van de vriend overnamen. */
    syncedAt?: string;
  };
};

export type MealEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  kind: "dish" | "ingredient";
  refId: string;
  amount: number;
  unit: Unit;
  /** Datum (YYYY-MM-DD) waarop dit gerecht bereid werd; gezet bij restjes. */
  leftoverFrom?: string;
  /** Niet meenemen op het boodschappenlijstje (bv. eten van thuis meegekregen). */
  skipShopping?: boolean;
  /** Vastgezet: blijft staan wanneer de week opnieuw gegenereerd wordt. */
  locked?: boolean;
};

const ING_KEY = "nutrition-ingredients-v1";
const DISH_KEY = "nutrition-dishes-v1";
const MEAL_KEY = "nutrition-meals-v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_INGREDIENTS: Ingredient[] = [];
const EMPTY_DISHES: Dish[] = [];
const EMPTY_MEALS: MealEntry[] = [];

export function useIngredients() {
  const { value, setValue, loaded } = useCloudDoc<Ingredient[]>(ING_KEY, EMPTY_INGREDIENTS);

  const items = value.map((ing) =>
    (ing.category as string) === "kruiden" ? { ...ing, category: "kruiden en sauzen" as IngredientCategory } : ing,
  );

  const upsert = useCallback(
    (ing: Ingredient) => {
      setValue((prev) => {
        const i = prev.findIndex((x) => x.id === ing.id);
        if (i === -1) return [...prev, ing];
        const c = [...prev];
        c[i] = ing;
        return c;
      });
    },
    [setValue],
  );
  const remove = useCallback(
    (id: string) => setValue((prev) => prev.filter((x) => x.id !== id)),
    [setValue],
  );

  const library = items.filter((i) => !i.quick);
  return { items, library, upsert, remove, loaded, newId: uid };
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
