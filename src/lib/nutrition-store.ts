import { useCallback, useEffect, useState } from "react";

export type Unit = "g" | "ml" | "stuk" | "portie";

export type Ingredient = {
  id: string;
  name: string;
  baseUnit: Unit; // unit the macros are defined for
  // For g/ml: macros per 100 of baseUnit. For stuk/portie: macros per 1 baseUnit.
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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

function read<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED_INGREDIENTS: Ingredient[] = [
  { id: "ei", name: "Ei (heel)", baseUnit: "stuk", kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  { id: "kipfilet", name: "Kipfilet", baseUnit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "rijst", name: "Rijst (gekookt)", baseUnit: "g", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "havermout", name: "Havermout (droog)", baseUnit: "g", kcal: 379, protein: 13, carbs: 67, fat: 7 },
  { id: "banaan", name: "Banaan", baseUnit: "stuk", kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "olijfolie", name: "Olijfolie", baseUnit: "ml", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { id: "brood-volkoren", name: "Volkorenbrood (snee)", baseUnit: "stuk", kcal: 90, protein: 4, carbs: 16, fat: 1 },
  { id: "melk-halfvol", name: "Melk halfvol", baseUnit: "ml", kcal: 46, protein: 3.4, carbs: 4.7, fat: 1.5 },
  { id: "yoghurt-grieks", name: "Griekse yoghurt", baseUnit: "g", kcal: 97, protein: 9, carbs: 4, fat: 5 },
  { id: "kaas", name: "Kaas (jong belegen)", baseUnit: "g", kcal: 350, protein: 25, carbs: 0, fat: 28 },
  { id: "pasta", name: "Pasta (gekookt)", baseUnit: "g", kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { id: "tonijn", name: "Tonijn op water", baseUnit: "g", kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: "appel", name: "Appel", baseUnit: "stuk", kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: "amandelen", name: "Amandelen", baseUnit: "g", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "boter", name: "Boter", baseUnit: "g", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { id: "aardappel", name: "Aardappel (gekookt)", baseUnit: "g", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "broccoli", name: "Broccoli", baseUnit: "g", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { id: "zalm", name: "Zalm", baseUnit: "g", kcal: 208, protein: 20, carbs: 0, fat: 13 },
];

export function useIngredients() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = read<Ingredient[] | null>(ING_KEY, null);
    if (!existing) {
      setItems(SEED_INGREDIENTS);
      localStorage.setItem(ING_KEY, JSON.stringify(SEED_INGREDIENTS));
    } else {
      setItems(existing);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(ING_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const upsert = useCallback((ing: Ingredient) => {
    setItems((p) => {
      const i = p.findIndex((x) => x.id === ing.id);
      if (i === -1) return [...p, ing];
      const c = [...p];
      c[i] = ing;
      return c;
    });
  }, []);
  const remove = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);

  return { items, upsert, remove, loaded, newId: uid };
}

export function useDishes() {
  const [items, setItems] = useState<Dish[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(read<Dish[]>(DISH_KEY, []));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(DISH_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const upsert = useCallback((d: Dish) => {
    setItems((p) => {
      const i = p.findIndex((x) => x.id === d.id);
      if (i === -1) return [...p, d];
      const c = [...p];
      c[i] = d;
      return c;
    });
  }, []);
  const remove = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);

  return { items, upsert, remove, loaded, newId: uid };
}

export function useMeals() {
  const [items, setItems] = useState<MealEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(read<MealEntry[]>(MEAL_KEY, []));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(MEAL_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const add = useCallback((m: Omit<MealEntry, "id">) => {
    setItems((p) => [...p, { ...m, id: uid() }]);
  }, []);
  const remove = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);
  const update = useCallback((id: string, patch: Partial<MealEntry>) => {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  return { items, add, remove, update, loaded };
}
