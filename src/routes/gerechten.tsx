import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChefHat, ExternalLink, X } from "lucide-react";
import { useDishes, useIngredients, type Dish, type DishItem, type Unit } from "@/lib/nutrition-store";
import { dishMacrosPerServing } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/gerechten")({
  head: () => ({ meta: [{ title: "Gerechten" }] }),
  component: GerechtenPage,
});

const UNITS: Unit[] = ["g", "ml", "stuk", "portie"];

function GerechtenPage() {
  const { items, upsert, remove, newId } = useDishes();
  const { items: ingredients } = useIngredients();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Dish | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name))
      .filter((d) => d.name.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Gerechten" subtitle="Jouw eigen gerechtenbibliotheek" />
      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-3">
        <Input placeholder="Zoek gerecht…" value={q} onChange={(e) => setQ(e.target.value)} />
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <ChefHat className="mb-2 h-7 w-7 text-primary" />
              <p className="text-sm font-medium">Nog geen gerechten</p>
              <p className="mt-1 text-xs text-muted-foreground">Tik op + om je eerste gerecht toe te voegen.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {filtered.map((d) => {
              const m = dishMacrosPerServing(d, ingredients);
              return (
                <Card key={d.id}>
                  <CardContent className="flex items-center gap-2 px-5 py-3.5">
                    <button onClick={() => setEditing(d)} className="flex-1 text-left">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(m.kcal)} kcal · {Math.round(m.protein)}P · {Math.round(m.carbs)}K · {Math.round(m.fat)}V
                        {" · "}per portie ({d.servings})
                      </div>
                    </button>
                    {d.recipeUrl && (
                      <a href={d.recipeUrl} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(d)} aria-label="Bewerken">
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id)} aria-label="Verwijderen">
                      <Trash2 className="h-4 w-4 text-primary" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </ul>
        )}
      </main>

      <button
        onClick={() => setCreating(true)}
        aria-label="Nieuw gerecht"
        className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {(editing || creating) && (
        <DishDialog
          initial={editing}
          ingredients={ingredients}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={(d) => { upsert(d); setEditing(null); setCreating(false); }}
          newId={newId}
        />
      )}
    </div>
  );
}

function DishDialog({
  initial, ingredients, onClose, onSave, newId,
}: {
  initial: Dish | null;
  ingredients: ReturnType<typeof useIngredients>["items"];
  onClose: () => void;
  onSave: (d: Dish) => void;
  newId: () => string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [servings, setServings] = useState(initial?.servings.toString() ?? "1");
  const [recipeUrl, setRecipeUrl] = useState(initial?.recipeUrl ?? "");
  const [steps, setSteps] = useState(initial?.steps ?? "");
  const [items, setItems] = useState<DishItem[]>(initial?.items ?? []);

  const macros = useMemo(() => {
    const sNum = Math.max(1, parseInt(servings) || 1);
    return dishMacrosPerServing({ id: "", name: "", servings: sNum, items }, ingredients);
  }, [items, servings, ingredients]);

  const addItem = () => setItems((p) => [...p, { ingredientId: ingredients[0]?.id ?? "", amount: 100, unit: "g" }]);
  const setItem = (i: number, patch: Partial<DishItem>) =>
    setItems((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      servings: Math.max(1, parseInt(servings) || 1),
      recipeUrl: recipeUrl.trim() || undefined,
      steps: steps.trim() || undefined,
      items,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Gerecht aanpassen" : "Nieuw gerecht"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="dname">Naam</Label>
              <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dserv">Porties</Label>
              <Input id="dserv" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ingrediënten</Label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={it.ingredientId} onValueChange={(v) => setItem(i, { ingredientId: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ingredients.map((ing) => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="w-20" inputMode="decimal" value={it.amount}
                    onChange={(e) => setItem(i, { amount: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
                  <Select value={it.unit} onValueChange={(v) => setItem(i, { unit: v as Unit })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                    <X className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> Ingrediënt toevoegen
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-secondary px-3 py-2 text-xs">
            <div className="font-medium">Per portie</div>
            <div className="text-muted-foreground">
              {Math.round(macros.kcal)} kcal · {Math.round(macros.protein)}P · {Math.round(macros.carbs)}K · {Math.round(macros.fat)}V
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="durl">Recept-URL (optioneel)</Label>
            <Input id="durl" type="url" value={recipeUrl} onChange={(e) => setRecipeUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsteps">Bereiding (optioneel)</Label>
            <Textarea id="dsteps" rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
