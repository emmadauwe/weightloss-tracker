import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile, type SharedDishRow } from "@/lib/social";
import { sharedDishToLocal } from "@/lib/shared-recipes";
import { useGoalTargets } from "@/lib/goal-targets";
import { useDishes, useIngredients, useMeals } from "@/lib/nutrition-store";
import { dayMacros } from "@/lib/nutrition-math";

/**
 * Houdt de gedeelde (vriend-zichtbare) gegevens in sync met wat je zelf bijhoudt.
 * Er wordt alleen gedeeld wat in je privacy-instellingen aanstaat.
 */
export function SocialSync() {
  const { user } = useAuth();
  const { profile, loaded } = useMyProfile();
  const { settings, goal, target, calc, currentWeight } = useGoalTargets();
  const { items: meals } = useMeals();
  const { items: dishes, upsert: upsertDish } = useDishes();
  const { items: ingredients, upsert: upsertIngredient, newId: newIngId } = useIngredients();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const statsSig = useRef<string>("");
  const dishSig = useRef<string>("");
  const redirected = useRef(false);

  // Eerste keer: vraag om je gegevens.
  useEffect(() => {
    if (!loaded || !profile || redirected.current) return;
    if (profile.display_name || settings.startWeight) return;
    if (pathname.startsWith("/account")) return;
    redirected.current = true;
    void navigate({ to: "/account/gegevens" });
  }, [loaded, profile, settings.startWeight, pathname, navigate]);

  // Voortgang delen
  useEffect(() => {
    if (!user || !profile) return;
    const toKg = (v?: number) => (v === undefined ? null : settings.unit === "lb" ? v * 0.453592 : v);

    const today = format(new Date(), "yyyy-MM-dd");
    const macros = dayMacros(today, meals, ingredients, dishes);

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      const has = meals.some((m) => m.date === d);
      if (has) streak++;
      else if (i > 0) break;
    }

    const start = toKg(settings.startWeight);
    const current = toKg(currentWeight);
    const goalW = toKg(settings.goalWeight);

    // Percentage richting het doel — zo kan de meter gedeeld worden zonder gewichten.
    let progress: number | null = null;
    if (start != null && current != null && goalW != null && start !== goalW) {
      const p = ((current - start) / (goalW - start)) * 100;
      progress = Number(Math.max(0, Math.min(100, p)).toFixed(1));
    }

    const row = {
      user_id: user.id,
      goal_type: profile.share_goal || profile.share_progress ? goal.type ?? null : null,
      unit: "kg",
      start_weight: profile.share_weight ? start : null,
      current_weight: profile.share_weight ? current : null,
      goal_weight: profile.share_goal ? goalW : null,
      change_kg: profile.share_weight && start != null && current != null ? Number((current - start).toFixed(2)) : null,
      progress_percent: profile.share_progress ? progress : null,
      streak_days: profile.share_streak ? streak : null,
      kcal_target: null,
      kcal_today: null,
      protein_target: null,
      protein_today: null,
      updated_at: new Date().toISOString(),
    };

    const sig = JSON.stringify({ ...row, updated_at: "" });
    if (sig === statsSig.current) return;
    statsSig.current = sig;
    void (async () => {
      const { error } = await supabase.from("user_stats").upsert(row, { onConflict: "user_id" });
      if (error) {
        statsSig.current = "";
        console.error("user_stats sync", error);
      }
    })();
  }, [user, profile, settings, goal, currentWeight, calc, target, meals, ingredients, dishes]);

  // Recepten delen
  useEffect(() => {
    if (!user || !profile) return;
    void (async () => {
      if (!profile.share_dishes) {
        if (dishSig.current === "off") return;
        dishSig.current = "off";
        await supabase.from("shared_dishes").delete().eq("owner_id", user.id);
        return;
      }
      const own = dishes.filter((d) => !d.source);
      const rows = own.map((d) => ({
        owner_id: user.id,
        local_id: d.id,
        name: d.name,
        servings: d.servings,
        recipe_url: d.recipeUrl ?? null,
        steps: d.steps ?? [],
        categories: d.categories ?? [],
        direct_macros: d.directMacros ?? null,
        portion_amount: d.portionAmount ?? null,
        portion_base: d.portionBase ?? null,
        items: d.items
          .map((it) => {
            const ing = ingredients.find((i) => i.id === it.ingredientId);
            if (!ing) return null;
            return {
              name: ing.name,
              amount: it.amount,
              unit: it.unit,
              baseUnit: ing.baseUnit,
              kcal: ing.kcal,
              protein: ing.protein,
              carbs: ing.carbs,
              fat: ing.fat,
              category: ing.category ?? null,
            };
          })
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      }));
      const sig = JSON.stringify(rows.map((r) => ({ ...r, updated_at: "" })));
      if (sig === dishSig.current) return;
      dishSig.current = sig;
      if (rows.length) await supabase.from("shared_dishes").upsert(rows, { onConflict: "owner_id,local_id" });
      const ids = own.map((d) => d.id);
      let del = supabase.from("shared_dishes").delete().eq("owner_id", user.id);
      if (ids.length) del = del.not("local_id", "in", `(${ids.join(",")})`);
      await del;
    })();
  }, [user, profile, dishes, ingredients]);

  // Overgenomen recepten van vrienden up-to-date houden
  const imported = dishes.filter((d) => d.source);
  const importedSig = imported
    .map((d) => `${d.source?.ownerId}:${d.source?.localId}:${d.source?.syncedAt ?? ""}:${d.source?.name ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!user || imported.length === 0) return;
    void (async () => {
      const ownerIds = [...new Set(imported.map((d) => d.source!.ownerId))];
      const [{ data: sharedRows }, { data: profileRows }] = await Promise.all([
        supabase.from("shared_dishes").select("*").in("owner_id", ownerIds),
        supabase.from("profiles").select("id, display_name").in("id", ownerIds),
      ]);
      const shared = (sharedRows ?? []) as unknown as SharedDishRow[];
      const names = new Map(
        (profileRows ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? "een vriend"]),
      );
      const tools = { items: ingredients, upsert: upsertIngredient, newId: newIngId };

      for (const dish of imported) {
        const src = dish.source!;
        const row = shared.find((r) => r.owner_id === src.ownerId && (r.local_id ?? r.id) === src.localId);
        const ownerName = names.get(src.ownerId) ?? src.name;
        if (!row) {
          // De vriend deelt dit recept niet meer: het blijft staan als je eigen recept.
          if (src.name !== ownerName) upsertDish({ ...dish, source: { ...src, name: ownerName } });
          continue;
        }
        const changed = (row.updated_at ?? "") !== (src.syncedAt ?? "");
        if (!changed && ownerName === src.name) continue;
        const next = changed
          ? sharedDishToLocal(row, ownerName, tools, { id: dish.id })
          : { ...dish, source: { ...src, name: ownerName } };
        upsertDish(next);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, importedSig]);

  return null;
}
