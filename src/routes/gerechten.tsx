import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Plus, Pencil, Trash2, ChefHat, ExternalLink, X, ChevronLeft, Sparkles } from "lucide-react";
import { formatUnit, useDishes, useIngredients, type Dish, type DishItem, type Meal } from "@/lib/nutrition-store";
import { dishMacrosPerServing } from "@/lib/nutrition-math";
import { suggestMacros } from "@/lib/ai.functions";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/gerechten")({
  head: () => ({ meta: [
    { title: "Gerechten | Lichter" },
    { name: "description", content: "Beheer gerechten, ingrediënten en bereidingsstappen." },
    { property: "og:title", content: "Gerechten | Lichter" },
    { property: "og:description", content: "Beheer gerechten, ingrediënten en bereidingsstappen." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GerechtenPage,
});


const MEALS: { id: Meal; label: string }[] = [
  { id: "ontbijt", label: "Ontbijt" },
  { id: "lunch", label: "Lunch" },
  { id: "diner", label: "Diner" },
  { id: "snack", label: "Snack" },
];

function GerechtenPage() {
  const { items, upsert, remove, newId } = useDishes();
  const { items: ingredients } = useIngredients();
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Dish | null>(null);
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
                  <CardContent className="flex items-center gap-1 px-5 py-3.5">
                    <button onClick={() => setViewing(d)} className="min-w-0 flex-1 text-left">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(m.kcal)} kcal · {Math.round(m.protein)}P · {Math.round(m.carbs)}K · {Math.round(m.fat)}V
                        {" · "}per portie ({d.servings})
                      </div>
                      {d.categories && d.categories.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.categories.map((c) => (
                            <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary">
                              {MEALS.find((m) => m.id === c)?.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    {d.recipeUrl && (
                      <a href={d.recipeUrl} target="_blank" rel="noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing(d)} aria-label="Bewerken">
                      <Pencil className="h-3.5 w-3.5 text-primary" />
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

      {viewing && !editing && !creating && (
        <DishDetailDialog
          dish={viewing}
          ingredients={ingredients}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); }}
          onDelete={() => { remove(viewing.id); setViewing(null); }}
        />
      )}

      {(editing || creating) && (
        <DishDialog
          initial={editing}
          ingredients={ingredients}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={(d) => { upsert(d); setEditing(null); setCreating(false); setViewing(null); }}
          newId={newId}
        />
      )}
    </div>
  );
}

function DishDetailDialog({
  dish, ingredients, onClose, onEdit, onDelete,
}: {
  dish: Dish;
  ingredients: ReturnType<typeof useIngredients>["items"];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const macros = dishMacrosPerServing(dish, ingredients);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="min-w-0 truncate">{dish.name}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onEdit} aria-label="Bewerken">
              <Pencil className="h-3.5 w-3.5 text-primary" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-secondary px-3 py-2 text-xs">
            <div className="font-medium">Per portie ({dish.servings} porties)</div>
            <div className="text-muted-foreground">
              {Math.round(macros.kcal)} kcal · {Math.round(macros.protein)}P · {Math.round(macros.carbs)}K · {Math.round(macros.fat)}V
            </div>
          </div>

          {dish.categories && dish.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dish.categories.map((c) => (
                <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary">
                  {MEALS.find((m) => m.id === c)?.label}
                </span>
              ))}
            </div>
          )}

          <div className={`space-y-1.5 ${dish.directMacros ? "hidden" : ""}`}>
            <div className="text-sm font-medium">Ingrediënten</div>
            {dish.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen ingrediënten.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {dish.items.map((it, i) => {
                  const ing = ingredients.find((x) => x.id === it.ingredientId);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{ing?.name ?? "—"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {it.amount} {formatUnit(it.unit, it.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {dish.steps && dish.steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Bereiding</div>
              <ol className="space-y-2">
                {dish.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {dish.recipeUrl && (
            <a href={dish.recipeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary">
              <ExternalLink className="h-4 w-4" /> Recept openen
            </a>
          )}

          <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1 h-4 w-4" /> Gerecht verwijderen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategorySelect({ value, onChange }: { value: Meal[]; onChange: (v: Meal[]) => void }) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0
    ? "Kies type maaltijd"
    : MEALS.filter((m) => value.includes(m.id)).map((m) => m.label).join(", ");
  const toggle = (id: Meal) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`h-9 w-full justify-between px-3 font-normal shadow-sm ${value.length === 0 ? "text-muted-foreground" : ""}`}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        {MEALS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            {m.label}
            {value.includes(m.id) && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
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
  const [steps, setSteps] = useState<string[]>(
    initial?.steps && initial.steps.length > 0 ? initial.steps : [""],
  );
  const [categories, setCategories] = useState<Meal[]>(initial?.categories ?? []);
  const [items, setItems] = useState<DishItem[]>(initial?.items ?? []);
  const [direct, setDirect] = useState(!!initial?.directMacros);
  const [dKcal, setDKcal] = useState(initial?.directMacros ? String(initial.directMacros.kcal) : "");
  const [dProt, setDProt] = useState(initial?.directMacros ? String(initial.directMacros.protein) : "");
  const [dCarb, setDCarb] = useState(initial?.directMacros ? String(initial.directMacros.carbs) : "");
  const [dFat, setDFat] = useState(initial?.directMacros ? String(initial.directMacros.fat) : "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

  const askAi = async () => {
    if (!name.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const s = await suggestMacros({ data: { name: name.trim(), baseUnit: "portie" } });
      setDKcal(String(s.kcal));
      setDProt(String(s.protein));
      setDCarb(String(s.carbs));
      setDFat(String(s.fat));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "De AI-schatting is niet gelukt.");
    } finally {
      setAiLoading(false);
    }
  };

  const macros = useMemo(() => {
    if (direct) return { kcal: num(dKcal), protein: num(dProt), carbs: num(dCarb), fat: num(dFat) };
    const sNum = Math.max(1, parseInt(servings) || 1);
    return dishMacrosPerServing({ id: "", name: "", servings: sNum, items }, ingredients);
  }, [items, servings, ingredients, direct, dKcal, dProt, dCarb, dFat]);

  const [picking, setPicking] = useState<number | "new" | null>(null);

  const chooseIngredient = (target: number | "new", ingId: string) => {
    const ing = ingredients.find((i) => i.id === ingId);
    if (!ing) return;
    const unit = ing.baseUnit;
    const amount = unit === "g" || unit === "ml" ? 100 : 1;
    if (target === "new") setItems((p) => [...p, { ingredientId: ingId, amount, unit }]);
    else setItems((p) => p.map((x, idx) => (idx === target ? { ingredientId: ingId, amount, unit } : x)));
    setPicking(null);
  };
  const setItem = (i: number, patch: Partial<DishItem>) =>
    setItems((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const addStep = () => setSteps((p) => [...p, ""]);
  const setStep = (i: number, v: string) => setSteps((p) => p.map((x, idx) => (idx === i ? v : x)));
  const removeStep = (i: number) => setSteps((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      servings: Math.max(1, parseInt(servings) || 1),
      recipeUrl: recipeUrl.trim() || undefined,
      steps: cleanedSteps.length > 0 ? cleanedSteps : undefined,
      categories: categories.length > 0 ? categories : undefined,
      items: direct ? [] : items,
      directMacros: direct
        ? { kcal: num(dKcal), protein: num(dProt), carbs: num(dCarb), fat: num(dFat) }
        : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto overflow-x-hidden">
        {picking !== null ? (
          <IngredientPicker
            ingredients={ingredients}
            onClose={() => setPicking(null)}
            onPick={(id) => chooseIngredient(picking, id)}
          />
        ) : (
          <>
          <DialogHeader><DialogTitle>{initial ? "Gerecht aanpassen" : "Nieuw gerecht"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-3">
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
            <Label>Type maaltijd</Label>
            <CategorySelect value={categories} onChange={setCategories} />
          </div>

          <div className="space-y-2">
            <Label>Ingrediënten</Label>
            <div className="space-y-2">
              {items.map((it, i) => {
                const ing = ingredients.find((x) => x.id === it.ingredientId);
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_58px_38px_24px] items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPicking(i)}
                      className="min-w-0 truncate rounded-md border border-input bg-background px-2.5 py-2 text-left text-sm hover:bg-accent"
                    >
                      {ing?.name ?? "Kies ingrediënt…"}
                    </button>
                    <Input className="w-full min-w-0 px-1.5 text-center" inputMode="decimal" value={it.amount}
                      onChange={(e) => setItem(i, { amount: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
                    <span className="truncate text-center text-[11px] text-muted-foreground">{formatUnit(it.unit, it.amount)}</span>
                    <button type="button" onClick={() => removeItem(i)} aria-label="Ingrediënt verwijderen" className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent">
                      <X className="h-3.5 w-3.5 text-primary" />
                    </button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => setPicking("new")} className="w-full">
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
            <Label>Bereiding</Label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary tabular-nums">
                    {i + 1}
                  </div>
                  <Input
                    value={s}
                    onChange={(e) => setStep(i, e.target.value)}
                    placeholder={`Stap ${i + 1}`}
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    aria-label="Stap verwijderen"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5 text-primary" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> Stap toevoegen
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
          </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function IngredientPicker({
  ingredients, onPick, onClose,
}: {
  ingredients: ReturnType<typeof useIngredients>["items"];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      [...ingredients]
        .sort((a, b) => a.name.localeCompare(b.name, "nl"))
        .filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())),
    [ingredients, q],
  );

  return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Terug">
              <ChevronLeft className="h-5 w-5 text-primary" />
            </Button>
            Ingrediënt kiezen
          </DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Zoek ingrediënt…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
          {list.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Geen resultaten</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((ing) => (
                <li key={ing.id}>
                  <button
                    type="button"
                    onClick={() => onPick(ing.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{ing.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      per {ing.baseUnit === "g" || ing.baseUnit === "ml" ? `100 ${ing.baseUnit}` : ing.baseUnit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );
}
