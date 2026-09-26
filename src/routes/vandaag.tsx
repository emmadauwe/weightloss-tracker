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
import { Plus, ChevronLeft, ChevronRight, Trash2, Sparkles, Lock, LockOpen } from "lucide-react";
import { useWorkouts } from "@/lib/workouts";
import { extraMacrosForDate } from "@/lib/workout-energy";
import { formatUnit, useDishes, useIngredients, useMeals, type Ingredient, type IngredientCategory, type Meal, type MealEntry, type Unit } from "@/lib/nutrition-store";
import { INGREDIENT_CATEGORIES } from "@/lib/nutrition-store";
import { suggestMacros } from "@/lib/ai.functions";
import { sentenceCase } from "@/lib/shopping-list";
import { useGoalTargets } from "@/lib/goal-targets";
import { dayMacros, mealEntryMacros } from "@/lib/nutrition-math";
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
  const { items: ingredients, upsert: upsertIngredient, newId: newIngredientId } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals, add, remove, update } = useMeals();
  const { goal, target, currentWeight } = useGoalTargets();
  const { items: workouts } = useWorkouts();
  const losing = goal.type === "afvallen";
  const extraFor = (d: string) => extraMacrosForDate(d, workouts, currentWeight ?? 0, losing);
  const withExtra = (d: string) => {
    const e = extraFor(d);
    return { kcal: target.kcal + e.kcal, protein: target.protein + e.protein, carbs: target.carbs + e.carbs, fat: target.fat + e.fat };
  };
  const [adding, setAdding] = useState<Meal | null>(null);
  const [quickAdding, setQuickAdding] = useState<Meal | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ entry: MealEntry; name: string } | null>(null);

  const cookPerWeek = goal.cookPerWeek ?? 4;

  const weekDates = useMemo(() => {
    const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
  }, [date]);

  const generateFor = (dates: string[]) => {
    // Vastgezette maaltijden blijven staan; de rest wordt opnieuw gegenereerd.
    const inRange = meals.filter((m) => dates.includes(m.date));
    inRange.filter((m) => !m.locked).forEach((m) => remove(m.id));
    const existing = inRange
      .filter((m) => m.locked)
      .map((m) => ({
        date: m.date,
        meal: m.meal,
        dishId: m.kind === "dish" ? m.refId : undefined,
        macros: mealEntryMacros(m, ingredients, dishes),
      }));
    const picks = generatePlan({
      dates,
      dishes,
      ingredients,
      target,
      priority: "eiwit",
      cookCount: dates.length === 1 ? undefined : Math.round((cookPerWeek * dates.length) / 7),
      existing,
    });
    picksToEntries(picks).forEach((e) => add(e));
  };
  // Gemiddelde (standaard + extra door sport) doel per dag over de week.
  const weekTarget = useMemo(() => {
    const acc = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const d of weekDates) { const t = withExtra(d); acc.kcal += t.kcal; acc.protein += t.protein; acc.carbs += t.carbs; acc.fat += t.fat; }
    return { kcal: Math.round(acc.kcal / 7), protein: Math.round(acc.protein / 7), carbs: Math.round(acc.carbs / 7), fat: Math.round(acc.fat / 7) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates, workouts, target, currentWeight, losing]);

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

        {view === "week" ? (
          <div className="space-y-2">
            <MacroSummary totals={weekAverage} target={weekTarget} base={target} goalType={goal.type} average />
            <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => generateFor(weekDates)}>
              <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
              Genereer week
            </Button>
            <p className="px-1 text-[11px] text-muted-foreground">Zet gerechten vast met het slotje in de dagplanning; opnieuw genereren vervangt enkel de rest.</p>
            {weekDates.map((d) => {
              const t = dayMacros(d, meals, ingredients, dishes);
              const dayTarget = withExtra(d);
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
                      <div className={`text-sm tabular-nums ${(goal.type === "bijkomen" ? t.kcal < dayTarget.kcal : t.kcal > dayTarget.kcal) && dayEntries.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {Math.round(t.kcal)} / {dayTarget.kcal} kcal
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
                                    const leftover = (entry.leftoverFrom ? " (restje)" : "") + (entry.locked ? " 🔒" : "");
                                    return `${ref?.name ?? "—"} · ${entry.amount} ${formatUnit(entry.unit, entry.amount)}${leftover}`;
                                  }).join(", ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </button>
                    {dayEntries.length > 0 && (
                      <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5">
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {Math.round(t.protein)}P · {Math.round(t.carbs)}K · {Math.round(t.fat)}V
                        </div>
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
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <>
            <MacroSummary totals={totals} target={withExtra(date)} base={target} goalType={goal.type} />

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
                            <li key={m.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingEntry({ entry: m, name: ref?.name ?? "—" })}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-accent"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">
                                    {ref?.name ?? "—"}
                                    <span className="text-muted-foreground"> · {m.amount} {formatUnit(m.unit, m.amount)}</span>
                                  </span>
                                  <span className="mt-0.5 flex flex-wrap gap-1">
                                    {m.leftoverFrom && (
                                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary">
                                        Restje · bereid {format(parseISO(m.leftoverFrom), "EEEE d MMM", { locale: nl })}
                                      </span>
                                    )}
                                    {m.skipShopping && (
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        Niet op lijstje
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.round(macros.kcal)} kcal</span>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 shrink-0 ${m.locked ? "text-primary" : "text-muted-foreground/60"}`}
                                onClick={() => update(m.id, { locked: !m.locked })}
                                aria-label={m.locked ? "Losmaken" : "Vastzetten"}
                              >
                                {m.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAdding(meal)}>
                        <Plus className="mr-1 h-4 w-4" /> Toevoegen
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setQuickAdding(meal)}>
                        <Sparkles className="mr-1 h-4 w-4 text-primary" /> Snel toevoegen
                      </Button>
                    </div>
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

      {quickAdding && (
        <QuickAddDialog
          meal={quickAdding}
          onClose={() => setQuickAdding(null)}
          onAdd={(ingredient, amount) => {
            upsertIngredient(ingredient);
            add({ date, meal: quickAdding, kind: "ingredient", refId: ingredient.id, amount, unit: ingredient.baseUnit });
            setQuickAdding(null);
          }}
          newId={newIngredientId}
        />
      )}

      {editingEntry && (
        <EntryDialog
          name={editingEntry.name}
          entry={editingEntry.entry}
          onClose={() => setEditingEntry(null)}
          onSave={(patch) => { update(editingEntry.entry.id, patch); setEditingEntry(null); }}
          onDelete={() => { remove(editingEntry.entry.id); setEditingEntry(null); }}
        />
      )}

    </div>
  );
}

function MacroSummary({
  totals,
  target,
  base,
  goalType,
  average = false,
}: {
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  target: { kcal: number; protein: number; carbs: number; fat: number };
  base: { kcal: number; protein: number; carbs: number; fat: number };
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
              <span className={`text-2xl font-semibold tabular-nums ${caloriesAgainstGoal ? "text-destructive" : "text-primary"}`} style={{ fontFamily: "var(--font-display)" }}>
                {Math.round(totals.kcal)}
              </span>
              <span className="text-xs text-muted-foreground">/ {target.kcal} kcal</span>
            </div>
            {target.kcal > base.kcal && (
              <div className="text-[11px] text-muted-foreground">
                {base.kcal} standaard + <span className="font-medium text-primary">{target.kcal - base.kcal} extra door sport</span>
              </div>
            )}
          </div>
          <div className={`text-xs font-medium tabular-nums ${caloriesAgainstGoal ? "text-destructive" : "text-success-strong"}`}>
            {Math.round(target.kcal - totals.kcal)} resterend
          </div>
        </div>
        <MacroBar label="Eiwit" cur={totals.protein} max={target.protein} base={base.protein} unit="g" favorableOver />
        <MacroBar label="Koolhydraten" cur={totals.carbs} max={target.carbs} base={base.carbs} unit="g" />
        <MacroBar label="Vet" cur={totals.fat} max={target.fat} base={base.fat} unit="g" />
      </CardContent>
    </Card>
  );
}

function MacroBar({ label, cur, max, base, unit, favorableOver = false }: { label: string; cur: number; max: number; base: number; unit: string; favorableOver?: boolean }) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  const over = cur > max;
  const extra = max - base;
  const basePct = (base / Math.max(1, max)) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Math.round(cur)} / {max} {unit}
          {extra > 0 && <span className="text-primary"> (+{extra})</span>}
        </span>
      </div>
      <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {extra > 0 && (
          <div className="absolute inset-y-0 right-0 bg-primary/15" style={{ left: `${basePct}%` }} aria-hidden />
        )}
        {extra > 0 && (
          <div className="absolute inset-y-0 z-10 w-0.5 bg-foreground/50" style={{ left: `${basePct}%` }} title="Grens standaard macro's" />
        )}
        <div
          className={`relative h-full rounded-full transition-all ${over && !favorableOver ? "bg-destructive" : "bg-primary"}`}
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
  const { library: ingredients } = useIngredients();
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

function EntryDialog({
  name, entry, onClose, onSave, onDelete,
}: {
  name: string;
  entry: MealEntry;
  onClose: () => void;
  onSave: (patch: Partial<MealEntry>) => void;
  onDelete: () => void;
}) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [leftover, setLeftover] = useState(Boolean(entry.leftoverFrom));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount.replace(",", "."));
    if (a > 0)
      onSave({
        amount: a,
        leftoverFrom: leftover
          ? entry.leftoverFrom ?? format(addDays(parseISO(entry.date), -1), "yyyy-MM-dd")
          : undefined,
      });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="truncate pr-6">{name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eamt">{entry.unit === "portie" ? "Porties" : `Hoeveelheid (${entry.unit})`}</Label>
            <Input id="eamt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={leftover} onCheckedChange={(v) => setLeftover(v === true)} className="mt-0.5" />
              <span>
                Restje van eerder bereid gerecht
                <span className="block text-xs text-muted-foreground">
                  {entry.leftoverFrom
                    ? `Bereid op ${format(parseISO(entry.leftoverFrom), "EEEE d MMM", { locale: nl })}.`
                    : "De ingrediënten koop je bij de dag waarop je kookt."}
                </span>
              </span>
            </label>
          </div>
          <Button type="submit" className="w-full">Opslaan</Button>
          <Button type="button" variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1 h-4 w-4" /> Verwijderen uit deze maaltijd
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddDialog({
  meal, onClose, onAdd, newId,
}: {
  meal: Meal;
  onClose: () => void;
  onAdd: (ingredient: Ingredient, amount: number) => void;
  newId: () => string;
}) {
  const [name, setName] = useState("");
  const [baseUnit, setBaseUnit] = useState<Unit>("portie");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [category, setCategory] = useState<IngredientCategory>("bereide maaltijden");
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;
  const perLabel = baseUnit === "g" || baseUnit === "ml" ? `per 100 ${baseUnit}` : `per 1 ${baseUnit}`;

  const ask = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const s = await suggestMacros({ data: { name: name.trim(), baseUnit } });
      setKcal(String(s.kcal));
      setProtein(String(s.protein));
      setCarbs(String(s.carbs));
      setFat(String(s.fat));
      if ((INGREDIENT_CATEGORIES as readonly string[]).includes(s.category)) {
        setCategory(s.category as IngredientCategory);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "De AI-schatting is niet gelukt.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = num(amount);
    if (!name.trim() || !a) return;
    onAdd(
      {
        id: newId(),
        name: name.trim(),
        baseUnit,
        kcal: num(kcal),
        protein: num(protein),
        carbs: num(carbs),
        fat: num(fat),
        category,
        quick: true,
      },
      a,
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Snel toevoegen aan {MEAL_LABEL[meal]}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qname">Wat heb je gegeten?</Label>
            <Input id="qname" value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Falafelwrap" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Eenheid</Label>
              <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as Unit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qamt">Hoeveelheid</Label>
              <Input id="qamt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void ask()} disabled={loading || !name.trim()}>
            <Sparkles className="mr-1 h-4 w-4 text-primary" />
            {loading ? "Even zoeken…" : "Stel macro's voor met AI"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Waardes hieronder gelden {perLabel}.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qkcal">Kcal</Label>
              <Input id="qkcal" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qprot">Eiwit (g)</Label>
              <Input id="qprot" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qcarb">Koolhydraten (g)</Label>
              <Input id="qcarb" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qfat">Vet (g)</Label>
              <Input id="qfat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IngredientCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INGREDIENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{sentenceCase(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Toevoegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
