import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays, startOfWeek } from "date-fns";
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
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Trash2,
  Plus,
  Scale,
  Settings as SettingsIcon,
  History,
  LayoutDashboard,
  TrendingDown,
} from "lucide-react";
import { useEntries, useSettings, type Entry } from "@/lib/weight-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gewichtstracker" },
      { name: "description", content: "Houd je gewicht en voortgang naar je doel bij." },
      { property: "og:title", content: "Gewichtstracker" },
      { property: "og:description", content: "Houd je gewicht en voortgang naar je doel bij." },
    ],
  }),
  component: Index,
});

function Index() {
  const { entries, addEntry, removeEntry, updateEntry } = useEntries();
  const { settings, setSettings } = useSettings();
  const [tab, setTab] = useState<"dashboard" | "history">("dashboard");

  const sorted = entries;
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const start = settings.startWeight ?? first?.weight;
  const goal = settings.goalWeight;
  const unit = settings.unit;

  const totalLost = start && latest ? start - latest.weight : 0;
  const toGoal = goal && latest ? Math.max(0, latest.weight - goal) : 0;
  const progressPct =
    start && goal && latest && start !== goal
      ? Math.max(0, Math.min(100, ((start - latest.weight) / (start - goal)) * 100))
      : 0;

  // BMI
  const bmi = settings.heightCm && latest
    ? (unit === "lb" ? latest.weight * 0.453592 : latest.weight) /
      Math.pow(settings.heightCm / 100, 2)
    : null;
  const bmiCat = bmi ? bmiCategory(bmi) : null;

  // Dagen over
  const daysLeft = settings.endDate
    ? Math.max(0, differenceInDays(parseISO(settings.endDate), new Date()))
    : null;

  // Deze week verschil
  const thisWeekDiff = useMemo(() => {
    if (sorted.length < 2) return null;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const before = [...sorted].reverse().find((e) => parseISO(e.date) < weekStart);
    if (!before || !latest) return null;
    return latest.weight - before.weight;
  }, [sorted, latest]);

  const chartData = useMemo(
    () =>
      sorted.map((e) => ({
        date: e.date,
        label: format(parseISO(e.date), "d MMM", { locale: nl }),
        weight: e.weight,
      })),
    [sorted],
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Gewichtstracker
            </h1>
          </div>
          <SettingsDialog settings={settings} setSettings={setSettings} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5">
        {tab === "dashboard" ? (
          <div className="space-y-3">
            {/* Hero */}
            <div className="rounded-2xl bg-secondary px-5 py-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Huidig gewicht</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span
                      className="text-5xl font-semibold tabular-nums text-primary"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {latest ? latest.weight.toFixed(1) : "—"}
                    </span>
                    <span className="text-base text-muted-foreground">{unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-muted-foreground">Afgevallen</div>
                  <div className="mt-2 flex items-baseline justify-end gap-1.5">
                    <span
                      className={`text-3xl font-semibold tabular-nums ${
                        totalLost > 0 ? "text-success" : "text-foreground"
                      }`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {totalLost > 0 ? "-" : ""}
                      {Math.abs(totalLost).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{unit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voortgang naar doel */}
            {start && goal && (
              <Card>
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Voortgang naar doel</span>
                    <span className="text-sm font-medium text-primary tabular-nums">
                      {progressPct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{start} {unit}</span>
                    <span>{goal} {unit} doel</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Nog te gaan"
                value={goal && latest ? `${toGoal.toFixed(1)} ${unit}` : "—"}
              />
              <MiniStat
                label="Dagen over"
                value={daysLeft !== null ? `${daysLeft} d` : "—"}
              />
              <MiniStat
                label="BMI"
                value={bmi ? bmi.toFixed(1) : "—"}
                sub={bmiCat?.label}
                subColor={bmiCat?.color}
              />
              <MiniStat
                label="Deze week"
                value={
                  thisWeekDiff === null
                    ? "—"
                    : `${thisWeekDiff > 0 ? "+" : ""}${thisWeekDiff.toFixed(1)} ${unit}`
                }
                valueColor={
                  thisWeekDiff === null
                    ? undefined
                    : thisWeekDiff < 0
                      ? "var(--success)"
                      : thisWeekDiff > 0
                        ? "var(--destructive)"
                        : undefined
                }
              />
            </div>

            {/* Gewichtsverloop */}
            <Card>
              <CardContent className="px-5 py-4">
                <div className="mb-3 text-sm font-medium">Gewichtsverloop</div>
                {chartData.length < 2 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingDown className="mb-2 h-7 w-7 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      Voeg 2+ metingen toe voor de grafiek
                    </p>
                  </div>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="label"
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
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
                            stroke="#97b185"
                            strokeOpacity={0.45}
                            strokeDasharray="5 5"
                            label={{
                              value: `Doel ${goal}`,
                              position: "insideTopRight",
                              fill: "var(--muted-foreground)",
                              fontSize: 10,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deadline status (kept) */}
            {settings.startDate && settings.endDate && start && goal && latest && (
              <DeadlineCard
                startDate={settings.startDate}
                endDate={settings.endDate}
                start={start}
                goal={goal}
                currentWeight={latest.weight}
                unit={unit}
              />
            )}
          </div>
        ) : (
          <HistoryView sorted={sorted} unit={unit} onRemove={removeEntry} />
        )}
      </main>

      {/* Floating add button */}
      <AddEntryDialog onAdd={addEntry} unit={unit} latest={latest?.weight} />

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-6 py-2.5">
          <TabButton
            active={tab === "dashboard"}
            onClick={() => setTab("dashboard")}
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Dashboard"
          />
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
            icon={<History className="h-5 w-5" />}
            label="Geschiedenis"
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1 text-xs transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function MiniStat({
  label, value, sub, subColor, valueColor,
}: {
  label: string; value: string; sub?: string; subColor?: string; valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className="mt-1.5 text-2xl font-semibold tabular-nums"
          style={{ fontFamily: "var(--font-display)", color: valueColor }}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs font-medium" style={{ color: subColor }}>
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryView({
  sorted, unit, onRemove,
}: { sorted: Entry[]; unit: string; onRemove: (d: string) => void }) {
  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nog geen metingen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tik op + om je eerste meting toe te voegen.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {[...sorted].reverse().map((e, i, arr) => {
            const prev = arr[i + 1];
            const diff = prev ? e.weight - prev.weight : 0;
            return (
              <li key={e.date} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <div className="font-medium tabular-nums">
                    {e.weight.toFixed(1)}{" "}
                    <span className="text-sm text-muted-foreground">{unit}</span>
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
                <Button variant="ghost" size="icon" onClick={() => onRemove(e.date)} aria-label="Verwijderen">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function AddEntryDialog({
  onAdd, unit, latest,
}: { onAdd: (e: Entry) => void; unit: string; latest?: number }) {
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
        <button
          aria-label="Nieuwe meting"
          className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe meting</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
            <Input id="note" placeholder="bv. na sport" value={note} onChange={(e) => setNote(e.target.value)} />
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
  settings, setSettings,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  setSettings: ReturnType<typeof useSettings>["setSettings"];
}) {
  const [open, setOpen] = useState(false);
  const [startW, setStartW] = useState(settings.startWeight?.toString() ?? "");
  const [goalW, setGoalW] = useState(settings.goalWeight?.toString() ?? "");
  const [height, setHeight] = useState(settings.heightCm?.toString() ?? "");
  const [startDate, setStartDate] = useState(settings.startDate ?? "");
  const [endDate, setEndDate] = useState(settings.endDate ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings({
      ...settings,
      startWeight: startW ? parseFloat(startW.replace(",", ".")) : undefined,
      goalWeight: goalW ? parseFloat(goalW.replace(",", ".")) : undefined,
      heightCm: height ? parseFloat(height.replace(",", ".")) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
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
          setHeight(settings.heightCm?.toString() ?? "");
          setStartDate(settings.startDate ?? "");
          setEndDate(settings.endDate ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Instellingen">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jouw doel</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start ({settings.unit})</Label>
              <Input id="start" type="number" step="0.1" inputMode="decimal" placeholder="85"
                value={startW} onChange={(e) => setStartW(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Doel ({settings.unit})</Label>
              <Input id="goal" type="number" step="0.1" inputMode="decimal" placeholder="72"
                value={goalW} onChange={(e) => setGoalW(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Lengte (cm)</Label>
            <Input id="height" type="number" step="1" inputMode="decimal" placeholder="bv. 175"
              value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sdate">Startdag</Label>
              <Input id="sdate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edate">Einddag</Label>
              <Input id="edate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Ondergewicht", color: "var(--accent)" };
  if (bmi < 25) return { label: "Gezond", color: "var(--success)" };
  if (bmi < 30) return { label: "Overgewicht", color: "var(--accent)" };
  return { label: "Obesitas", color: "var(--destructive)" };
}

function DeadlineCard({
  startDate, endDate, start, goal, currentWeight, unit,
}: {
  startDate: string; endDate: string; start: number; goal: number; currentWeight: number; unit: string;
}) {
  const today = new Date();
  const end = parseISO(endDate);
  const begin = parseISO(startDate);
  const totalDays = Math.max(1, differenceInDays(end, begin));
  const daysLeft = differenceInDays(end, today);
  const daysPassed = Math.max(0, differenceInDays(today, begin));
  const toLose = currentWeight - goal;
  const totalToLose = start - goal;

  const recPerWeek = 0.5;
  const requiredPerWeek = daysLeft > 0 ? (toLose / daysLeft) * 7 : Infinity;
  const isHealthy = requiredPerWeek <= recPerWeek && requiredPerWeek >= 0;
  const recommendedDays = totalToLose > 0 ? Math.ceil((totalToLose / recPerWeek) * 7) : 0;

  let status: { label: string; color: string; msg: string };
  if (toLose <= 0) {
    status = { label: "Doel bereikt", color: "var(--success)", msg: "Geweldig! Je hebt je doel gehaald." };
  } else if (daysLeft <= 0) {
    status = { label: "Deadline verstreken", color: "var(--destructive)", msg: "Stel een nieuwe einddag in." };
  } else if (isHealthy) {
    status = {
      label: "Gezond tempo",
      color: "var(--success)",
      msg: `Je hoeft maar ${requiredPerWeek.toFixed(2)} ${unit}/week te verliezen.`,
    };
  } else {
    status = {
      label: "Te ambitieus",
      color: "var(--destructive)",
      msg: `Dat vraagt ${requiredPerWeek.toFixed(2)} ${unit}/week. Aanbevolen: max 0,5 ${unit}/week (≈ ${recommendedDays} dagen totaal).`,
    };
  }

  const progressPct = Math.max(0, Math.min(100, (daysPassed / totalDays) * 100));

  return (
    <Card>
      <CardContent className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tijdlijn</span>
          <span className="text-sm font-medium" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(begin, "d MMM", { locale: nl })}</span>
          <span>{format(end, "d MMM yyyy", { locale: nl })}</span>
        </div>
        <p className="text-sm text-muted-foreground">{status.msg}</p>
      </CardContent>
    </Card>
  );
}
