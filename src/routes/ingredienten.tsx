import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Apple } from "lucide-react";
import { INGREDIENT_CATEGORIES, useIngredients, type Ingredient, type IngredientCategory, type Unit } from "@/lib/nutrition-store";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/ingredienten")({
  head: () => ({ meta: [
    { title: "Ingrediënten | Lichter" },
    { name: "description", content: "Beheer ingrediënten, voedingswaarden en winkeltypes." },
    { property: "og:title", content: "Ingrediënten | Lichter" },
    { property: "og:description", content: "Beheer ingrediënten, voedingswaarden en winkeltypes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IngredientenPage,
});

const UNITS: Unit[] = ["g", "ml", "stuk", "portie"];

function IngredientenPage() {
  const { items, upsert, remove, newId } = useIngredients();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((i) => i.name.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Ingrediënten" subtitle="Database met macro's per ingrediënt" />
      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-3">
        <Input placeholder="Zoek ingrediënt…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Apple className="mb-2 h-7 w-7 text-primary" />
                <p className="text-sm font-medium">Geen ingrediënten</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-5 py-3">
                    <div className="flex-1">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.kcal} kcal · {i.protein}P · {i.carbs}K · {i.fat}V
                        {" · "}
                        per {i.baseUnit === "g" || i.baseUnit === "ml" ? `100 ${i.baseUnit}` : i.baseUnit}
                      </div>
                      <div className="mt-0.5 text-[11px] capitalize text-primary">{i.category ?? "Nog geen type"}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(i)} aria-label="Bewerken">
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(i.id)} aria-label="Verwijderen">
                      <Trash2 className="h-4 w-4 text-primary" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <button
        onClick={() => setCreating(true)}
        aria-label="Nieuw ingrediënt"
        className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {(editing || creating) && (
        <IngredientDialog
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(ing) => {
            upsert(ing);
            setEditing(null);
            setCreating(false);
          }}
          newId={newId}
        />
      )}
    </div>
  );
}

function IngredientDialog({
  initial, onClose, onSave, newId,
}: {
  initial: Ingredient | null;
  onClose: () => void;
  onSave: (i: Ingredient) => void;
  newId: () => string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUnit, setBaseUnit] = useState<Unit>(initial?.baseUnit ?? "g");
  const [kcal, setKcal] = useState(initial?.kcal.toString() ?? "");
  const [protein, setProtein] = useState(initial?.protein.toString() ?? "");
  const [carbs, setCarbs] = useState(initial?.carbs.toString() ?? "");
  const [fat, setFat] = useState(initial?.fat.toString() ?? "");
  const [category, setCategory] = useState<IngredientCategory>(initial?.category ?? "groenten en fruit");

  const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      baseUnit,
      kcal: num(kcal),
      protein: num(protein),
      carbs: num(carbs),
      fat: num(fat),
      category,
    });
  };

  const perLabel = baseUnit === "g" || baseUnit === "ml" ? `per 100 ${baseUnit}` : `per 1 ${baseUnit}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Ingrediënt aanpassen" : "Nieuw ingrediënt"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="iname">Naam</Label>
            <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Basiseenheid</Label>
            <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as Unit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Waardes hieronder gelden {perLabel}.</p>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IngredientCategory)}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INGREDIENT_CATEGORIES.map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ikcal">Kcal</Label>
              <Input id="ikcal" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iprot">Eiwit (g)</Label>
              <Input id="iprot" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icarb">Koolhydraten (g)</Label>
              <Input id="icarb" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifat">Vet (g)</Label>
              <Input id="ifat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// re-export for typing if needed
export { IngredientDialog };
