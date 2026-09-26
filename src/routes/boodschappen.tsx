import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown, ShoppingBasket } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudDoc } from "@/lib/cloud-store";
import { formatUnit, useDishes, useIngredients, useMeals } from "@/lib/nutrition-store";
import {
  buildShoppingList,
  isMealDone,
  formatShoppingAmount,
  sentenceCase,
  shoppingCheckKey,
  SHOPPING_CHECKS_KEY,
} from "@/lib/shopping-list";

export const Route = createFileRoute("/boodschappen")({
  validateSearch: (search: Record<string, unknown>) => ({
    week: typeof search.week === "string" ? search.week : undefined,
  }),
  head: () => ({ meta: [
    { title: "Boodschappenlijstje | Lichter" },
    { name: "description", content: "Bekijk en vink de boodschappen voor je weekplanning af." },
    { property: "og:title", content: "Boodschappenlijstje | Lichter" },
    { property: "og:description", content: "Bekijk en vink de boodschappen voor je weekplanning af." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BoodschappenPage,
});

function BoodschappenPage() {
  const includeDone = false;
  const { week } = Route.useSearch();
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  // Vanaf zaterdag tonen we standaard al de boodschappen voor volgende week.
  const initialNext = week && /^\d{4}-\d{2}-\d{2}$/.test(week)
    ? startOfWeek(parseISO(week), { weekStartsOn: 1 }) > thisMonday
    : [0, 6].includes(new Date().getDay());
  const [nextWeek, setNextWeek] = useState(initialNext);
  const monday = nextWeek ? addDays(thisMonday, 7) : thisMonday;
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(monday, index), "yyyy-MM-dd"));
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals, update } = useMeals();
  const [showDishes, setShowDishes] = useState(false);
  const { value: checks, setValue: setChecks } = useCloudDoc<Record<string, boolean>>(SHOPPING_CHECKS_KEY, {});
  const groups = buildShoppingList(dates, meals, ingredients, dishes, { includeDone });
  // Unieke gerechten/etenswaren van deze week die nog niet bereid zijn.
  const planned = new Map<string, { name: string; ids: string[]; skipped: boolean }>();
  for (const m of meals) {
    if (!dates.includes(m.date) || (!includeDone && isMealDone(m))) continue;
    const ref = m.kind === "dish" ? dishes.find((d) => d.id === m.refId) : ingredients.find((i) => i.id === m.refId);
    if (!ref) continue;
    if (m.kind === "dish" && "directMacros" in ref && ref.directMacros && (ref as { items: unknown[] }).items.length === 0) continue;
    if (m.kind === "ingredient" && "quick" in ref && ref.quick) continue;
    const key = `${m.kind}:${m.refId}`;
    const cur = planned.get(key) ?? { name: ref.name, ids: [], skipped: true };
    cur.ids.push(m.id);
    cur.skipped = cur.skipped && Boolean(m.skipShopping);
    planned.set(key, cur);
  }
  const plannedList = [...planned.values()].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const skippedCount = plannedList.filter((p) => p.skipped).length;
  const toggleDish = (ids: string[], needed: boolean) =>
    ids.forEach((id) => update(id, { skipShopping: needed ? undefined : true }));


  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Boodschappenlijstje" subtitle="Alles voor je geplande week" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={nextWeek ? "outline" : "default"} onClick={() => setNextWeek(false)}>Deze week</Button>
          <Button size="sm" variant={nextWeek ? "default" : "outline"} onClick={() => setNextWeek(true)}>Volgende week</Button>
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="text-sm font-medium">
              {format(monday, "d MMM", { locale: nl })} – {format(addDays(monday, 6), "d MMM", { locale: nl })}
            </div>
          </div>
          <ShoppingBasket className="h-5 w-5 text-primary" />
        </div>


        {plannedList.length > 0 && (
          <Card>
            <CardContent className="px-5 py-3">
              <button
                type="button"
                onClick={() => setShowDishes((v) => !v)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={showDishes}
              >
                <span className="text-xs leading-snug">
                  <span className="font-medium">Heb je iets al in huis?</span>
                  <span className="block text-muted-foreground">
                    {skippedCount > 0
                      ? `${skippedCount} van ${plannedList.length} gerechten staan niet op je lijstje`
                      : "Bv. een maaltijd in de vriezer of eten van thuis"}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showDishes ? "rotate-180" : ""}`} />
              </button>
              {showDishes && (
                <ul className="mt-2 divide-y divide-border border-t border-border">
                  {plannedList.map((p) => (
                    <li key={p.ids[0]} className="flex items-center justify-between gap-3 py-2.5">
                      <span className={`min-w-0 flex-1 truncate text-sm ${p.skipped ? "text-muted-foreground" : ""}`}>{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.skipped ? "Al in huis" : "Kopen"}</span>
                      <Switch
                        checked={!p.skipped}
                        onCheckedChange={(v) => toggleDish(p.ids, v)}
                        aria-label={`${p.name} op lijstje`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Niets meer te kopen voor deze week.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.category}>
              <CardContent className="px-5 py-4">
                <h2 className="mb-2 text-sm font-semibold text-primary">{sentenceCase(group.category)}</h2>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const key = shoppingCheckKey(dates[0], item.name, item.unit);
                    const checked = Boolean(checks[key]);
                    return (
                      <li key={`${item.name}:${item.unit}`} className="flex items-center gap-3 py-2.5">
                        <Checkbox
                          id={key}
                          checked={checked}
                          onCheckedChange={(value) => setChecks((current) => ({ ...current, [key]: value === true }))}
                          aria-label={`${item.name} afvinken`}
                        />
                        <label
                          htmlFor={key}
                          className={`flex min-w-0 flex-1 cursor-pointer justify-between gap-3 text-sm ${checked ? "text-muted-foreground line-through" : ""}`}
                        >
                          <span>{item.name}</span>
                          <span className="shrink-0 tabular-nums">{formatShoppingAmount(item.amount)} {formatUnit(item.unit, item.amount)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}