import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile } from "@/lib/social";
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
  const { items: dishes } = useDishes();
  const { items: ingredients } = useIngredients();
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

    const row = {
      user_id: user.id,
      goal_type: profile.share_goal ? goal.type ?? null : null,
      unit: "kg",
      start_weight: profile.share_weight ? start : null,
      current_weight: profile.share_weight ? current : null,
      goal_weight: profile.share_goal ? toKg(settings.goalWeight) : null,
      change_kg: profile.share_weight && start != null && current != null ? Number((current - start).toFixed(2)) : null,
      streak_days: profile.share_streak ? streak : null,
      kcal_target: profile.share_macros ? Math.round(target.kcal) : null,
      kcal_today: profile.share_macros ? Math.round(macros.kcal) : null,
      protein_target: profile.share_macros ? Math.round(target.protein) : null,
      protein_today: profile.share_macros ? Math.round(macros.protein) : null,
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
      const rows = dishes.map((d) => ({
        owner_id: user.id,
        local_id: d.id,
        name: d.name,
        servings: d.servings,
        recipe_url: d.recipeUrl ?? null,
        steps: d.steps ?? [],
        categories: d.categories ?? [],
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
      const ids = dishes.map((d) => d.id);
      let del = supabase.from("shared_dishes").delete().eq("owner_id", user.id);
      if (ids.length) del = del.not("local_id", "in", `(${ids.join(",")})`);
      await del;
    })();
  }, [user, profile, dishes, ingredients]);

  return null;
}
