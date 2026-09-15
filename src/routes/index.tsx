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
  TrendingDown,
  Pencil,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { useEntries, useSettings, type Entry } from "@/lib/weight-store";
import { useGoal } from "@/lib/goal-store";
import { AppHeader } from "@/components/app-header";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gewichtstracker" },
      { name: "description", content: "Houd je gewicht en voortgang naar je doel bij." },
      { property: "og:title", content: "Gewichtstracker" },
      { property: "og:description", content: "Houd je gewicht en voortgang naar je doel bij." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { entries, addEntry, removeEntry, updateEntry } = useEntries();
  const { settings } = useSettings();
  const { goal: goalSettings } = useGoal();
  const [tab, setTab] = useState<"dashboard" | "history">("dashboard");
  const [showBmi, setShowBmi] = useState(false);

  const sorted = entries;
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const start = settings.startWeight ?? first?.weight;
  const goal = settings.goalWeight;
  const unit = settings.unit;

  const firstWeight = first?.weight ?? settings.startWeight;
  const weightChange = firstWeight && latest ? latest.weight - firstWeight : 0;
  const toGoal = goal && latest ? Math.abs(latest.weight - goal) : 0;
  const changeMatchesGoal = weightChange !== 0 && (
    goalSettings.type === "afvallen"
      ? weightChange < 0
      : goalSettings.type === "bijkomen" || goalSettings.type === "spiermassa"
        ? weightChange > 0
        : Math.abs(weightChange) <= 0.2
  );
  const changeIsUnhealthy = weightChange !== 0 && !changeMatchesGoal;
  /** Is een verandering goed (groen) of slecht (rood) gezien het gekozen doel? */
  const diffIsGood = (diff: number) => diffMatchesGoal(diff, goalSettings.type);
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
    <div className="min-h-screen bg-background pb-36">
      <AppHeader title="Gewichtstracker" subtitle="Metingen en voortgang" />


      <main className="mx-auto max-w-2xl px-4 pt-5">
        {tab === "dashboard" ? (
          <div className="space-y-3">
            {/* Hero */}
            <div className={`rounded-2xl px-5 py-5 shadow-sm ${changeIsUnhealthy ? "bg-destructive-soft" : "bg-secondary"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-foreground">Huidig gewicht</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span
                      className="text-5xl font-semibold tabular-nums text-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {latest ? latest.weight.toFixed(1) : "—"}
                    </span>
                    <span className="text-base text-muted-foreground">{unit}</span>
                  </div>
                </div>
                <div className="py-2 text-right">
                   <div className={`text-xs font-medium ${changeIsUnhealthy ? "text-destructive" : weightChange !== 0 ? "text-success" : "text-muted-foreground"}`}>
                     {weightChange > 0 ? "Bijgekomen" : weightChange < 0 ? "Afgevallen" : "Verandering"}
                   </div>
                  <div className="mt-2 flex items-baseline justify-end gap-1.5">
                    <span
                      className={`text-3xl font-semibold tabular-nums ${
                          changeIsUnhealthy ? "text-destructive" : weightChange !== 0 ? "text-success" : "text-foreground"
                      }`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                       {weightChange > 0 ? "+" : weightChange < 0 ? "-" : ""}
                       {Math.abs(weightChange).toFixed(1)}
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
                value={goal && latest ? toGoal.toFixed(1) : "—"}
                unit={goal && latest ? unit : undefined}
              />
              <MiniStat
                label="Dagen over"
                value={daysLeft !== null ? String(daysLeft) : "—"}
                unit={daysLeft !== null ? "dagen" : undefined}
              />
              <MiniStat
                label="BMI"
                value={bmi ? bmi.toFixed(1) : "—"}
                sub={bmiCat?.label}
                subColor={bmiCat?.color}
                onClick={bmi ? () => setShowBmi(true) : undefined}
              />
              <MiniStat
                label="Deze week"
                value={
                  thisWeekDiff === null
                    ? "—"
                    : `${thisWeekDiff > 0 ? "+" : ""}${thisWeekDiff.toFixed(1)}`
                }
                unit={thisWeekDiff === null ? undefined : unit}
                valueColor={
                  thisWeekDiff === null || thisWeekDiff === 0
                    ? undefined
                    : diffIsGood(thisWeekDiff)
                      ? "var(--success)"
                      : "var(--destructive)"
                }
                onClick={() => setTab("history")}
              />
            </div>



            {/* Gewichtsverloop */}
            <Card>
              <CardContent className="px-5 py-4">
                <div className="mb-3 text-sm font-medium">Gewichtsverloop</div>
                {chartData.length < 2 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingDown className="mb-2 h-7 w-7 text-primary" />
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
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setTab("dashboard")}>
              <ChevronLeft className="h-4 w-4 text-primary" /> Terug naar overzicht
            </Button>
            <HistoryView sorted={sorted} unit={unit} onRemove={removeEntry} onUpdate={updateEntry} diffIsGood={diffIsGood} />
          </div>
        )}
      </main>

      {/* Floating add button */}
      <AddEntryDialog onAdd={addEntry} unit={unit} latest={latest?.weight} />

      <BmiDialog open={showBmi} onOpenChange={setShowBmi} bmi={bmi} heightCm={settings.heightCm} unit={unit} />

    </div>
  );
}

function MiniStat({
  label, value, unit, sub, subColor, valueColor, onClick,
}: {
  label: string; value: string; unit?: string; sub?: string; subColor?: string; valueColor?: string; onClick?: () => void;
}) {
  const content = (
      <CardContent className="px-4 py-3.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1.5 flex items-baseline gap-1" style={{ color: valueColor }}>
          <span className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs font-medium" style={{ color: subColor }}>
            {sub}
          </div>
        )}
      </CardContent>
  );
  return <Card className={onClick ? "transition-colors hover:bg-accent/40" : undefined}>{onClick ? <button type="button" className="w-full text-left" onClick={onClick}>{content}</button> : content}</Card>;
}

function BmiDialog({
  open, onOpenChange, bmi, heightCm, unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bmi: number | null;
  heightCm?: number;
  unit: string;
}) {
  const position = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100)) : 0;
  // Gewicht dat hoort bij een BMI-grens, in de gekozen eenheid.
  const weightAt = (value: number) => {
    if (!heightCm) return null;
    const kg = value * Math.pow(heightCm / 100, 2);
    return unit === "lb" ? kg / 0.453592 : kg;
  };
  const bounds = [
    { bmi: 18.5, left: 14 },
    { bmi: 25, left: 40 },
    { bmi: 30, left: 60 },
  ];
  const segments = [
    { label: "Ondergewicht", left: 0, width: 14, color: "text-destructive" },
    { label: "Gezond", left: 14, width: 26, color: "text-success" },
    { label: "Overgewicht", left: 40, width: 20, color: "text-destructive" },
    { label: "Obesitas", left: 60, width: 40, color: "text-destructive-strong" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>BMI-schaal</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-4xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{bmi?.toFixed(1)}</span>
            <div className="text-sm font-medium" style={{ color: bmi ? bmiCategory(bmi).color : undefined }}>{bmi ? bmiCategory(bmi).label : "—"}</div>
          </div>

          <div className="relative pt-5">
            <div className="flex h-3 overflow-hidden rounded-full">
              <div className="w-[14%] bg-destructive/70" />
              <div className="w-[26%] bg-success" />
              <div className="w-[20%] bg-destructive" />
              <div className="w-[40%] bg-destructive-strong" />
            </div>
            {bmi && (
              <div
                className="absolute top-0 -translate-x-1/2 text-sm leading-none"
                style={{ left: `${position}%`, color: "var(--icon-hover, #C9C0B7)" }}
                aria-hidden
              >
                ▼
              </div>
            )}

            {/* Grenswaarden onder de balk */}
            <div className="relative mt-1 h-8">
              {bounds.map((bound) => {
                const weight = weightAt(bound.bmi);
                return (
                  <div
                    key={bound.bmi}
                    className="absolute -translate-x-1/2 text-center text-[10px] leading-tight text-muted-foreground"
                    style={{ left: `${bound.left}%` }}
                  >
                    <div className="tabular-nums">{String(bound.bmi).replace(".", ",")}</div>
                    {weight !== null && <div className="tabular-nums">{weight.toFixed(0)} {unit}</div>}
                  </div>
                );
              })}
            </div>

            {/* Namen van de zones */}
            <div className="relative mt-1 h-7">
              {segments.map((segment) => (
                <div
                  key={segment.label}
                  className={`absolute px-0.5 text-center text-[10px] leading-tight ${segment.color}`}
                  style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                >
                  {segment.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryView({
  sorted, unit, onRemove, onUpdate, diffIsGood,
}: { sorted: Entry[]; unit: string; onRemove: (d: string) => void; onUpdate: (originalDate: string, e: Entry) => void; diffIsGood: (diff: number) => boolean }) {
  const [editing, setEditing] = useState<Entry | null>(null);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="mb-3 h-8 w-8 text-primary" />
          <p className="text-sm font-medium">Nog geen metingen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tik op + om je eerste meting toe te voegen.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {[...sorted].reverse().map((e, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? e.weight - prev.weight : 0;
              return (
                <li key={e.date} className="flex items-center gap-2 px-5 py-3.5">
                  <button
                    onClick={() => setEditing(e)}
                    className="flex-1 text-left"
                    aria-label="Bewerken"
                  >
                    <div className="font-medium tabular-nums">
                      {e.weight.toFixed(1)}{" "}
                      <span className="text-sm text-muted-foreground">{unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(e.date), "EEEE d MMMM yyyy", { locale: nl })}
                      {e.note && ` · ${e.note}`}
                    </div>
                  </button>
                  {prev && (
                    <span
                      className={`text-xs tabular-nums font-medium ${
                        diff === 0 ? "text-muted-foreground" : diffIsGood(diff) ? "text-success" : "text-destructive"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(1)}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setEditing(e)} aria-label="Bewerken">
                    <Pencil className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(e.date)} aria-label="Verwijderen">
                    <Trash2 className="h-4 w-4 text-primary" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      {editing && (
        <EditEntryDialog
          entry={editing}
          unit={unit}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            onUpdate(editing.date, updated);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EditEntryDialog({
  entry, unit, onClose, onSave,
}: { entry: Entry; unit: string; onClose: () => void; onSave: (e: Entry) => void }) {
  const [date, setDate] = useState(entry.date);
  const [weight, setWeight] = useState(entry.weight.toString());
  const [note, setNote] = useState(entry.note ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight.replace(",", "."));
    if (!w || !date) return;
    onSave({ date, weight: w, note: note.trim() || undefined });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meting aanpassen</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edate">Datum</Label>
            <Input id="edate" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eweight">Gewicht ({unit})</Label>
            <Input id="eweight" type="number" step="0.1" inputMode="decimal"
              value={weight} onChange={(e) => setWeight(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enote">Notitie (optioneel)</Label>
            <Input id="enote" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Opslaan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

/** Kleurt een gewichtsverandering goed of slecht, afhankelijk van het doel. */
function diffMatchesGoal(diff: number, goalType: string | undefined): boolean {
  if (goalType === "bijkomen" || goalType === "spiermassa") return diff > 0;
  if (goalType === "afvallen") return diff < 0;
  return Math.abs(diff) <= 0.2;
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Ondergewicht", color: "var(--destructive)" };
  if (bmi < 25) return { label: "Gezond", color: "var(--success)" };
  if (bmi < 30) return { label: "Overgewicht", color: "var(--destructive)" };
  return { label: "Obesitas", color: "var(--destructive-strong)" };
}

function DeadlineCard({
  startDate, endDate, start, goal, currentWeight, unit,
}: {
  startDate: string; endDate: string; start: number; goal: number; currentWeight: number; unit: string;
}) {
  const today = new Date();
  const end = parseISO(endDate);
  const daysLeft = differenceInDays(end, today);
  const toLose = currentWeight - goal;
  const totalToLose = start - goal;

  const recPerWeek = 0.5;
  const requiredPerWeek = daysLeft > 0 ? (toLose / daysLeft) * 7 : Infinity;
  const isHealthy = requiredPerWeek <= recPerWeek;
  const recommendedDays = totalToLose > 0 ? Math.ceil((totalToLose / recPerWeek) * 7) : 0;

  if (toLose <= 0) return null;
  if (daysLeft > 0 && isHealthy) return null;

  const isExpired = daysLeft <= 0;
  const title = isExpired ? "Deadline verstreken" : "Te ambitieus tempo";
  const msg = isExpired
    ? "Je einddag is voorbij. Stel een nieuwe deadline in."
    : `Om je doel te halen moet je ${requiredPerWeek.toFixed(2)} ${unit} per week verliezen. Aanbevolen is max 0,5 ${unit}/week (≈ ${recommendedDays} dagen totaal).`;

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex gap-3 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-destructive">{title}</div>
          <p className="text-sm text-muted-foreground">{msg}</p>
        </div>
      </CardContent>
    </Card>
  );
}

