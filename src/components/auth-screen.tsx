import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_GOAL, GOAL_KEY, type GoalSettings } from "@/lib/goal-store";
import type { GoalType, Lifestyle, Sex } from "@/lib/nutrition-math";
import type { Settings } from "@/lib/weight-store";

const GOAL_TYPES: { v: GoalType; label: string }[] = [
  { v: "afvallen", label: "Afvallen" },
  { v: "behouden", label: "Op gewicht" },
  { v: "bijkomen", label: "Bijkomen" },
  { v: "spiermassa", label: "Spiermassa" },
];

const LIFESTYLES: { v: Lifestyle; label: string }[] = [
  { v: "zittend", label: "Zittend" },
  { v: "licht_actief", label: "Licht actief" },
  { v: "actief", label: "Actief" },
  { v: "zeer_actief", label: "Zeer actief" },
];

function num(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showGoal, setShowGoal] = useState(false);

  // optional onboarding
  const [type, setType] = useState<GoalType>("afvallen");
  const [sex, setSex] = useState<Sex>("v");
  const [age, setAge] = useState("");
  const [lifestyle, setLifestyle] = useState<Lifestyle>("zittend");
  const [height, setHeight] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function stashOnboarding() {
    if (typeof window === "undefined") return;
    const goal: GoalSettings = {
      ...DEFAULT_GOAL,
      type,
      sex,
      ...(num(age) !== undefined ? { age: num(age) } : {}),
      lifestyle,
    };
    const settings: Settings = {
      unit: "kg",
      ...(num(height) !== undefined ? { heightCm: num(height) } : {}),
      ...(num(startWeight) !== undefined ? { startWeight: num(startWeight) } : {}),
      ...(num(goalWeight) !== undefined ? { goalWeight: num(goalWeight) } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
    localStorage.setItem("weight-settings-v1", JSON.stringify(settings));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "up") {
        stashOnboarding();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setMsg("Bijna klaar! Bevestig je e-mailadres via de link in je mailbox.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    if (mode === "up") stashOnboarding();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setErr("Inloggen met Google lukte niet.");
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Gewichtstracker
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maak een account zodat je gegevens bewaard blijven op al je toestellen.
        </p>

        <div className="mt-6 flex rounded-xl bg-muted p-1">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "in" ? "Inloggen" : "Account maken"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "up" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <button
                type="button"
                onClick={() => setShowGoal((s) => !s)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium">Je doel instellen (optioneel)</span>
                <span className="text-xs text-primary">{showGoal ? "Verbergen" : "Tonen"}</span>
              </button>

              {showGoal && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Doel</Label>
                    <div className="flex flex-wrap gap-2">
                      {GOAL_TYPES.map((g) => (
                        <button
                          key={g.v}
                          type="button"
                          onClick={() => setType(g.v)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            type === g.v
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Dagelijks leven</Label>
                    <div className="flex flex-wrap gap-2">
                      {LIFESTYLES.map((l) => (
                        <button
                          key={l.v}
                          type="button"
                          onClick={() => setLifestyle(l.v)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            lifestyle === l.v
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="age">Leeftijd</Label>
                      <Input id="age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Geslacht</Label>
                      <div className="flex gap-2">
                        {(["v", "m"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSex(s)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                              sex === s
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground"
                            }`}
                          >
                            {s === "v" ? "Vrouw" : "Man"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="len">Lengte (cm)</Label>
                      <Input id="len" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sw">Startgewicht (kg)</Label>
                      <Input
                        id="sw"
                        inputMode="decimal"
                        value={startWeight}
                        onChange={(e) => setStartWeight(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gw">Doelgewicht (kg)</Label>
                      <Input
                        id="gw"
                        inputMode="decimal"
                        value={goalWeight}
                        onChange={(e) => setGoalWeight(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sd">Startdag</Label>
                      <Input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ed">Einddag</Label>
                      <Input id="ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
          {msg && <p className="text-sm text-primary">{msg}</p>}

          <Button type="submit" disabled={busy} className="w-full">
            {mode === "in" ? "Inloggen" : "Account maken"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          of
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={google}>
          Doorgaan met Google
        </Button>
      </div>
    </div>
  );
}
