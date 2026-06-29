import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useGoal } from "@/lib/goal-store";
import { useEntries, useSettings } from "@/lib/weight-store";
import { computeGoal, type Activity, type GoalType, type Sex } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/doel")({
  head: () => ({ meta: [{ title: "Doel" }] }),
  component: DoelPage,
});

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: "afvallen", label: "Afvallen" },
  { id: "behouden", label: "Op gewicht" },
  { id: "bijkomen", label: "Bijkomen" },
  { id: "spiermassa", label: "Spiermassa" },
];

function DoelPage() {
  const { goal, setGoal } = useGoal();
  const { entries } = useEntries();
  const { settings } = useSettings();

  const latest = entries[entries.length - 1]?.weight;
  const calc = useMemo(() => {
    if (!latest || !settings.heightCm || !goal.age) return null;
    return computeGoal({
      type: goal.type,
      weightKg: settings.unit === "lb" ? latest * 0.453592 : latest,
      goalKg: settings.goalWeight,
      heightCm: settings.heightCm,
      age: goal.age,
      sex: goal.sex,
      activity: goal.activity,
      startDate: settings.startDate,
      endDate: settings.endDate,
    });
  }, [latest, settings, goal]);

  const active = {
    kcal: goal.overrideKcal ?? calc?.kcal,
    protein: goal.overrideProtein ?? calc?.protein,
    carbs: goal.overrideCarbs ?? calc?.carbs,
    fat: goal.overrideFat ?? calc?.fat,
  };

  const numOrUndef = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? undefined : n;
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Doel" subtitle="Persoonlijk plan en macro's" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Doeltype */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Wat is je doel?</div>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGoal({ ...goal, type: t.id })}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    goal.type === t.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Persoonsdata */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Over jou</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Leeftijd</Label>
                <Input id="age" inputMode="numeric" value={goal.age ?? ""}
                  onChange={(e) => setGoal({ ...goal, age: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Geslacht</Label>
                <Select value={goal.sex} onValueChange={(v) => setGoal({ ...goal, sex: v as Sex })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v">Vrouw</SelectItem>
                    <SelectItem value="m">Man</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Activiteit</Label>
              <Select value={goal.activity} onValueChange={(v) => setGoal({ ...goal, activity: v as Activity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag (zittend werk)</SelectItem>
                  <SelectItem value="matig">Matig (3–5× sport/week)</SelectItem>
                  <SelectItem value="hoog">Hoog (zwaar werk of dagelijks sport)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Lengte, huidig gewicht, doelgewicht en datums komen uit de Gewicht-pagina.
            </p>
          </CardContent>
        </Card>

        {/* Berekend resultaat */}
        {!calc ? (
          <Card>
            <CardContent className="px-5 py-6 text-sm text-muted-foreground text-center">
              Vul je leeftijd, lengte en een eerste meting in om je dagelijks plan te zien.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Aanbevolen per dag</div>
                    <div className="text-3xl font-semibold tabular-nums text-primary" style={{ fontFamily: "var(--font-display)" }}>
                      {calc.kcal} <span className="text-sm font-normal text-muted-foreground">kcal</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    TDEE: {calc.tdee} kcal
                    {calc.perWeekKg !== 0 && (
                      <div className={Math.abs(calc.perWeekKg) > 1 ? "text-destructive" : "text-success"}>
                        {calc.perWeekKg > 0 ? "+" : ""}{calc.perWeekKg.toFixed(2)} kg/week
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Macro tag="P" v={calc.protein} />
                  <Macro tag="K" v={calc.carbs} />
                  <Macro tag="V" v={calc.fat} />
                </div>
              </CardContent>
            </Card>

            {calc.warnings.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="flex gap-3 px-5 py-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-destructive">Let op</div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {calc.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overrides */}
            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Aanpassen (optioneel)</div>
                  <Button variant="ghost" size="sm" onClick={() => setGoal({ ...goal, overrideKcal: undefined, overrideProtein: undefined, overrideCarbs: undefined, overrideFat: undefined })}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5 text-primary" /> Reset
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <OverrideInput label="Kcal" v={active.kcal} onChange={(n) => setGoal({ ...goal, overrideKcal: n })} />
                  <OverrideInput label="Eiwit (g)" v={active.protein} onChange={(n) => setGoal({ ...goal, overrideProtein: n })} />
                  <OverrideInput label="Koolhydraten (g)" v={active.carbs} onChange={(n) => setGoal({ ...goal, overrideCarbs: n })} />
                  <OverrideInput label="Vet (g)" v={active.fat} onChange={(n) => setGoal({ ...goal, overrideFat: n })} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Macro({ tag, v }: { tag: string; v: number }) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{tag}</div>
      <div className="text-base font-semibold tabular-nums">{v}<span className="text-xs font-normal text-muted-foreground">g</span></div>
    </div>
  );
}

function OverrideInput({ label, v, onChange }: { label: string; v?: number; onChange: (n: number | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={v ?? ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          onChange(isNaN(n) ? undefined : n);
        }} />
    </div>
  );
}
