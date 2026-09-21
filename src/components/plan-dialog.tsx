import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import type { PlanExercise, WorkoutPlan, WorkoutPlanInput } from "@/lib/workout-plans";

export function PlanDialog({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: WorkoutPlan | null;
  onClose: () => void;
  onSave: (input: WorkoutPlanInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [exercises, setExercises] = useState<PlanExercise[]>(initial?.exercises ?? [{ name: "", sets: 3, reps: 10 }]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detachOk, setDetachOk] = useState(false);

  const adopted = Boolean(initial?.source_name) && !detachOk;

  const update = (i: number, patch: Partial<PlanExercise>) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({
      id: initial?.id,
      name: name.trim(),
      exercises: exercises.filter((ex) => ex.name.trim()),
      detach: Boolean(initial?.source_name),
    });
  };

  if (adopted) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words">Schema aanpassen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dit schema komt van {initial?.source_name}. Als je het aanpast, wordt het jouw eigen schema. Latere
            wijzigingen van {initial?.source_name} worden dan niet meer overgenomen.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuleren
            </Button>
            <Button type="button" onClick={() => setDetachOk(true)}>
              Toch aanpassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="break-words">{initial ? "Schema aanpassen" : "Nieuw schema"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="min-w-0 space-y-2">
            <Label>Naam</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Bovenlichaam" />
          </div>

          <div className="space-y-3">
            <Label>Oefeningen</Label>
            {exercises.map((ex, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    className="min-w-0"
                    value={ex.name}
                    placeholder="Oefening"
                    onChange={(e) => update(i, { name: e.target.value })}
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
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="min-w-0"
                    inputMode="numeric"
                    placeholder="sets"
                    value={ex.sets?.toString() ?? ""}
                    onChange={(e) => update(i, { sets: Number(e.target.value) || undefined })}
                  />
                  <Input
                    className="min-w-0"
                    inputMode="numeric"
                    placeholder="reps"
                    value={ex.reps?.toString() ?? ""}
                    onChange={(e) => update(i, { reps: Number(e.target.value) || undefined })}
                  />
                </div>
                <Input
                  className="min-w-0"
                  placeholder="YouTube-link (optioneel)"
                  value={ex.youtube ?? ""}
                  onChange={(e) => update(i, { youtube: e.target.value || undefined })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => setExercises((prev) => [...prev, { name: "", sets: 3, reps: 10 }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Oefening toevoegen
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit">Opslaan</Button>
          </DialogFooter>

          {onDelete && initial && (
            <div className="border-t border-border pt-3">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Dit schema definitief verwijderen?</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      Annuleren
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => void onDelete()}>
                      Ja, verwijderen
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Schema verwijderen
                </Button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
