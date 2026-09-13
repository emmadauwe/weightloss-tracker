import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, addDays, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Trash2, Sparkles, ShoppingBasket } from "lucide-react";
import { useDishes, useIngredients, useMeals, type Meal, type Unit } from "@/lib/nutrition-store";
import { useGoal } from "@/lib/goal-store";
import { useEntries, useSettings } from "@/lib/weight-store";
import { computeGoal, dayMacros, mealEntryMacros } from "@/lib/nutrition-math";
import { generatePlan, picksToEntries } from "@/lib/planner";
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

function VandaagPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [view, setView] = useState<"dag" | "week">("dag");
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals, add, remove, update } = useMeals();
  const { goal } = useGoal();
  const { settings } = useSettings();
  const { entries } = useEntries();
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

  const cookPerWeek = goal.cookPerWeek ?? 4;

  const weekDates = useMemo(() => {
    const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
  }, [date]);

  const generateFor = (dates: string[]) => {
    meals.filter((m) => dates.includes(m.date)).forEach((m) => remove(m.id));
    const picks = generatePlan({
      dates,
      dishes,
      ingredients,
      target,
      priority: "eiwit",
      cookCount: dates.length === 1 ? undefined : Math.round((cookPerWeek * dates.length) / 7),
    });
    picksToEntries(picks).forEach((e) => add(e));
  };

  const totals = dayMacros(date, meals, ingredients, dishes);
  const weekAverage = useMemo(() => {
    const sum = weekDates.reduce(
      (current, weekDate) => {
        const macros = dayMacros(weekDate, meals, ingredients, dishes);
        return {
          kcal: current.kcal + macros.kcal,
          protein: current.protein + macros.protein,
          carbs: current.carbs + macros.carbs,
          fat: current.fat + macros.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      kcal: sum.kcal / 7,
      protein: sum.protein / 7,
      carbs: sum.carbs / 7,
      fat: sum.fat / 7,
    };
  }, [weekDates, meals, ingredients, dishes]);
  const todayMeals = meals.filter((m) => m.date === date);
  const today = format(new Date(), "yyyy-MM-dd");
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const selectedIsToday = date === today;
  const selectedIsCurrentWeek = weekDates[0] === currentWeekStart;

  const shift = (delta: number) =>
    setDate(format(addDays(parseISO(date), view === "week" ? delta * 7 : delta), "yyyy-MM-dd"));

  const clearDay = (dayDate: string) => {
    meals.filter((m) => m.date === dayDate).forEach((m) => remove(m.id));
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Planning" subtitle="Dag- en weekplanning met macro's" />

      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Datumkiezer */}
        <Card>
          <CardContent className="flex items-center justify-between px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Vorige">
              <ChevronLeft className="h-4 w-4 text-primary" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-medium capitalize">
                {view === "dag"
                  ? format(parseISO(date), "EEEE d MMMM", { locale: nl })
                  : `${format(parseISO(weekDates[0]), "d MMM", { locale: nl })} – ${format(parseISO(weekDates[6]), "d MMM", { locale: nl })}`}
              </div>
              {((view === "dag" && selectedIsToday) || (view === "week" && selectedIsCurrentWeek)) && (
                <div className="text-[11px] font-semibold text-primary">{view === "dag" ? "Vandaag" : "Deze week"}</div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Volgende">
              <ChevronRight className="h-4 w-4 text-primary" />
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {(["dag", "week"] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
              {v === "dag" ? "Dag" : "Week"}
            </Button>
          ))}
        </div>

        {view === "week" && (
          <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => generateFor(weekDates)}>
              <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
              Genereer week
            </Button>
        )}

        {view === "week" ? (
          <div className="space-y-2">
            <MacroSummary totals={weekAverage} target={target} goalType={goal.type} average />
            {weekDates.map((d) => {
              const t = dayMacros(d, meals, ingredients, dishes);
              const dayEntries = meals.filter((m) => m.date === d);
              const isToday = d === format(new Date(), "yyyy-MM-dd");
              return (
                <Card key={d} className={isToday ? "border-primary ring-1 ring-primary/30" : undefined}>
                  <CardContent className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium capitalize">
                        {format(parseISO(d), "EEEE d MMM", { locale: nl })}
                        {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Vandaag</span>}
                      </div>
                      <div className={`text-sm tabular-nums ${t.kcal > target.kcal * 1.05 ? "text-destructive" : "text-muted-foreground"}`}>
                        {Math.round(t.kcal)} / {target.kcal} kcal
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => { setDate(d); setView("dag"); }}
                    >
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
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => clearDay(d)}
                        aria-label="Dag leegmaken"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Button asChild type="button" variant="outline" size="sm" className="mt-3 w-full">
              <Link to="/boodschappen" search={{ week: weekDates[0] }}>
                <ShoppingBasket className="h-4 w-4 text-primary" /> Boodschappenlijst
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <MacroSummary totals={totals} target={target} goalType={goal.type} />

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

    </div>
  );
}

function MacroSummary({
  totals,
  target,
  goalType,
  average = false,
}: {
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  target: { kcal: number; protein: number; carbs: number; fat: number };
  goalType: "afvallen" | "behouden" | "bijkomen" | "spiermassa";
  average?: boolean;
}) {
  const caloriesAgainstGoal = goalType === "bijkomen"
    ? totals.kcal < target.kcal
    : totals.kcal > target.kcal;

  return (
    <Card>
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{average ? "Gemiddelde calorieën per dag" : "Calorieën"}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums text-primary" style={{ fontFamily: "var(--font-display)" }}>
                {Math.round(totals.kcal)}
              </span>
              <span className="text-xs text-muted-foreground">/ {target.kcal} kcal</span>
            </div>
          </div>
          <div className={`text-xs font-medium tabular-nums ${caloriesAgainstGoal ? "text-destructive" : "text-success-strong"}`}>
            {Math.round(target.kcal - totals.kcal)} resterend
          </div>
        </div>
        <MacroBar label="Eiwit" cur={totals.protein} max={target.protein} unit="g" favorableOver />
        <MacroBar label="Koolhydraten" cur={totals.carbs} max={target.carbs} unit="g" />
        <MacroBar label="Vet" cur={totals.fat} max={target.fat} unit="g" />
      </CardContent>
    </Card>
  );
}

function MacroBar({ label, cur, max, unit, favorableOver = false }: { label: string; cur: number; max: number; unit: string; favorableOver?: boolean }) {
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
          className={`h-full rounded-full transition-all ${over ? (favorableOver ? "bg-success-strong" : "bg-destructive") : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
