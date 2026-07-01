import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Trash2, Scale, Sparkles } from "lucide-react";
import { useDishes, useIngredients, useMeals, type Meal, type Unit } from "@/lib/nutrition-store";
import { useGoal } from "@/lib/goal-store";
import { useEntries, useSettings } from "@/lib/weight-store";
import { computeGoal, dayMacros, dishMacrosPerServing, mealEntryMacros } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/vandaag")({
  head: () => ({ meta: [{ title: "Vandaag" }] }),
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
  const { items: ingredients } = useIngredients();
  const { items: dishes } = useDishes();
  const { items: meals, add, remove } = useMeals();
  const { goal } = useGoal();
  const { settings } = useSettings();
  const { entries, addEntry } = useEntries();
  const [adding, setAdding] = useState<Meal | null>(null);

  const generateDay = () => {
    const existing = meals.filter((m) => m.date === date).map((m) => m.id);
    existing.forEach((id) => remove(id));
    const chosen: { meal: Meal; dishId: string }[] = [];
    const tryPick = () => {
      const picks: { meal: Meal; dishId: string }[] = [];
      for (const meal of MEAL_ORDER) {
        const candidates = dishes.filter((d) => d.categories?.includes(meal));
        if (candidates.length === 0) continue;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        picks.push({ meal, dishId: pick.id });
      }
      return picks;
    };
    let best: { meal: Meal; dishId: string }[] = [];
    let bestDelta = Infinity;
    for (let i = 0; i < 20; i++) {
      const p = tryPick();
      const kcal = p.reduce((acc, x) => {
        const d = dishes.find((dd) => dd.id === x.dishId);
        if (!d) return acc;
        return acc + dishMacrosPerServing(d, ingredients).kcal;
      }, 0);
      const delta = Math.abs(kcal - target.kcal);
      if (delta < bestDelta) { bestDelta = delta; best = p; }
    }
    best.forEach((x) => add({ date, meal: x.meal, kind: "dish", refId: x.dishId, amount: 1, unit: "portie" }));
    void chosen;
  };

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

  const totals = dayMacros(date, meals, ingredients, dishes);
  const todayMeals = meals.filter((m) => m.date === date);
  const weighedToday = entries.some((e) => e.date === date);

  const shift = (delta: number) => setDate(format(addDays(parseISO(date), delta), "yyyy-MM-dd"));

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Vandaag" subtitle="Dagplanning en macro's" />

      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Datumkiezer */}
        <Card>
          <CardContent className="flex items-center justify-between px-4 py-2.5">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Vorige dag">
              <ChevronLeft className="h-5 w-5 text-primary" />
            </Button>
            <div className="text-sm font-medium capitalize">
              {format(parseISO(date), "EEEE d MMMM", { locale: nl })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Volgende dag">
              <ChevronRight className="h-5 w-5 text-primary" />
            </Button>
          </CardContent>
        </Card>

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
                          <span className="flex-1 truncate">
                            {ref?.name ?? "—"}
                            <span className="text-muted-foreground"> · {m.amount} {m.unit}</span>
                          </span>
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
        <Input className="w-20" inputMode="decimal" placeholder={latest ? String(latest) : "kg"}
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

  const list = tab === "dish"
    ? dishes.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
    : ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

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
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(tab === "dish" ? ["portie"] : UNITS).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
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
