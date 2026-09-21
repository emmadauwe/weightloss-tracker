import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { DateField } from "@/components/date-field";
import { INTENSITIES, SPORTS, sportOf, type Workout, type WorkoutExercise, type WorkoutInput } from "@/lib/workouts";
import type { WorkoutPlan } from "@/lib/workout-plans";

const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

export function WorkoutDialog({
  initial,
  fixedSport,
  sports,
  plans,
  onClose,
  onSave,
}: {
  initial: Workout | null;
  /** Sport ligt vast (detailpagina van één sport). */
  fixedSport?: string;
  /** Sporten waaruit je kunt kiezen. */
  sports?: string[];
  plans?: WorkoutPlan[];
  onClose: () => void;
  onSave: (input: WorkoutInput) => Promise<void>;
}) {
  const options = (sports?.length ? SPORTS.filter((s) => sports.includes(s.id)) : SPORTS);
  const [sport, setSport] = useState(initial?.sport ?? fixedSport ?? options[0]?.id ?? "lopen");
  const [date, setDate] = useState<string | undefined>(initial?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState(initial?.duration_min?.toString() ?? "");
  const [distance, setDistance] = useState(initial?.distance_km?.toString() ?? "");
  const [maxSpeed, setMaxSpeed] = useState(initial?.max_speed?.toString() ?? "");
  const [minSpeed, setMinSpeed] = useState(initial?.min_speed?.toString() ?? "");
  const [intensity, setIntensity] = useState(initial?.intensity ?? "gemiddeld");
  const [planId, setPlanId] = useState<string>(initial?.plan_id ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initial?.exercises ?? []);

  const kind = sportOf(sport).kind;
  const dist = num(distance);
  const dur = num(duration);
  const avgSpeed = dist != null && dur != null && dur > 0 ? Number(((dist / dur) * 60).toFixed(2)) : null;

  const applyPlan = (id: string) => {
    setPlanId(id);
    const plan = plans?.find((p) => p.id === id);
    if (!plan) return;
    setExercises(
      plan.exercises.map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: Math.max(1, ex.sets ?? 3) }, () => ({ reps: ex.reps })),
      })),
    );
  };

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
      min_speed: kind === "cardio" ? num(minSpeed) : null,
      plan_id: kind === "kracht" && planId ? planId : null,
      intensity,
      note: note.trim() || null,
      exercises: kind === "kracht" ? exercises.filter((ex) => ex.name.trim()) : [],
    });
  };

  const updateExercise = (i: number, patch: Partial<WorkoutExercise>) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="break-words">
            {initial ? "Training aanpassen" : `Nieuwe training${fixedSport ? ` · ${sportOf(fixedSport).label}` : ""}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!fixedSport && (
              <div className="min-w-0 space-y-2">
                <Label>Sport</Label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-2">
                  <Label>Max. snelheid (km/u)</Label>
                  <Input inputMode="decimal" value={maxSpeed} onChange={(e) => setMaxSpeed(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Min. snelheid (km/u)</Label>
                  <Input inputMode="decimal" value={minSpeed} onChange={(e) => setMinSpeed(e.target.value)} />
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Gem. snelheid</Label>
                <div className="flex h-9 items-center rounded-md bg-secondary px-3 text-sm tabular-nums">
                  {avgSpeed != null ? `${avgSpeed.toFixed(1)} km/u` : "—"}
                </div>
              </div>
            </>
          )}

          {kind === "kracht" && (
            <div className="space-y-3">
              {plans && plans.length > 0 && (
                <div className="min-w-0 space-y-2">
                  <Label>Schema</Label>
                  <Select value={planId || "geen"} onValueChange={(v) => (v === "geen" ? setPlanId("") : applyPlan(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Kies een schema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geen">Geen schema</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Label>Oefeningen</Label>
              {exercises.map((ex, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      className="min-w-0"
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
                        className="min-w-0"
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
                        className="min-w-0"
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
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-w-0" />
          </div>

          <DialogFooter>
            <Button type="submit">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
