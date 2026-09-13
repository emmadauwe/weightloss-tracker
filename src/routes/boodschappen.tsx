import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { ShoppingBasket } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudDoc } from "@/lib/cloud-store";
import { formatUnit, useDishes, useIngredients, useMeals } from "@/lib/nutrition-store";
import {
  buildShoppingList,
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
    { title: "Boodschappenlijst | Lichter" },
    { name: "description", content: "Bekijk en vink de boodschappen voor je weekplanning af." },
    { property: "og:title", content: "Boodschappenlijst | Lichter" },
    { property: "og:description", content: "Bekijk en vink de boodschappen voor je weekplanning af." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BoodschappenPage,
});

function BoodschappenPage() {
  const { week } = Route.useSearch();
  const selected = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? parseISO(week) : new Date();
  const monday = startOfWeek(selected, { weekStartsOn: 1 });
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(monday, index), "yyyy-MM-dd"));
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals } = useMeals();
  const { value: checks, setValue: setChecks } = useCloudDoc<Record<string, boolean>>(SHOPPING_CHECKS_KEY, {});
  const groups = buildShoppingList(dates, meals, ingredients, dishes);
  const isCurrentWeek = format(monday, "yyyy-MM-dd") === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Boodschappenlijstje" subtitle="Alles voor je geplande week" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="text-sm font-medium">
              {format(monday, "d MMM", { locale: nl })} – {format(addDays(monday, 6), "d MMM", { locale: nl })}
            </div>
            {isCurrentWeek && <div className="text-xs font-medium text-primary">Deze week</div>}
          </div>
          <ShoppingBasket className="h-5 w-5 text-primary" />
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Genereer of vul eerst een weekplanning.
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