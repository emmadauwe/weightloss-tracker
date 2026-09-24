import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { WorkoutDialog } from "@/components/workout-dialog";
import { StrengthSection } from "@/components/strength-section";
import { useGoal } from "@/lib/goal-store";
import { useWorkoutPlans } from "@/lib/workout-plans";
import { heaviestSet, personalRecord, sportOf, useWorkouts, workoutSummary, type Workout } from "@/lib/workouts";

export const Route = createFileRoute("/sport/$id")({
  head: ({ params }) => {
    const label = sportOf(params.id).label;
    return {
      meta: [
        { title: `${label} | Lichter` },
        { name: "description", content: `Je prestaties, records en voortgang voor ${label.toLowerCase()}.` },
        { property: "og:title", content: `${label} | Lichter` },
        { property: "og:description", content: `Je prestaties, records en voortgang voor ${label.toLowerCase()}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SportDetail,
});

function SportDetail() {
  const { id } = Route.useParams();
  const sport = sportOf(id);
  const { items, loading, save, remove } = useWorkouts();
  const { goal } = useGoal();
  const plans = useWorkoutPlans();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);

  const own = useMemo(() => items.filter((w) => w.sport === id), [items, id]);
  const focusKm = sport.id === "lopen" ? goal.runFocusKm : undefined;

  const focused = useMemo(() => {
    if (!focusKm) return own;
    return own.filter((w) => w.distance_km != null && Math.abs(w.distance_km - focusKm) <= focusKm * 0.15);
  }, [own, focusKm]);

  const base = focusKm ? focused : own;

  const totals = useMemo(() => {
    const km = base.reduce((t, w) => t + (w.distance_km ?? 0), 0);
    const min = base.reduce((t, w) => t + (w.duration_min ?? 0), 0);
    const speeds = base.map((w) => w.avg_speed).filter((v): v is number => v != null);
    const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    const max = base.reduce<number | null>((m, w) => (w.max_speed != null && (m == null || w.max_speed > m) ? w.max_speed : m), null);
    const heavy = base.reduce<number | null>((m, w) => {
      const h = heaviestSet(w);
      return h != null && (m == null || h > m) ? h : m;
    }, null);
    const bestTime = base.reduce<number | null>(
      (m, w) => (w.duration_min != null && (m == null || w.duration_min < m) ? w.duration_min : m),
      null,
    );
    return { km, min, avg, max, heavy, bestTime, sessions: base.length };
  }, [base]);

  const chart = useMemo(() => {
    const pick = (w: Workout): number | null => {
      if (sport.kind === "cardio") return w.avg_speed ?? (w.distance_km ?? null);
      if (sport.kind === "kracht") return heaviestSet(w);
      return w.duration_min;
    };
    return base
      .slice()
      .reverse()
      .map((w) => ({ label: format(parseISO(w.date), "d MMM", { locale: nl }), value: pick(w) }))
      .filter((p) => p.value != null);
  }, [base, sport.kind]);

  const chartLabel =
    sport.kind === "cardio" ? "Gem. snelheid (km/u)" : sport.kind === "kracht" ? "Zwaarste set (kg)" : "Duur (min)";

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title={sport.label} subtitle={focusKm ? `Focus ${focusKm} km` : "Prestaties en voortgang"} back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {sport.kind === "kracht" ? (
          <StrengthSection sportId={sport.id} workouts={own} plans={plans} save={save} remove={remove} />
        ) : (
        <>
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
            <Stat label="Sessies" value={String(totals.sessions)} />
            <Stat label="Duur (min)" value={String(Math.round(totals.min))} />
            {sport.kind === "cardio" ? (
              <>
                <Stat label="Totale afstand" value={`${totals.km.toFixed(1)} km`} />
                <Stat label="Gem. snelheid" value={totals.avg != null ? `${totals.avg.toFixed(1)} km/u` : "—"} />
                <Stat label="Hoogste snelheid" value={totals.max != null ? `${totals.max.toFixed(1)} km/u` : "—"} />
                {focusKm && (
                  <Stat
                    label={`Snelste ${focusKm} km`}
                    value={totals.bestTime != null ? `${Math.round(totals.bestTime)} min` : "—"}
                  />
                )}
              </>
            ) : sport.kind === "kracht" ? (
<Stat label="Zwaarste set" value={totals.heavy != null ? `${totals.heavy} kg` : "—"} />
            ) : (
              <Stat
                label="Gem. duur"
                value={totals.sessions ? `${Math.round(totals.min / totals.sessions)} min` : "—"}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-4">
            <div className="mb-2 text-xs text-muted-foreground">{chartLabel}</div>
            {chart.length < 2 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Voeg 2+ trainingen toe voor de grafiek
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 1", "dataMax + 1"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 13,
                      }}
                      formatter={(v: number) => [String(v), chartLabel]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Training toevoegen
        </Button>

        {loading ? (
          <p className="px-1 text-xs text-muted-foreground">Laden…</p>
        ) : own.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Dumbbell className="mb-2 h-7 w-7 text-primary" />
              <p className="text-sm font-medium">Nog geen trainingen</p>
              <p className="mt-1 text-xs text-muted-foreground">Voeg je eerste sessie toe en volg je vooruitgang.</p>
            </CardContent>
          </Card>
        ) : (
          own.map((w) => {
            const pr = personalRecord(w, own);
            return (
              <Card key={w.id}>
                <CardContent className="flex items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs capitalize text-muted-foreground">
                        {format(parseISO(w.date), "EEEE d MMM yyyy", { locale: nl })}
                      </span>
                      {pr && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Trophy className="h-3 w-3" /> Record {pr.kind}
                        </span>
                      )}
                    </div>
                    {workoutSummary(w) && (
                      <div className="mt-1 break-words text-xs text-muted-foreground">{workoutSummary(w)}</div>
                    )}
                    {w.exercises?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {w.exercises.map((ex, i) => (
                          <li key={i} className="break-words">
                            · {ex.name}: {ex.sets.map((s) => `${s.weight ?? 0} kg × ${s.reps ?? 0}`).join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                    {w.note && <p className="mt-2 break-words text-xs text-muted-foreground">{w.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(w)} aria-label="Aanpassen">
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void remove(w.id)}
                      aria-label="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        </>
        )}
      </main>

      {(creating || editing) && (
        <WorkoutDialog
          initial={editing}
          fixedSport={sport.id}
          plans={plans.items}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (input) => {
            await save(input);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
