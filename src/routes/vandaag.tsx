import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, addDays, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ChevronLeft, ChevronRight, Trash2, Scale, Sparkles, Settings2, ShoppingBasket } from "lucide-react";
import { INGREDIENT_CATEGORIES, useDishes, useIngredients, useMeals, type IngredientCategory, type Meal, type Unit } from "@/lib/nutrition-store";
import { useCloudDoc } from "@/lib/cloud-store";
import { useGoal } from "@/lib/goal-store";
import { useEntries, useSettings } from "@/lib/weight-store";
import { computeGoal, dayMacros, mealEntryMacros } from "@/lib/nutrition-math";
import { generatePlan, picksToEntries, type MacroPriority } from "@/lib/planner";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/vandaag")({
  head: () => ({ meta: [
    { title: "Planning | Lichter" },
    { name: "description", content: "Plan je maaltijden en bekijk je dagelijkse macro's." },
    { property: "og:title", content: "Planning | Lichter" },
    { property: "og:description", content: "Plan je maaltijden en bekijk je dagelijkse macro's." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VandaagPage,
});

const MEAL_LABEL: Record<Meal, string> = {
  ontbijt: "Ontbijt",
  lunch: "Lunch",
  diner: "Diner",
  snack: "Snack",
};
const MEAL_ORDER: Meal[] = ["ontbijt", "lunch", "diner", "snack"];
const UNITS: Unit[] = ["g", "ml", "stuk", "portie"];
const SHOPPING_CHECKS_KEY = "nutrition-shopping-checks-v1";

const PRIORITY_LABEL: Record<MacroPriority, string> = {
  balans: "In balans houden",
  eiwit: "Eiwitdoel altijd halen",
  vet: "Nooit over het vetdoel",
};

function VandaagPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [view, setView] = useState<"dag" | "week">("dag");
  const [showOptions, setShowOptions] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const { value: shoppingChecks, setValue: setShoppingChecks } = useCloudDoc<Record<string, boolean>>(
    SHOPPING_CHECKS_KEY,
    {},
  );
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals, add, remove, update } = useMeals();
  const { goal, setGoal } = useGoal();
  const { settings } = useSettings();
  const { entries, addEntry } = useEntries();
  const [adding, setAdding] = useState<Meal | null>(null);

  const latestWeight = entries[entries.length - 1]?.weight;
  const goalCalc = useMemo(() => {
    if (!latestWeight || !settings.heightCm || !goal.age) return null;
    return computeGoal({
      type: goal.type,
      weightKg: settings.unit === "lb" ? latestWeight * 0.453592 : latestWeight,
      goalKg: settings.goalWeight,
      heightCm: settings.heightCm,
      age: goal.age,
      sex: goal.sex,
      activity: goal.activity,
      lifestyle: goal.lifestyle,
      sessionsPerWeek: goal.sessionsPerWeek,
      minutesPerSession: goal.minutesPerSession,
      intensity: goal.intensity,
      startDate: settings.startDate,
      endDate: settings.endDate,
    });
  }, [latestWeight, settings, goal]);

  const target = useMemo(() => ({
    kcal: goal.overrideKcal ?? goalCalc?.kcal ?? 2000,
    protein: goal.overrideProtein ?? goalCalc?.protein ?? 100,
    carbs: goal.overrideCarbs ?? goalCalc?.carbs ?? 220,
    fat: goal.overrideFat ?? goalCalc?.fat ?? 70,
  }), [goal, goalCalc]);

  const priority: MacroPriority = goal.macroPriority ?? "balans";
  const cookPerWeek = goal.cookPerWeek ?? 4;

  const weekDates = useMemo(() => {
    const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
  }, [date]);

  const shoppingList = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number; unit: Unit; category: IngredientCategory }>();
    for (const entry of meals.filter((meal) => weekDates.includes(meal.date))) {
      if (entry.kind === "ingredient") {
        const ingredient = ingredients.find((item) => item.id === entry.refId);
        if (!ingredient) continue;
        const key = `${ingredient.id}:${entry.unit}`;
        const current = totals.get(key);
        totals.set(key, {
          name: ingredient.name,
          amount: (current?.amount ?? 0) + entry.amount,
          unit: entry.unit,
          category: ingredient.category ?? "groenten en fruit",
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
          category: ingredient.category ?? "groenten en fruit",
        });
      }
    }
    return INGREDIENT_CATEGORIES.map((category) => ({
      category,
      items: [...totals.values()].filter((item) => item.category === category).sort((a, b) => a.name.localeCompare(b.name, "nl")),
    })).filter((group) => group.items.length > 0);
  }, [meals, weekDates, ingredients, dishes]);

  const shoppingKey = (name: string, unit: Unit) => `${weekDates[0]}:${name}:${unit}`;

  const generateFor = (dates: string[]) => {
    meals.filter((m) => dates.includes(m.date)).forEach((m) => remove(m.id));
    const picks = generatePlan({
      dates,
      dishes,
      ingredients,
      target,
      priority,
      cookCount: dates.length === 1 ? undefined : Math.round((cookPerWeek * dates.length) / 7),
    });
    picksToEntries(picks).forEach((e) => add(e));
  };

  const totals = dayMacros(date, meals, ingredients, dishes);
  const todayMeals = meals.filter((m) => m.date === date);
  const weighedToday = entries.some((e) => e.date === date);

  const shift = (delta: number) =>
    setDate(format(addDays(parseISO(date), view === "week" ? delta * 7 : delta), "yyyy-MM-dd"));

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Planning" subtitle="Dag- en weekplanning met macro's" />

      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Dag / week schakelaar */}
        <div className="flex gap-2">
          {(["dag", "week"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              className="flex-1"
              onClick={() => setView(v)}
            >
              {v === "dag" ? "Dag" : "Week"}
            </Button>
          ))}
        </div>

        {view === "week" && (
          <Button type="button" variant="outline" className="w-full" onClick={() => setShowShoppingList(true)}>
            <ShoppingBasket className="h-4 w-4 text-primary" />
            Boodschappenlijst
          </Button>
        )}

        {/* Datumkiezer */}
        <Card>
          <CardContent className="flex items-center justify-between px-4 py-2.5">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Vorige">
              <ChevronLeft className="h-5 w-5 text-primary" />
            </Button>
            <div className="text-sm font-medium capitalize">
              {view === "dag"
                ? format(parseISO(date), "EEEE d MMMM", { locale: nl })
                : `${format(parseISO(weekDates[0]), "d MMM", { locale: nl })} – ${format(parseISO(weekDates[6]), "d MMM", { locale: nl })}`}
            </div>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Volgende">
              <ChevronRight className="h-5 w-5 text-primary" />
            </Button>
          </CardContent>
        </Card>

        {/* Generator-opties */}
        <Card>
          <CardContent className="space-y-3 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setShowOptions((s) => !s)}
              className="flex w-full items-center justify-between text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Generator-instellingen
              </span>
              <span className="text-xs font-normal text-muted-foreground">{PRIORITY_LABEL[priority]}</span>
            </button>
            {showOptions && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Wat krijgt voorrang naast calorieën?</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setGoal({ ...goal, macroPriority: v as MacroPriority })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balans">In balans houden</SelectItem>
                      <SelectItem value="eiwit">Eiwitdoel halen (mag over koolhydraten/vet)</SelectItem>
                      <SelectItem value="vet">Onder het vetdoel blijven (mag onder eiwit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cook">Nieuwe warme maaltijden koken per week</Label>
                  <Input
                    id="cook"
                    type="number"
                    min={1}
                    max={14}
                    value={cookPerWeek}
                    onChange={(e) =>
                      setGoal({ ...goal, cookPerWeek: Math.max(1, Math.min(14, parseInt(e.target.value) || 1)) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    De rest van de lunches en diners wordt gevuld met restjes van wat je kookt.
                  </p>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => generateFor(view === "dag" ? [date] : weekDates)}
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
              {view === "dag" ? "Genereer dag" : "Genereer week"}
            </Button>
          </CardContent>
        </Card>

        {view === "week" ? (
          <div className="space-y-2">
            {weekDates.map((d) => {
              const t = dayMacros(d, meals, ingredients, dishes);
              const dayEntries = meals.filter((m) => m.date === d);
              const isToday = d === format(new Date(), "yyyy-MM-dd");
              return (
                <Card key={d} className={isToday ? "border-primary ring-1 ring-primary/30" : undefined}>
                  <CardContent className="px-5 py-3.5">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => { setDate(d); setView("dag"); }}
                    >
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium capitalize">
                          {format(parseISO(d), "EEEE d MMM", { locale: nl })}
                          {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Vandaag</span>}
                        </div>
                        <div className={`text-sm tabular-nums ${t.kcal > target.kcal * 1.05 ? "text-destructive" : "text-muted-foreground"}`}>
                          {Math.round(t.kcal)} / {target.kcal} kcal
                        </div>
                      </div>
                      {dayEntries.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Nog niets gepland.</p>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {MEAL_ORDER.map((meal) => {
                            const entriesForMeal = dayEntries.filter((entry) => entry.meal === meal);
                            if (entriesForMeal.length === 0) return null;
                            return (
                              <div key={meal} className="grid grid-cols-[64px_1fr] gap-2 text-xs">
                                <span className="font-medium text-foreground">{MEAL_LABEL[meal]}</span>
                                <span className="text-muted-foreground">
                                  {entriesForMeal.map((entry) => {
                                    const ref = entry.kind === "dish" ? dishes.find((item) => item.id === entry.refId) : ingredients.find((item) => item.id === entry.refId);
                                    return `${ref?.name ?? "—"} · ${entry.amount} ${entry.unit}`;
                                  }).join(", ")}
                                </span>
                              </div>
                            );
                          })}
                          <div className="border-t border-border pt-1.5 text-xs text-muted-foreground tabular-nums">
                            {Math.round(t.protein)}P · {Math.round(t.carbs)}K · {Math.round(t.fat)}V
                          </div>
                        </div>
                      )}
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <>
            {/* Macro overzicht */}
            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Calorieën</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tabular-nums text-primary"
                        style={{ fontFamily: "var(--font-display)" }}>
                        {Math.round(totals.kcal)}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {target.kcal} kcal</span>
                    </div>
                  </div>
                  <div className={`text-sm font-medium tabular-nums ${totals.kcal > target.kcal * 1.05 ? "text-destructive" : "text-success"}`}>
                    {Math.round(target.kcal - totals.kcal)} resterend
                  </div>
                </div>
                <MacroBar label="Eiwit" cur={totals.protein} max={target.protein} unit="g" />
                <MacroBar label="Koolhydraten" cur={totals.carbs} max={target.carbs} unit="g" />
                <MacroBar label="Vet" cur={totals.fat} max={target.fat} unit="g" />
              </CardContent>
            </Card>

            {/* Wegen-reminder */}
            {!weighedToday && date === format(new Date(), "yyyy-MM-dd") && (
              <QuickWeighCard unit={settings.unit} latest={latestWeight} onSave={(w) => addEntry({ date, weight: w })} />
            )}

            {/* Maaltijden */}
            {MEAL_ORDER.map((meal) => {
              const list = todayMeals.filter((m) => m.meal === meal);
              const sum = list.reduce((acc, m) => acc + mealEntryMacros(m, ingredients, dishes).kcal, 0);
              return (
                <Card key={meal}>
                  <CardContent className="px-5 py-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{MEAL_LABEL[meal]}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{Math.round(sum)} kcal</div>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nog niets toegevoegd.</p>
                    ) : (
                      <ul className="space-y-1">
                        {list.map((m) => {
                          const ref = m.kind === "ingredient"
                            ? ingredients.find((i) => i.id === m.refId)
                            : dishes.find((d) => d.id === m.refId);
                          const macros = mealEntryMacros(m, ingredients, dishes);
                          return (
                            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                               <span className="min-w-0 flex-1 truncate">
                                {ref?.name ?? "—"}
                                <span className="text-muted-foreground"> · {m.amount} {m.unit}</span>
                              </span>
                               <Input
                                 aria-label={`Porties ${ref?.name ?? "maaltijd"}`}
                                 className="h-7 w-14 px-2 text-xs"
                                 inputMode="decimal"
                                 value={m.amount}
                                 onChange={(event) => {
                                   const amount = parseFloat(event.target.value.replace(",", "."));
                                   if (amount > 0) update(m.id, { amount });
                                 }}
                               />
                               <span className="text-xs text-muted-foreground tabular-nums">{Math.round(macros.kcal)} kcal</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(m.id)} aria-label="Verwijderen">
                                <Trash2 className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(meal)}>
                      <Plus className="mr-1 h-4 w-4" /> Toevoegen
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </main>

      {adding && (
        <AddMealDialog
          meal={adding}
          date={date}
          onClose={() => setAdding(null)}
          onAdd={(entry) => { add(entry); setAdding(null); }}
        />
      )}

      <Dialog open={showShoppingList} onOpenChange={setShowShoppingList}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBasket className="h-5 w-5 text-primary" /> Boodschappenlijst
            </DialogTitle>
          </DialogHeader>
          {shoppingList.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Genereer of vul eerst een weekplanning.</p>
          ) : (
            <div className="space-y-4">
              {shoppingList.map((group) => (
                <section key={group.category}>
                  <h3 className="mb-1 text-xs font-semibold capitalize text-primary">{group.category}</h3>
                  <ul className="divide-y divide-border">
                    {group.items.map((item) => {
                      const key = shoppingKey(item.name, item.unit);
                      const checked = Boolean(shoppingChecks[key]);
                      return (
                        <li key={`${item.name}:${item.unit}`} className="flex items-center gap-3 py-2.5">
                          <Checkbox
                            id={key}
                            checked={checked}
                            onCheckedChange={(value) =>
                              setShoppingChecks((current) => ({ ...current, [key]: value === true }))
                            }
                            aria-label={`${item.name} afvinken`}
                          />
                          <label
                            htmlFor={key}
                            className={`flex min-w-0 flex-1 cursor-pointer justify-between gap-3 text-sm ${checked ? "text-muted-foreground line-through" : ""}`}
                          >
                            <span>{item.name}</span>
                            <span className="shrink-0 tabular-nums">{formatAmount(item.amount)} {item.unit}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(".0", "");
}

function MacroBar({ label, cur, max, unit }: { label: string; cur: number; max: number; unit: string }) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  const over = cur > max;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{Math.round(cur)} / {max} {unit}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "var(--destructive)" : "var(--primary)" }}
        />
      </div>
    </div>
  );
}

function QuickWeighCard({ unit, latest, onSave }: { unit: string; latest?: number; onSave: (w: number) => void }) {
  const [v, setV] = useState("");
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex items-center gap-3 px-5 py-3">
        <Scale className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <div className="font-medium">Nog niet gewogen vandaag</div>
        </div>
        <Input className="w-20" inputMode="decimal" placeholder={latest ? String(latest) : unit}
          value={v} onChange={(e) => setV(e.target.value)} />
        <Button size="sm" onClick={() => {
          const w = parseFloat(v.replace(",", "."));
          if (w) { onSave(w); setV(""); }
        }}>Opslaan</Button>
      </CardContent>
    </Card>
  );
}

function AddMealDialog({
  meal, date, onClose, onAdd,
}: {
  meal: Meal; date: string; onClose: () => void;
  onAdd: (e: { date: string; meal: Meal; kind: "dish" | "ingredient"; refId: string; amount: number; unit: Unit }) => void;
}) {
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const [tab, setTab] = useState<"dish" | "ingredient">(dishes.length > 0 ? "dish" : "ingredient");
  const [q, setQ] = useState("");
  const [refId, setRefId] = useState("");
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<Unit>("g");

  const dishList = useMemo(
    () =>
      [...dishes]
        .filter((d) => !d.categories || d.categories.length === 0 || d.categories.includes(meal))
        .filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [dishes, meal, q],
  );
  const ingredientList = useMemo(
    () =>
      [...ingredients]
        .filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [ingredients, q],
  );
  const list = tab === "dish" ? dishList : ingredientList;

  const choose = (id: string) => {
    setRefId(id);
    if (tab === "dish") {
      setAmount("1"); setUnit("portie");
    } else {
      const ing = ingredients.find((i) => i.id === id);
      if (ing) {
        setUnit(ing.baseUnit);
        setAmount(ing.baseUnit === "g" || ing.baseUnit === "ml" ? "100" : "1");
      }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount.replace(",", "."));
    if (!refId || !a) return;
    onAdd({ date, meal, kind: tab, refId, amount: a, unit });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Toevoegen aan {MEAL_LABEL[meal]}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={tab === "dish" ? "default" : "outline"} onClick={() => { setTab("dish"); setRefId(""); }}>Gerechten</Button>
            <Button type="button" size="sm" variant={tab === "ingredient" ? "default" : "outline"} onClick={() => { setTab("ingredient"); setRefId(""); }}>Ingrediënten</Button>
          </div>
          <Input placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {list.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">Geen resultaten</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => choose(x.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${refId === x.id ? "bg-secondary" : ""}`}>
                      {x.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {refId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amt">Hoeveelheid</Label>
                <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Eenheid</Label>
                {tab === "ingredient" ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                    {unit}
                  </div>
                ) : (
                  <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.filter((u) => u === "portie").map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={!refId}>Toevoegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
