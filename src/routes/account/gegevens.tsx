import { createFileRoute } from "@tanstack/react-router";
import { differenceInYears, parseISO } from "date-fns";
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
      { name: "description", content: "Je huidige gewicht, lengte, geboortedatum en geslacht." },
      { property: "og:title", content: "Gegevens | Lichter" },
      { property: "og:description", content: "Je huidige gewicht, lengte, geboortedatum en geslacht." },
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

  const thisYear = new Date().getFullYear();
  const age = ageFromBirthDate(goal.birthDate);

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Gegevens" subtitle="Gewicht, lengte, geboortedatum" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Nu</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sw">Huidig gewicht (kg)</Label>
                <Input id="sw" inputMode="decimal" value={settings.startWeight ?? ""}
                  onChange={(e) => setSettings({ ...settings, startWeight: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h">Lengte (cm)</Label>
                <Input id="h" inputMode="decimal" value={settings.heightCm ?? ""}
                  onChange={(e) => setSettings({ ...settings, heightCm: numOrUndef(e.target.value) })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Je huidige gewicht telt meteen als je eerste meting.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Over jou</div>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Geboortedatum"
                value={goal.birthDate}
                fromYear={thisYear - 100}
                toYear={thisYear}
                onChange={(birthDate) =>
                  setGoal({ ...goal, birthDate, age: ageFromBirthDate(birthDate) })
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
            <p className="text-xs text-muted-foreground">
              {age !== undefined ? `Leeftijd: ${age} jaar` : "Vul je geboortedatum in; je leeftijd wordt automatisch berekend."}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
