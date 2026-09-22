import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/profile-store";
import {
  friendSummary,
  sharedProgressPercent,
  useFriendDishes,
  useFriendStats,
  type ProfileRow,
  type SharedDishRow,
} from "@/lib/social";
import { useDishes, useIngredients } from "@/lib/nutrition-store";
import { sharedDishToLocal } from "@/lib/shared-recipes";
import { useFriendWorkouts, sportOf, workoutSummary, personalRecord } from "@/lib/workouts";
import { useFriendWorkoutPlans, useWorkoutPlans, type WorkoutPlan } from "@/lib/workout-plans";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/vriend/$id")({
  head: () => ({
    meta: [
      { title: "Vriend | Lichter" },
      { name: "description", content: "Bekijk de voortgang en de recepten van je vriend." },
      { property: "og:title", content: "Vriend | Lichter" },
      { property: "og:description", content: "Bekijk de voortgang en de recepten van je vriend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FriendPage,
});

function FriendPage() {
  const { id } = useParams({ from: "/vriend/$id" });
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const stats = useFriendStats([id]);
  const { dishes, loading } = useFriendDishes(id);
  const friendWorkouts = useFriendWorkouts([id]);
  const workouts = friendWorkouts[id] ?? [];
  const friendPlans = useFriendWorkoutPlans([id]);
  const plans = (friendPlans[id] ?? []).filter((p) => !p.source_owner);
  const [query, setQuery] = useState("");
  const filtered = dishes.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      setProfile((data as ProfileRow) ?? null);
    })();
  }, [id]);

  const s = stats[id];
  const summary = friendSummary(s, profile);
  const progress = profile?.share_progress === false ? null : sharedProgressPercent(s);

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title={profile?.display_name ?? "Vriend"} subtitle="Voortgang en recepten" back />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <img
              src={avatarSrc(profile?.avatar_id)}
              alt=""
              width={512}
              height={512}
              className="h-16 w-16 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {profile?.display_name ?? "Zonder naam"}
              </div>
              <div className="text-xs text-muted-foreground">{summary}</div>
            </div>
          </CardContent>
        </Card>

        {s && (s.current_weight != null || s.goal_weight != null || progress != null) && (
          <Card>
            <CardContent className="space-y-4 px-5 py-4 text-sm">
              {(s.current_weight != null || s.goal_weight != null) && (
                <div className="grid grid-cols-2 gap-3">
                  {s.current_weight != null && (
                    <Stat label="Huidig gewicht" value={`${s.current_weight.toFixed(1)} kg`} />
                  )}
                  {s.goal_weight != null && <Stat label="Doelgewicht" value={`${s.goal_weight.toFixed(1)} kg`} />}
                </div>
              )}
              {progress != null && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Vooruitgang naar doel</span>
                    <span className="text-xs font-medium tabular-nums text-primary">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {workouts.length > 0 && (
          <Card>
            <CardContent className="space-y-2 px-5 py-4">
              <div className="text-sm font-medium">Sportprestaties</div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {workouts.slice(0, 8).map((w) => {
                  const pr = personalRecord(w, workouts);
                  return (
                    <li key={w.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {sportOf(w.sport).label}
                          {pr && <span className="ml-1 text-xs text-primary">· record {pr.kind}</span>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{workoutSummary(w)}</div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(parseISO(w.date), "d MMM", { locale: nl })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 px-5 py-4">
            <div className="text-sm font-medium">Recepten</div>
            {dishes.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Zoek een recept…"
                  className="pl-9"
                />
              </div>
            )}
            {loading ? (
              <p className="text-xs text-muted-foreground">Laden…</p>
            ) : dishes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Deze vriend deelt (nog) geen recepten.</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground">Geen recept gevonden voor “{query}”.</p>
            ) : (
              filtered.map((d) => (
                <SharedDish key={d.id} dish={d} ownerName={profile?.display_name ?? "een vriend"} />
              ))
            )}
          </CardContent>
        </Card>
      </main>
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

function SharedDish({ dish, ownerName }: { dish: SharedDishRow; ownerName: string }) {
  const { items: myIngredients, upsert: upsertIngredient, newId: newIngId } = useIngredients();
  const { items: myDishes, upsert: upsertDish, newId: newDishId } = useDishes();
  const [open, setOpen] = useState(false);
  const already = myDishes.some(
    (d) => d.source?.ownerId === dish.owner_id && d.source?.localId === (dish.local_id ?? dish.id),
  );
  const [copied, setCopied] = useState(false);

  const copy = () => {
    upsertDish(
      sharedDishToLocal(dish, ownerName, { items: myIngredients, upsert: upsertIngredient, newId: newIngId }, {
        id: newDishId(),
      }),
    );
    setCopied(true);
  };

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{dish.name}</div>
          <div className="text-xs text-muted-foreground">
            {dish.items.length} ingrediënten · {dish.servings} porties
          </div>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {dish.items.map((it, i) => (
              <li key={i}>
                · {it.name} — {it.amount} {it.unit}
              </li>
            ))}
          </ul>
          {dish.steps?.length ? (
            <ol className="space-y-1 text-xs text-muted-foreground">
              {dish.steps.map((st, i) => (
                <li key={i}>
                  {i + 1}. {st}
                </li>
              ))}
            </ol>
          ) : null}
          {dish.recipe_url && (
            <a href={dish.recipe_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              Recept bekijken
            </a>
          )}
        </div>
      )}
      <div className="flex justify-end border-t border-border px-3 py-1.5">
        <Button size="sm" variant="ghost" onClick={copy} disabled={copied || already}>
          {copied || already ? (
            <Check className="mr-1 h-4 w-4 text-primary" />
          ) : (
            <Download className="mr-1 h-4 w-4 text-primary" />
          )}
          {copied || already ? "In jouw gerechten" : "Overnemen"}
        </Button>
      </div>
    </div>
  );
}
