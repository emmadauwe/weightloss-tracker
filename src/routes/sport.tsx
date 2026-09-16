import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dumbbell, Plus, Pencil, Trash2, Trophy, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { DateField } from "@/components/date-field";
import {
  INTENSITIES,
  SPORTS,
  heaviestSet,
  personalRecord,
  sportOf,
  useWorkouts,
  workoutSummary,
  type Workout,
  type WorkoutExercise,
  type WorkoutInput,
} from "@/lib/workouts";

export const Route = createFileRoute("/sport")({
  head: () => ({
    meta: [
      { title: "Sport | Lichter" },
      { name: "description", content: "Houd je trainingen en prestaties bij per sport." },
      { property: "og:title", content: "Sport | Lichter" },
      { property: "og:description", content: "Houd je trainingen en prestaties bij per sport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SportPage,
});

function SportPage() {
  const { items, loading, save, remove } = useWorkouts();
  const [editing, setEditing] = useState<Workout | null>(null);
  const [creating, setCreating] = useState(false);

  const last30 = useMemo(() => {
    const from = format(subDays(new Date(), 29), "yyyy-MM-dd");
    return items.filter((w) => w.date >= from);
  }, [items]);

  const totalMinutes = last30.reduce((t, w) => t + (w.duration_min ?? 0), 0);
  const totalKm = last30.reduce((t, w) => t + (w.distance_km ?? 0), 0);

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Sport" subtitle="Trainingen en prestaties" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="grid grid-cols-3 gap-3 px-5 py-4">
            <Stat label="Sessies (30 d)" value={String(last30.length)} />
            <Stat label="Minuten" value={String(Math.round(totalMinutes))} />
            <Stat label="Kilometers" value={totalKm ? totalKm.toFixed(1) : "0"} />
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Training toevoegen
        </Button>

        {loading ? (
          <p className="px-1 text-xs text-muted-foreground">Laden…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Dumbbell className="mb-2 h-7 w-7 text-primary" />
              <p className="text-sm font-medium">Nog geen trainingen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Voeg je eerste sessie toe en volg je vooruitgang.
              </p>
            </CardContent>
          </Card>
        ) : (
          items.map((w) => {
            const pr = personalRecord(w, items);
            return (
              <Card key={w.id}>
                <CardContent className="flex items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{sportOf(w.sport).label}</span>
                      {pr && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Trophy className="h-3 w-3" /> Record {pr.kind}
                        </span>
                      )}
                    </div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {format(parseISO(w.date), "EEEE d MMM yyyy", { locale: nl })}
                    </div>
                    {workoutSummary(w) && (
                      <div className="mt-1 text-xs text-muted-foreground">{workoutSummary(w)}</div>
                    )}
                    {w.exercises?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {w.exercises.map((ex, i) => (
                          <li key={i}>
                            · {ex.name}:{" "}
                            {ex.sets.map((s, j) => `${s.weight ?? 0} kg × ${s.reps ?? 0}`).join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                    {w.note && <p className="mt-2 text-xs text-muted-foreground">{w.note}</p>}
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
      </main>

      {(creating || editing) && (
        <WorkoutDialog
          initial={editing}
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
    <div className="rounded-lg bg-secondary px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

function WorkoutDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: Workout | null;
  onClose: () => void;
  onSave: (input: WorkoutInput) => Promise<void>;
}) {
  const [sport, setSport] = useState(initial?.sport ?? "lopen");
  const [date, setDate] = useState<string | undefined>(initial?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState(initial?.duration_min?.toString() ?? "");
  const [distance, setDistance] = useState(initial?.distance_km?.toString() ?? "");
  const [maxSpeed, setMaxSpeed] = useState(initial?.max_speed?.toString() ?? "");
  const [intensity, setIntensity] = useState(initial?.intensity ?? "gemiddeld");
  const [note, setNote] = useState(initial?.note ?? "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initial?.exercises ?? []);

  const kind = sportOf(sport).kind;
  const dist = num(distance);
  const dur = num(duration);
  const avgSpeed = dist != null && dur != null && dur > 0 ? Number(((dist / dur) * 60).toFixed(2)) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    await onSave({
      id: initial?.id,
      date,
      sport,
      duration_min: dur,
      distance_km: kind === "cardio" ? dist : null,
      avg_speed: kind === "cardio" ? avgSpeed : null,
      max_speed: kind === "cardio" ? num(maxSpeed) : null,
      intensity,
      note: note.trim() || null,
      exercises: kind === "kracht" ? exercises.filter((ex) => ex.name.trim()) : [],
    });
  };

  const updateExercise = (i: number, patch: Partial<WorkoutExercise>) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{initial ? "Training aanpassen" : "Nieuwe training"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label>Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateField label="Datum" value={date} onChange={setDate} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label>Duur (min)</Label>
              <Input inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            {kind === "cardio" ? (
              <div className="min-w-0 space-y-2">
                <Label>Afstand (km)</Label>
                <Input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
              </div>
            ) : (
              <div className="min-w-0 space-y-2">
                <Label>Intensiteit</Label>
                <Select value={intensity} onValueChange={setIntensity}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITIES.map((i) => (
                      <SelectItem key={i} value={i} className="capitalize">
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {kind === "cardio" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label>Max. snelheid (km/u)</Label>
                <Input inputMode="decimal" value={maxSpeed} onChange={(e) => setMaxSpeed(e.target.value)} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Gem. snelheid</Label>
                <div className="flex h-9 items-center rounded-md bg-secondary px-3 text-sm tabular-nums">
                  {avgSpeed != null ? `${avgSpeed.toFixed(1)} km/u` : "—"}
                </div>
              </div>
            </div>
          )}

          {kind === "kracht" && (
            <div className="space-y-3">
              <Label>Oefeningen</Label>
              {exercises.map((ex, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ex.name}
                      placeholder="Oefening"
                      onChange={(e) => updateExercise(i, { name: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setExercises((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Oefening verwijderen"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {ex.sets.map((set, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">Set {j + 1}</span>
                      <Input
                        inputMode="decimal"
                        placeholder="kg"
                        value={set.weight?.toString() ?? ""}
                        onChange={(e) =>
                          updateExercise(i, {
                            sets: ex.sets.map((s, idx) =>
                              idx === j ? { ...s, weight: num(e.target.value) ?? undefined } : s,
                            ),
                          })
                        }
                      />
                      <Input
                        inputMode="numeric"
                        placeholder="reps"
                        value={set.reps?.toString() ?? ""}
                        onChange={(e) =>
                          updateExercise(i, {
                            sets: ex.sets.map((s, idx) =>
                              idx === j ? { ...s, reps: num(e.target.value) ?? undefined } : s,
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => updateExercise(i, { sets: ex.sets.filter((_, idx) => idx !== j) })}
                        aria-label="Set verwijderen"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => updateExercise(i, { sets: [...ex.sets, {}] })}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Set
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={() => setExercises((prev) => [...prev, { name: "", sets: [{}] }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Oefening toevoegen
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notitie</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
