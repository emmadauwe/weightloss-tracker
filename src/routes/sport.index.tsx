import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Dumbbell, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { WorkoutDialog } from "@/components/workout-dialog";
import { useGoal } from "@/lib/goal-store";
import { useWorkoutPlans } from "@/lib/workout-plans";
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

  const chosen = useMemo(() => {
    const ids = goal.sports?.length ? goal.sports : Array.from(new Set(items.map((w) => w.sport)));
    return ids.map(sportOf).filter((s) => SPORTS.some((x) => x.id === s.id) || items.some((w) => w.sport === s.id));
  }, [goal.sports, items]);


  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Sport" subtitle="Trainingen en prestaties" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
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
                          {own.length} {own.length === 1 ? "sessie" : "sessies"}
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

    </div>
  );
}

