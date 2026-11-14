import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronLeft, ChevronRight, ExternalLink, ListChecks, Pencil, Plus, SkipForward, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/date-field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PlanDialog } from "@/components/plan-dialog";
import { MuscleMap } from "@/components/muscle-map";
import type { WorkoutPlan, PlanExercise } from "@/lib/workout-plans";
import type { Workout, WorkoutInput, WorkoutSet } from "@/lib/workouts";

type Plans = {
  items: WorkoutPlan[];
  save: (input: Parameters<React.ComponentProps<typeof PlanDialog>["onSave"]>[0]) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
};

export function StrengthSection({
  sportId,
  workouts,
  plans,
  save,
  remove,
}: {
  sportId: string;
  workouts: Workout[];
  plans: Plans;
  save: (input: WorkoutInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [exercise, setExercise] = useState<PlanExercise | null>(null);
  const [planEdit, setPlanEdit] = useState<WorkoutPlan | null>(null);
  const [planNew, setPlanNew] = useState(false);
  const plan = plans.items.find((p) => p.id === planId) ?? null;

  const dialogs = (
    <>
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
                  if (planId === planEdit.id) setPlanId(null);
                  setPlanEdit(null);
                }
              : undefined
          }
        />
      )}
    </>
  );

  if (plan && exercise) {
    return (
      <ExerciseView
        sportId={sportId}
        plan={plan}
        exercise={exercise}
        workouts={workouts}
        onBack={() => setExercise(null)}
        save={save}
        remove={remove}
      />
    );
  }

  if (plan) {
    return (
      <>
        <button
          className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
          onClick={() => setPlanId(null)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Alle schema's
        </button>
        <Card>
          <CardContent className="flex items-start gap-2 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="break-words text-base font-semibold">{plan.name}</div>
              <div className="text-xs text-muted-foreground">
                Kies een oefening om een sessie te loggen
                {plan.source_name ? ` · van ${plan.source_name}` : ""}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Schema aanpassen" onClick={() => setPlanEdit(plan)}>
              <Pencil className="h-4 w-4 text-primary" />
            </Button>
          </CardContent>
        </Card>
        {plan.exercises.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">Dit schema heeft nog geen oefeningen.</p>
        ) : (
          plan.exercises.map((ex, i) => {
            const count = historyFor(workouts, plan.id, ex.name).length;
            return (
              <button key={i} className="block w-full text-left" onClick={() => setExercise(ex)}>
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium">{ex.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ex.sets ? `${ex.sets} sets` : ""}
                        {ex.reps ? ` × ${ex.reps} reps` : ""}
                        {` · ${count} ${count === 1 ? "sessie" : "sessies"}`}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </button>
            );
          })
        )}
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-1 pt-1">
        <ListChecks className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Fitnessschema's</span>
      </div>
      {plans.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            Maak schema's zoals Bovenlichaam, Benen of Rug met vaste oefeningen.
          </CardContent>
        </Card>
      ) : (
        plans.items.map((p) => (
          <button key={p.id} className="block w-full text-left" onClick={() => setPlanId(p.id)}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.exercises.length} {p.exercises.length === 1 ? "oefening" : "oefeningen"}
                    {p.source_name ? ` · van ${p.source_name}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        ))
      )}
      <Button className="w-full" onClick={() => setPlanNew(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Schema toevoegen
      </Button>
      {dialogs}
    </>
  );
}

type Entry = { workout: Workout; sets: WorkoutSet[] };

function historyFor(workouts: Workout[], planId: string, name: string): Entry[] {
  const key = name.trim().toLowerCase();
  const out: Entry[] = [];
  for (const w of workouts) {
    if (w.plan_id && w.plan_id !== planId) continue;
    const ex = w.exercises?.find((e) => e.name.trim().toLowerCase() === key);
    if (ex && ex.sets.length) out.push({ workout: w, sets: ex.sets });
  }
  return out.sort((a, b) => b.workout.date.localeCompare(a.workout.date));
}

function avgWeight(sets: WorkoutSet[]): number | null {
  const ws = sets.map((s) => s.weight).filter((v): v is number => v != null);
  return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null;
}

function ExerciseView({
  sportId,
  plan,
  exercise,
  workouts,
  onBack,
  save,
  remove,
}: {
  sportId: string;
  plan: WorkoutPlan;
  exercise: PlanExercise;
  workouts: Workout[];
  onBack: () => void;
  save: (input: WorkoutInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}) {
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState<typeof history[number] | null>(null);
  const history = useMemo(() => historyFor(workouts, plan.id, exercise.name), [workouts, plan.id, exercise.name]);
  const chart = useMemo(
    () =>
      history
        .slice()
        .reverse()
        .map((h) => ({ label: format(parseISO(h.workout.date), "d MMM", { locale: nl }), value: avgWeight(h.sets) }))
        .filter((p) => p.value != null)
        .map((p) => ({ ...p, value: Math.round(p.value! * 10) / 10 })),
    [history],
  );
  const bestSet = history.reduce((best, h) => Math.max(best, ...h.sets.map((s) => s.weight ?? 0)), 0);
  const totalVolume = history.reduce(
    (total, h) => total + h.sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
    0,
  );

  return (
    <>
      <button className="flex items-center gap-1 px-1 text-xs text-muted-foreground" onClick={onBack}>
        <ChevronLeft className="h-3.5 w-3.5" /> {plan.name}
      </button>
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 break-words text-base font-semibold">{exercise.name}</div>
            {exercise.youtube && (
              <a href={exercise.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary">
                Uitleg <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <MuscleMap exerciseName={exercise.name} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Beste set</div>
              <div className="text-sm font-semibold tabular-nums">{bestSet || "—"}{bestSet ? " kg" : ""}</div>
            </div>
            <div className="rounded-lg bg-secondary px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Totaal trainingsvolume</div>
              <div className="text-sm font-semibold tabular-nums">{Math.round(totalVolume).toLocaleString("nl-BE")} kg</div>
            </div>
          </div>
          <div className="mb-2 mt-3 text-xs text-muted-foreground">Gemiddeld gewicht per sessie (kg)</div>
          {chart.length < 2 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Log 2+ sessies voor de grafiek</p>
          ) : (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13 }}
                    formatter={(v: number) => [`${v} kg`, "Gem. gewicht"]}
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      <Button className="w-full" onClick={() => setLogging(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Sessie loggen
      </Button>
      {history.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">Nog geen sessies voor deze oefening.</p>
      ) : (
        history.map((h) => (
          <Card key={h.workout.id}>
            <CardContent className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs capitalize text-muted-foreground">
                  {format(parseISO(h.workout.date), "EEEE d MMM yyyy", { locale: nl })}
                </div>
                <ul className="mt-1 space-y-0.5 text-sm tabular-nums">
                  {h.sets.map((s, i) => (
                    <li key={i}>
                      Set {i + 1}: {s.weight ?? 0} kg × {s.reps ?? 0}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Verwijderen"
                onClick={() => setDeleting(h)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
      {logging && (
        <LogDialog
          exercise={exercise}
          last={history[0]?.sets}
          onClose={() => setLogging(false)}
          onSave={async (date, sets) => {
            await save({
              date,
              sport: sportId,
              duration_min: null,
              distance_km: null,
              avg_speed: null,
              max_speed: null,
              min_speed: null,
              plan_id: plan.id,
              intensity: null,
              note: null,
              exercises: [{ name: exercise.name, sets }],
            });
            setLogging(false);
          }}
        />
      )}
      <ConfirmDelete
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          const h = deleting;
          const rest = h.workout.exercises.filter((e) => e.name.trim().toLowerCase() !== exercise.name.trim().toLowerCase());
          if (rest.length === 0) void remove(h.workout.id);
          else {
            const { id, date, sport, duration_min, distance_km, avg_speed, max_speed, min_speed, plan_id, intensity, note } = h.workout;
            void save({ id, date, sport, duration_min, distance_km, avg_speed, max_speed, min_speed, plan_id, intensity, note, exercises: rest });
          }
        }}
        title="Sessie verwijderen?"
        description={deleting ? `De gelogde sessie van ${format(parseISO(deleting.workout.date), "EEEE d MMM yyyy", { locale: nl })} voor “${exercise.name}” wordt verwijderd.` : ""}
      />
    </>
  );
}

function LogDialog({
  exercise,
  last,
  onClose,
  onSave,
}: {
  exercise: PlanExercise;
  last?: WorkoutSet[];
  onClose: () => void;
  onSave: (date: string, sets: WorkoutSet[]) => Promise<void>;
}) {
  type SetRow = { weight: string; reps: string; done: boolean };
  const [date, setDate] = useState<string | undefined>(format(new Date(), "yyyy-MM-dd"));
  const initial: SetRow[] = last?.length
    ? last.map((s) => ({ weight: s.weight?.toString() ?? "", reps: s.reps?.toString() ?? "", done: false }))
    : Array.from({ length: exercise.sets || 3 }, () => ({ weight: "", reps: exercise.reps?.toString() ?? "", done: false }));
  const [sets, setSets] = useState(initial);
  const [restSeconds, setRestSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const n = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
  const completed = sets.filter((s) => s.done);

  useEffect(() => {
    if (restSeconds <= 0) return;
    const timer = window.setInterval(() => setRestSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [restSeconds > 0]);

  const completeSet = (index: number) => {
    const row = sets[index];
    if (n(row.weight) == null && n(row.reps) == null) return;
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, done: !s.done } : s)));
    if (!row.done) setRestSeconds(120);
  };
  const restLabel = `${Math.floor(restSeconds / 60)}:${String(restSeconds % 60).padStart(2, "0")}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">{exercise.name}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!date || completed.length === 0) return;
            setSaving(true);
            try {
              await onSave(date, completed.map((s) => ({ weight: n(s.weight), reps: n(s.reps) })));
            } finally {
              setSaving(false);
            }
          }}
        >
          <DateField label="Datum" value={date} onChange={setDate} />
          {last?.length ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Je vorige gewichten en reps zijn ingevuld. Vink elke set af zodra je ze hebt gedaan.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Vul gewicht en reps in en vink elke set af zodra je ze hebt gedaan.</p>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem_2rem] gap-1.5 text-[11px] text-muted-foreground">
              <span>Set</span><span>Gewicht (kg)</span><span>Reps</span><span /><span />
            </div>
            {sets.map((s, i) => (
              <div key={i} className={`grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem_2rem] items-center gap-1.5 rounded-md ${s.done ? "bg-secondary/60" : ""}`}>
                <span className="text-center text-sm tabular-nums">{i + 1}</span>
                <Input aria-label={`Gewicht set ${i + 1}`} disabled={s.done} className="min-w-0 px-2" inputMode="decimal" value={s.weight} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <Input aria-label={`Reps set ${i + 1}`} disabled={s.done} className="min-w-0 px-2" inputMode="numeric" value={s.reps} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
                <Button type="button" variant={s.done ? "default" : "outline"} size="icon" className="h-8 w-8" aria-label={s.done ? `Set ${i + 1} opnieuw openen` : `Set ${i + 1} afronden`} onClick={() => completeSet(i)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Set ${i + 1} verwijderen`} onClick={() => setSets(sets.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSets([...sets, { ...(sets[sets.length - 1] ?? { weight: "", reps: "" }), done: false }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Set toevoegen
            </Button>
          </div>
          {restSeconds > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-primary">Rustpauze</div>
                <div className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{restLabel}</div>
                <div className="text-[11px] text-muted-foreground">Even op adem komen voor je volgende set.</div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setRestSeconds(0)} aria-label="Rust overslaan">
                <SkipForward className="h-4 w-4 text-primary" />
              </Button>
            </div>
          )}
          {restSeconds === 0 && completed.length > 0 && <p className="text-center text-xs font-medium text-primary">Rust voorbij — klaar voor je volgende set.</p>}
          <Button type="submit" className="w-full" disabled={completed.length === 0 || saving}>
            {saving ? "Opslaan…" : `Sessie opslaan · ${completed.length} ${completed.length === 1 ? "set" : "sets"}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
