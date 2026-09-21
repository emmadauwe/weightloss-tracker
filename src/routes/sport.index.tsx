import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Dumbbell, ListChecks, Pencil, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { WorkoutDialog } from "@/components/workout-dialog";
import { PlanDialog } from "@/components/plan-dialog";
import { useGoal } from "@/lib/goal-store";
import { useWorkoutPlans, type WorkoutPlan } from "@/lib/workout-plans";
import { SPORTS, sportOf, useWorkouts } from "@/lib/workouts";

export const Route = createFileRoute("/sport/")({
  head: () => ({
    meta: [
      { title: "Sport | Lichter" },
      { name: "description", content: "Overzicht van je sporten, trainingen en fitnessschema's." },
      { property: "og:title", content: "Sport | Lichter" },
      { property: "og:description", content: "Overzicht van je sporten, trainingen en fitnessschema's." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SportOverview,
});

function SportOverview() {
  const { items, loading, save } = useWorkouts();
  const { goal } = useGoal();
  const plans = useWorkoutPlans();
  const [creating, setCreating] = useState(false);
  const [planEdit, setPlanEdit] = useState<WorkoutPlan | null>(null);
  const [planNew, setPlanNew] = useState(false);

  const chosen = useMemo(() => {
    const ids = goal.sports?.length ? goal.sports : Array.from(new Set(items.map((w) => w.sport)));
    return ids.map(sportOf).filter((s) => SPORTS.some((x) => x.id === s.id) || items.some((w) => w.sport === s.id));
  }, [goal.sports, items]);

  const last30 = useMemo(() => {
    const from = format(subDays(new Date(), 29), "yyyy-MM-dd");
    return items.filter((w) => w.date >= from);
  }, [items]);

  const hasStrength = chosen.some((s) => s.kind === "kracht");

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Sport" subtitle="Trainingen en prestaties" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="grid grid-cols-3 gap-3 px-5 py-4">
            <Stat label="Sessies (30 d)" value={String(last30.length)} />
            <Stat
              label="Minuten"
              value={String(Math.round(last30.reduce((t, w) => t + (w.duration_min ?? 0), 0)))}
            />
            <Stat
              label="Kilometers"
              value={(last30.reduce((t, w) => t + (w.distance_km ?? 0), 0) || 0).toFixed(1)}
            />
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Training toevoegen
        </Button>

        {loading ? (
          <p className="px-1 text-xs text-muted-foreground">Laden…</p>
        ) : chosen.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Dumbbell className="mb-2 h-7 w-7 text-primary" />
              <p className="text-sm font-medium">Nog geen sporten gekozen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kies bij Doel welke sporten je doet, of voeg meteen een training toe.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/account/doel">Sporten kiezen</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {chosen.map((s) => {
              const own = items.filter((w) => w.sport === s.id);
              const km = own.reduce((t, w) => t + (w.distance_km ?? 0), 0);
              const min = own.reduce((t, w) => t + (w.duration_min ?? 0), 0);
              return (
                <Link key={s.id} to="/sport/$id" params={{ id: s.id }} className="block">
                  <Card className="transition-colors hover:bg-accent/40">
                    <CardContent className="flex items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {own.length} sessies
                          {km > 0 ? ` · ${km.toFixed(1)} km` : ""}
                          {min > 0 ? ` · ${Math.round(min)} min` : ""}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {hasStrength && (
          <Card>
            <CardContent className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Fitnessschema's</span>
              </div>
              {plans.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Maak schema's zoals Bovenlichaam, Benen of Rug met vaste oefeningen.
                </p>
              ) : (
                <ul className="space-y-2">
                  {plans.items.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.exercises.length} oefeningen
                          {p.source_name ? ` · van ${p.source_name}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Schema aanpassen"
                        onClick={() => setPlanEdit(p)}
                      >
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setPlanNew(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Schema toevoegen
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {creating && (
        <WorkoutDialog
          initial={null}
          sports={goal.sports}
          plans={plans.items}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            await save(input);
            setCreating(false);
          }}
        />
      )}

      {(planNew || planEdit) && (
        <PlanDialog
          initial={planEdit}
          onClose={() => {
            setPlanNew(false);
            setPlanEdit(null);
          }}
          onSave={async (input) => {
            await plans.save(input);
            setPlanNew(false);
            setPlanEdit(null);
          }}
          onDelete={
            planEdit
              ? async () => {
                  await plans.remove(planEdit.id);
                  setPlanEdit(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
