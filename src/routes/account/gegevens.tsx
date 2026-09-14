import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { differenceInDays, differenceInYears, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/date-field";
import { useGoalTargets } from "@/lib/goal-targets";
import type { Sex } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/account/gegevens")({
  head: () => ({
    meta: [
      { title: "Gegevens | Lichter" },
      { name: "description", content: "Je gewicht, lengte, leeftijd en tijdlijn voor je doel." },
      { property: "og:title", content: "Gegevens | Lichter" },
      { property: "og:description", content: "Je gewicht, lengte, leeftijd en tijdlijn voor je doel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GegevensPage,
});

export function ageFromBirthDate(birthDate?: string) {
  if (!birthDate) return undefined;
  try {
    return differenceInYears(new Date(), parseISO(birthDate));
  } catch {
    return undefined;
  }
}

function GegevensPage() {
  const { goal, setGoal, settings, setSettings } = useGoalTargets();

  const numOrUndef = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? undefined : n;
  };

  const pace = useMemo(() => {
    const s = settings.startWeight;
    const g = settings.goalWeight;
    if (!s || !g || !settings.startDate || !settings.endDate) return null;
    const days = differenceInDays(parseISO(settings.endDate), parseISO(settings.startDate));
    if (days <= 0) return null;
    return { perWeek: ((g - s) / days) * 7, days };
  }, [settings]);

  const paceUnhealthy =
    pace &&
    ((goal.type === "afvallen" && pace.perWeek < -0.5) || (goal.type === "bijkomen" && pace.perWeek > 0.5));

  const thisYear = new Date().getFullYear();
  const age = goal.birthDate ? ageFromBirthDate(goal.birthDate) : goal.age;

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Gegevens" subtitle="Gewicht, lengte en leeftijd" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Eenheid</div>
            <Select value={settings.unit} onValueChange={(v) => setSettings({ ...settings, unit: v as "kg" | "lb" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogram (kg)</SelectItem>
                <SelectItem value="lb">Pond (lb)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Gewicht &amp; tijdlijn</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sw">Startgewicht ({settings.unit})</Label>
                <Input id="sw" inputMode="decimal" value={settings.startWeight ?? ""}
                  onChange={(e) => setSettings({ ...settings, startWeight: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gw">Doelgewicht ({settings.unit})</Label>
                <Input id="gw" inputMode="decimal" value={settings.goalWeight ?? ""}
                  onChange={(e) => setSettings({ ...settings, goalWeight: numOrUndef(e.target.value) })} />
              </div>
            </div>
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
                  {pace.perWeek > 0 ? "+" : ""}{pace.perWeek.toFixed(2)} {settings.unit}/week nodig
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
            <div className="text-sm font-medium">Over jou</div>
            <div className="space-y-2">
              <Label htmlFor="h">Lengte (cm)</Label>
              <Input id="h" inputMode="decimal" value={settings.heightCm ?? ""}
                onChange={(e) => setSettings({ ...settings, heightCm: numOrUndef(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Geboortedatum"
                value={goal.birthDate}
                fromYear={thisYear - 100}
                toYear={thisYear}
                onChange={(birthDate) =>
                  setGoal({ ...goal, birthDate, age: ageFromBirthDate(birthDate) ?? goal.age })
                }
              />
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
            {goal.birthDate ? (
              <p className="text-xs text-muted-foreground">Leeftijd: {age} jaar</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="age">Leeftijd</Label>
                <Input id="age" inputMode="numeric" value={goal.age ?? ""}
                  onChange={(e) => setGoal({ ...goal, age: numOrUndef(e.target.value) })} />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
