import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Target, TrendingDown, Scale, Settings as SettingsIcon } from "lucide-react";
import { useEntries, useSettings, type Entry } from "@/lib/weight-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gewichtsverlies tracker" },
      { name: "description", content: "Houd je gewicht en voortgang naar je doel bij." },
      { property: "og:title", content: "Gewichtsverlies tracker" },
      { property: "og:description", content: "Houd je gewicht en voortgang naar je doel bij." },
    ],
  }),
  component: Index,
});

function Index() {
  const { entries, addEntry, removeEntry } = useEntries();
  const { settings, setSettings } = useSettings();

  const sorted = entries;
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const start = settings.startWeight ?? first?.weight;
  const goal = settings.goalWeight;

  const totalLost = start && latest ? start - latest.weight : 0;
  const toGoal = goal && latest ? latest.weight - goal : 0;
  const progressPct =
    start && goal && latest && start !== goal
      ? Math.max(0, Math.min(100, ((start - latest.weight) / (start - goal)) * 100))
      : 0;

  const chartData = useMemo(
    () =>
      sorted.map((e) => ({
        date: e.date,
        label: format(parseISO(e.date), "d MMM", { locale: nl }),
        weight: e.weight,
      })),
    [sorted],
  );

  const unit = settings.unit;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Lichter</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Jouw gewichtsreis</p>
            </div>
          </div>
          <div className="flex gap-2">
            <SettingsDialog settings={settings} setSettings={setSettings} />
            <AddEntryDialog onAdd={addEntry} unit={unit} latest={latest?.weight} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Scale className="h-4 w-4" />}
            label="Huidig"
            value={latest ? `${latest.weight.toFixed(1)} ${unit}` : "—"}
            sub={latest ? format(parseISO(latest.date), "d MMM yyyy", { locale: nl }) : "Nog geen meting"}
          />
          <StatCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Verloren"
            value={start && latest ? `${totalLost.toFixed(1)} ${unit}` : "—"}
            sub={
              start && latest && first
                ? `In ${Math.max(1, differenceInDays(parseISO(latest.date), parseISO(first.date)))} dagen`
                : "Voeg metingen toe"
            }
            positive={totalLost > 0}
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Tot doel"
            value={goal && latest ? `${Math.max(0, toGoal).toFixed(1)} ${unit}` : "—"}
            sub={goal ? `Doel: ${goal} ${unit}` : "Stel een doel in"}
          />
        </section>

        {goal && start && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Voortgang</span>
                <span className="text-muted-foreground">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{start} {unit}</span>
                <span>{goal} {unit}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Verloop</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
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
                      formatter={(v: number) => [`${v} ${unit}`, "Gewicht"]}
                    />
                    {goal && (
                      <ReferenceLine
                        y={goal}
                        stroke="var(--accent)"
                        strokeDasharray="4 4"
                        label={{ value: `Doel ${goal}`, fontSize: 11, fill: "var(--muted-foreground)", position: "insideTopRight" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--primary)" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Metingen</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Nog geen metingen.</p>
            ) : (
              <ul className="divide-y divide-border">
                {[...sorted].reverse().map((e, i, arr) => {
                  const prev = arr[i + 1];
                  const diff = prev ? e.weight - prev.weight : 0;
                  return (
                    <li key={e.date} className="flex items-center gap-4 px-6 py-3.5">
                      <div className="flex-1">
                        <div className="font-medium tabular-nums">
                          {e.weight.toFixed(1)} <span className="text-sm text-muted-foreground">{unit}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(e.date), "EEEE d MMMM yyyy", { locale: nl })}
                          {e.note && ` · ${e.note}`}
                        </div>
                      </div>
                      {prev && (
                        <span
                          className={`text-xs tabular-nums font-medium ${
                            diff < 0 ? "text-success" : diff > 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toFixed(1)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEntry(e.date)}
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={`mt-2 text-3xl font-semibold tabular-nums ${
            positive ? "text-success" : ""
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Scale className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nog geen metingen</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Voeg je eerste meting toe om je voortgang te zien.
      </p>
    </div>
  );
}

function AddEntryDialog({
  onAdd,
  unit,
  latest,
}: {
  onAdd: (e: Entry) => void;
  unit: string;
  latest?: number;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight.replace(",", "."));
    if (!w || !date) return;
    onAdd({ date, weight: w, note: note.trim() || undefined });
    setOpen(false);
    setWeight("");
    setNote("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Meting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe meting</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Gewicht ({unit})</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={latest ? String(latest) : "bv. 78,5"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Notitie (optioneel)</Label>
            <Input
              id="note"
              placeholder="bv. na sport"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  settings,
  setSettings,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  setSettings: ReturnType<typeof useSettings>["setSettings"];
}) {
  const [open, setOpen] = useState(false);
  const [startW, setStartW] = useState(settings.startWeight?.toString() ?? "");
  const [goalW, setGoalW] = useState(settings.goalWeight?.toString() ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings({
      ...settings,
      startWeight: startW ? parseFloat(startW.replace(",", ".")) : undefined,
      goalWeight: goalW ? parseFloat(goalW.replace(",", ".")) : undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setStartW(settings.startWeight?.toString() ?? "");
          setGoalW(settings.goalWeight?.toString() ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Instellingen">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Doel & startgewicht</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="start">Startgewicht ({settings.unit})</Label>
            <Input
              id="start"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="bv. 85"
              value={startW}
              onChange={(e) => setStartW(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Doelgewicht ({settings.unit})</Label>
            <Input
              id="goal"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="bv. 72"
              value={goalW}
              onChange={(e) => setGoalW(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
