import type { Dish, Ingredient, Unit } from "./nutrition-store";
import type { SharedDishRow } from "./social";

export type IngredientTools = {
  items: Ingredient[];
  upsert: (ing: Ingredient) => void;
  newId: () => string;
};

/**
 * Zet een gedeeld recept van een vriend om naar een gerecht in je eigen bibliotheek.
 * Ontbrekende ingrediënten worden automatisch aangemaakt.
 */
export function sharedDishToLocal(
  row: SharedDishRow,
  ownerName: string,
  tools: IngredientTools,
  opts: { id: string; keepSource?: boolean } ,
): Dish {
  const known = [...tools.items];
  const items = (row.items ?? []).map((it) => {
    const existing = known.find((m) => m.name.trim().toLowerCase() === it.name.trim().toLowerCase());
    let ingredientId = existing?.id;
    if (!ingredientId) {
      const ing: Ingredient = {
        id: tools.newId(),
        name: it.name,
        baseUnit: (it.baseUnit as Unit) ?? "g",
        kcal: it.kcal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        ...(it.category ? { category: it.category as Ingredient["category"] } : {}),
      };
      tools.upsert(ing);
      known.push(ing);
      ingredientId = ing.id;
    }
    return { ingredientId, amount: it.amount, unit: (it.unit as Unit) ?? "g" };
  });

  const dish: Dish = {
    id: opts.id,
    name: row.name,
    servings: row.servings || 1,
    steps: row.steps ?? [],
    categories: (row.categories ?? []) as Dish["categories"],
    items,
  };
  if (row.recipe_url) dish.recipeUrl = row.recipe_url;
  if (row.direct_macros) dish.directMacros = row.direct_macros;
  if (row.portion_amount != null) dish.portionAmount = row.portion_amount;
  if (row.portion_base) dish.portionBase = row.portion_base;
  if (opts.keepSource !== false) {
    dish.source = {
      ownerId: row.owner_id,
      localId: row.local_id ?? row.id,
      name: ownerName,
      syncedAt: row.updated_at ?? "",
    };
  }
  return dish;
}
