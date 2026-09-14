import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addWeeks, differenceInDays, format, parseISO } from "date-fns";
import { DateField } from "@/components/date-field";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useGoalTargets } from "@/lib/goal-targets";
import type { GoalType, Intensity, Lifestyle } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/account/doel")({
  head: () => ({
    meta: [
      { title: "Doel | Lichter" },
      { name: "description", content: "Je doeltype, beweging en persoonlijke macro's per dag." },
      { property: "og:title", content: "Doel | Lichter" },
      { property: "og:description", content: "Je doeltype, beweging en persoonlijke macro's per dag." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DoelPage,
});

type PaceChoice = "snel" | "gemiddeld" | "traag";
const PACES: { id: PaceChoice; label: string; kg: number }[] = [
  { id: "snel", label: "Snel", kg: 0.5 },
  { id: "gemiddeld", label: "Gemiddeld", kg: 0.35 },
  { id: "traag", label: "Rustig", kg: 0.25 },
];

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: "afvallen", label: "Afvallen" },
  { id: "behouden", label: "Op gewicht" },
  { id: "bijkomen", label: "Bijkomen" },
  { id: "spiermassa", label: "Spiermassa" },
];

function DoelPage() {
  const { goal, setGoal, calc, settings, setSettings, currentWeight } = useGoalTargets();

  const numOrUndef = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? undefined : n;
  };

  /** Ideaal gewicht = midden van de gezonde BMI-zone (18,5–24,9). */
  const idealSuggestion = useMemo(() => {
    const h = settings.heightCm;
    if (!h || h < 100) return null;
    const m = h / 100;
    return { ideal: 21.7 * m * m, min: 18.5 * m * m, max: 24.9 * m * m };
  }, [settings.heightCm]);

  /** Termijn op basis van het gekozen tempo (max 0,5 kg/week, op- of afwaarts). */
  const [paceChoice, setPaceChoice] = useState<PaceChoice>("gemiddeld");
  const endSuggestion = useMemo(() => {
    const startWeight = settings.startWeight ?? currentWeight;
    const target = settings.goalWeight ?? idealSuggestion?.ideal;
    if (!startWeight || !target) return null;
    const perWeek = PACES.find((p) => p.id === paceChoice)!.kg;
    const diff = Math.abs(startWeight - target);
    const weeks = diff >= perWeek ? Math.ceil(diff / perWeek) : 0;
    const start = settings.startDate ? parseISO(settings.startDate) : new Date();
    return {
      perWeek,
      weeks,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: weeks > 0 ? format(addWeeks(start, weeks), "yyyy-MM-dd") : undefined,
    };
  }, [settings.startWeight, settings.goalWeight, settings.startDate, currentWeight, idealSuggestion, paceChoice]);

  const pace = useMemo(() => {
    const s = settings.startWeight;
    const g = settings.goalWeight;
    if (!s || !g || !settings.startDate || !settings.endDate) return null;
    const days = differenceInDays(parseISO(settings.endDate), parseISO(settings.startDate));
    if (days <= 0) return null;
    return { perWeek: ((g - s) / days) * 7, days };
  }, [settings]);

  const paceUnhealthy =
    !!pace && ((goal.type === "afvallen" && pace.perWeek < -0.5) || (goal.type === "bijkomen" && pace.perWeek > 0.5));


  const active = {
    kcal: goal.overrideKcal ?? calc?.kcal,
    protein: goal.overrideProtein ?? calc?.protein,
    carbs: goal.overrideCarbs ?? calc?.carbs,
    fat: goal.overrideFat ?? calc?.fat,
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Doel" subtitle="Doeltype, beweging en macro's" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
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

        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Doelgewicht &amp; tijdlijn</div>
            <div className="space-y-2">
              <Label htmlFor="gw">Doelgewicht (kg)</Label>
              <Input id="gw" inputMode="decimal" value={settings.goalWeight ?? ""}
                onChange={(e) => setSettings({ ...settings, goalWeight: numOrUndef(e.target.value) })} />
            </div>
            {suggestion && (
              <div className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs">
                <div className="font-medium">
                  Voorstel: {suggestion.ideal.toFixed(1)} kg
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  Dat ligt precies in het midden van een gezonde BMI voor jouw lengte
                  ({suggestion.min.toFixed(1)}–{suggestion.max.toFixed(1)} kg).
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSettings({ ...settings, goalWeight: Number(suggestion.ideal.toFixed(1)) })
                    }
                  >
                    Gebruik dit doelgewicht
                  </Button>
                  {suggestion.endDate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          startDate: settings.startDate ?? suggestion.startDate,
                          endDate: suggestion.endDate,
                        })
                      }
                    >
                      Stel einddag voor ({suggestion.weeks} weken)
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <DateField label="Startdag" value={settings.startDate}
                onChange={(startDate) => setSettings({ ...settings, startDate })} />
              <DateField label="Einddag" value={settings.endDate}
                onChange={(endDate) => setSettings({ ...settings, endDate })} />
            </div>
            {pace && (
              <div
                className="rounded-lg border px-3 py-2.5 text-xs"
                style={{
                  borderColor: paceUnhealthy ? "var(--destructive)" : "var(--primary)",
                  background: paceUnhealthy
                    ? "color-mix(in oklab, var(--destructive) 10%, transparent)"
                    : "color-mix(in oklab, var(--primary) 10%, transparent)",
                  color: paceUnhealthy ? "var(--destructive)" : "var(--primary)",
                }}
              >
                <div className="font-medium tabular-nums">
                  {pace.perWeek > 0 ? "+" : ""}{pace.perWeek.toFixed(2)} kg/week nodig
                </div>
                <div className="mt-0.5 opacity-80">
                  {paceUnhealthy ? "Te ambitieus — aanbevolen is max 0,5 kg/week." : "Gezond tempo (≤ 0,5 kg/week)."}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Dagelijks leven</div>
            <p className="text-xs text-muted-foreground">Hoe zit/sta/wandel je op een gemiddelde dag, buiten sport om?</p>
            <Select value={goal.lifestyle ?? "zittend"} onValueChange={(v) => setGoal({ ...goal, lifestyle: v as Lifestyle })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zittend">Zittend werk, weinig bewegen</SelectItem>
                <SelectItem value="licht_actief">Zittend werk + wat wandelen</SelectItem>
                <SelectItem value="actief">Veel op de been / staand werk</SelectItem>
                <SelectItem value="zeer_actief">Zwaar fysiek werk</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Sport &amp; beweging</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="spw">Sessies per week</Label>
                <Input id="spw" inputMode="numeric" value={goal.sessionsPerWeek ?? ""}
                  onChange={(e) => setGoal({ ...goal, sessionsPerWeek: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mps">Minuten per sessie</Label>
                <Input id="mps" inputMode="numeric" value={goal.minutesPerSession ?? ""}
                  onChange={(e) => setGoal({ ...goal, minutesPerSession: numOrUndef(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intensiteit</Label>
              <Select value={goal.intensity ?? "matig"} onValueChange={(v) => setGoal({ ...goal, intensity: v as Intensity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag (yoga, rustig wandelen)</SelectItem>
                  <SelectItem value="matig">Matig (fitness, fietsen, dansen)</SelectItem>
                  <SelectItem value="hoog">Hoog (hardlopen, HIIT, voetbal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!calc ? (
          <Card>
            <CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
              Vul je leeftijd, lengte en startgewicht in bij Gegevens om je dagelijks plan te zien.
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
                      <div className={Math.abs(calc.perWeekKg) > 0.5 ? "text-destructive" : "text-success"}>
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

            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Aanpassen (optioneel)</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setGoal({ ...goal, overrideKcal: undefined, overrideProtein: undefined, overrideCarbs: undefined, overrideFat: undefined })
                    }
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5 text-primary" /> Reset
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <OverrideInput label="Kcal" v={active.kcal} onChange={(n) => setGoal({ ...goal, overrideKcal: n })} />
                  <OverrideInput label="Eiwit (g)" v={active.protein} onChange={(n) => setGoal({ ...goal, overrideProtein: n })} />
                  <OverrideInput label="Koolhydraten (g)" v={active.carbs} onChange={(n) => setGoal({ ...goal, overrideCarbs: n })} />
                  <OverrideInput label="Vet (g)" v={active.fat} onChange={(n) => setGoal({ ...goal, overrideFat: n })} />
                </div>
                <p className="text-xs text-muted-foreground">Deze waarden worden gebruikt in je dag- en weekplanning.</p>
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
