import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, CalendarIcon, Camera, LogOut, RotateCcw } from "lucide-react";
import { useGoalTargets } from "@/lib/goal-targets";
import { AVATAR_CHOICES, avatarSrc, useProfile } from "@/lib/profile-store";
import { useAuth, signOut } from "@/lib/auth";
import type { GoalType, Intensity, Lifestyle, Sex } from "@/lib/nutrition-math";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "Account | Lichter" },
    { name: "description", content: "Beheer je profiel, je doel en je persoonlijke macro's." },
    { property: "og:title", content: "Account | Lichter" },
    { property: "og:description", content: "Beheer je profiel, je doel en je persoonlijke macro's." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountPage,
});

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: "afvallen", label: "Afvallen" },
  { id: "behouden", label: "Op gewicht" },
  { id: "bijkomen", label: "Bijkomen" },
  { id: "spiermassa", label: "Spiermassa" },
];

async function fileToAvatar(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = dataUrl;
  });
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  const side = Math.min(image.width, image.height);
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function AccountPage() {
  const { goal, setGoal, settings, setSettings, calc } = useGoalTargets();
  const { profile, setProfile } = useProfile();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const active = {
    kcal: goal.overrideKcal ?? calc?.kcal,
    protein: goal.overrideProtein ?? calc?.protein,
    carbs: goal.overrideCarbs ?? calc?.carbs,
    fat: goal.overrideFat ?? calc?.fat,
  };

  const numOrUndef = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? undefined : n;
  };

  const pace = useMemo(() => {
    const s = settings.startWeight;
    const g = settings.goalWeight;
    if (!s || !g || !settings.startDate || !settings.endDate) return null;
    const days = differenceInDays(parseISO(settings.endDate), parseISO(settings.startDate));
    if (days <= 0) return null;
    return { perWeek: ((g - s) / days) * 7, days };
  }, [settings]);

  const paceUnhealthy = pace && (
    (goal.type === "afvallen" && pace.perWeek < -0.5) ||
    (goal.type === "bijkomen" && pace.perWeek > 0.5)
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Account" subtitle="Profiel, doel en macro's" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {/* Profiel */}
        <Card>
          <CardContent className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {profile.photo ? (
                    <img src={profile.photo} alt="Profielfoto" className="h-full w-full object-cover" />
                  ) : (
                    <img
                      src={avatarSrc(profile.avatar)}
                      alt="Cartoon-avatar"
                      loading="lazy"
                      width={512}
                      height={512}
                      className="h-full w-full object-contain p-1"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Eigen foto kiezen"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card"
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const photo = await fileToAvatar(file);
                    setProfile({ ...profile, photo });
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="pname">Naam</Label>
                <Input
                  id="pname"
                  placeholder="Je naam"
                  value={profile.name ?? ""}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Of kies een cartoon</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_CHOICES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-label={`Avatar ${a}`}
                    onClick={() => setProfile({ ...profile, avatar: a, photo: undefined })}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl transition-colors ${
                      !profile.photo && profile.avatar === a ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Ingelogd als</div>
                <div className="truncate text-sm">{user?.email ?? "—"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut className="mr-1 h-4 w-4 text-primary" /> Uitloggen
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Eenheid</Label>
              <Select value={settings.unit} onValueChange={(v) => setSettings({ ...settings, unit: v as "kg" | "lb" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="lb">Pond (lb)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Doeltype */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Wat is je doel?</div>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGoal({ ...goal, type: t.id })}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    goal.type === t.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gewicht + tijdlijn */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Gewicht &amp; tijdlijn</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sw">Startgewicht ({settings.unit})</Label>
                <Input id="sw" inputMode="decimal" value={settings.startWeight ?? ""}
                  onChange={(e) => setSettings({ ...settings, startWeight: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gw">Doelgewicht ({settings.unit})</Label>
                <Input id="gw" inputMode="decimal" value={settings.goalWeight ?? ""}
                  onChange={(e) => setSettings({ ...settings, goalWeight: numOrUndef(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="h">Lengte (cm)</Label>
              <Input id="h" inputMode="decimal" value={settings.heightCm ?? ""}
                onChange={(e) => setSettings({ ...settings, heightCm: numOrUndef(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                label="Startdag"
                value={settings.startDate}
                onChange={(startDate) => setSettings({ ...settings, startDate })}
              />
              <DatePickerField
                label="Einddag"
                value={settings.endDate}
                onChange={(endDate) => setSettings({ ...settings, endDate })}
              />
            </div>
            {pace && (
              <div
                className="rounded-lg border px-3 py-2.5 text-xs"
                style={{
                  borderColor: paceUnhealthy ? "var(--destructive)" : "var(--primary)",
                  background: paceUnhealthy
                    ? "color-mix(in oklab, var(--destructive) 10%, transparent)"
                    : "color-mix(in oklab, var(--primary) 10%, transparent)",
                  color: paceUnhealthy ? "var(--destructive)" : "var(--primary)",
                }}
              >
                <div className="font-medium tabular-nums">
                  {pace.perWeek > 0 ? "+" : ""}{pace.perWeek.toFixed(2)} {settings.unit}/week nodig
                </div>
                <div className="mt-0.5 opacity-80">
                  {paceUnhealthy
                    ? "Te ambitieus — aanbevolen is max 0,5 kg/week."
                    : "Gezond tempo (≤ 0,5 kg/week)."}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Persoonsdata */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Over jou</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Leeftijd</Label>
                <Input id="age" inputMode="numeric" value={goal.age ?? ""}
                  onChange={(e) => setGoal({ ...goal, age: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Geslacht</Label>
                <Select value={goal.sex} onValueChange={(v) => setGoal({ ...goal, sex: v as Sex })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v">Vrouw</SelectItem>
                    <SelectItem value="m">Man</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dagelijks leven */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Dagelijks leven</div>
            <p className="text-xs text-muted-foreground">
              Hoe zit/sta/wandel je op een gemiddelde dag, buiten sport om?
            </p>
            <Select
              value={goal.lifestyle ?? "zittend"}
              onValueChange={(v) => setGoal({ ...goal, lifestyle: v as Lifestyle })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zittend">Zittend werk, weinig bewegen</SelectItem>
                <SelectItem value="licht_actief">Zittend werk + wat wandelen</SelectItem>
                <SelectItem value="actief">Veel op de been / staand werk</SelectItem>
                <SelectItem value="zeer_actief">Zwaar fysiek werk</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Sport / beweging */}
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <div className="text-sm font-medium">Sport &amp; beweging</div>
            <p className="text-xs text-muted-foreground">
              Extra beweging naast je dagelijks leven (gym, hardlopen, yoga, …).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="spw">Sessies per week</Label>
                <Input id="spw" inputMode="numeric" value={goal.sessionsPerWeek ?? ""}
                  onChange={(e) => setGoal({ ...goal, sessionsPerWeek: numOrUndef(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mps">Minuten per sessie</Label>
                <Input id="mps" inputMode="numeric" value={goal.minutesPerSession ?? ""}
                  onChange={(e) => setGoal({ ...goal, minutesPerSession: numOrUndef(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Intensiteit</Label>
              <Select
                value={goal.intensity ?? "matig"}
                onValueChange={(v) => setGoal({ ...goal, intensity: v as Intensity })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag (yoga, rustig wandelen)</SelectItem>
                  <SelectItem value="matig">Matig (fitness, fietsen, dansen)</SelectItem>
                  <SelectItem value="hoog">Hoog (hardlopen, HIIT, voetbal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Berekend resultaat */}
        {!calc ? (
          <Card>
            <CardContent className="px-5 py-6 text-sm text-muted-foreground text-center">
              Vul je leeftijd, lengte en startgewicht in om je dagelijks plan te zien.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Aanbevolen per dag</div>
                    <div className="text-3xl font-semibold tabular-nums text-primary" style={{ fontFamily: "var(--font-display)" }}>
                      {calc.kcal} <span className="text-sm font-normal text-muted-foreground">kcal</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    TDEE: {calc.tdee} kcal
                    {calc.perWeekKg !== 0 && (
                      <div className={Math.abs(calc.perWeekKg) > 0.5 ? "text-destructive" : "text-success"}>
                        {calc.perWeekKg > 0 ? "+" : ""}{calc.perWeekKg.toFixed(2)} kg/week
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Macro tag="P" v={calc.protein} />
                  <Macro tag="K" v={calc.carbs} />
                  <Macro tag="V" v={calc.fat} />
                </div>
              </CardContent>
            </Card>

            {calc.warnings.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="flex gap-3 px-5 py-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-destructive">Let op</div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {calc.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overrides */}
            <Card>
              <CardContent className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Aanpassen (optioneel)</div>
                  <Button variant="ghost" size="sm" onClick={() => setGoal({ ...goal, overrideKcal: undefined, overrideProtein: undefined, overrideCarbs: undefined, overrideFat: undefined })}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5 text-primary" /> Reset
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <OverrideInput label="Kcal" v={active.kcal} onChange={(n) => setGoal({ ...goal, overrideKcal: n })} />
                  <OverrideInput label="Eiwit (g)" v={active.protein} onChange={(n) => setGoal({ ...goal, overrideProtein: n })} />
                  <OverrideInput label="Koolhydraten (g)" v={active.carbs} onChange={(n) => setGoal({ ...goal, overrideCarbs: n })} />
                  <OverrideInput label="Vet (g)" v={active.fat} onChange={(n) => setGoal({ ...goal, overrideFat: n })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Deze waarden worden gebruikt in je dag- en weekplanning.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`h-9 w-full min-w-0 justify-start px-3 text-left font-normal shadow-sm ${!selected ? "text-muted-foreground" : ""}`}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              {selected ? format(selected, "d MMM yyyy", { locale: nl }) : "Kies datum"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
            defaultMonth={selected}
            locale={nl}
            initialFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Macro({ tag, v }: { tag: string; v: number }) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{tag}</div>
      <div className="text-base font-semibold tabular-nums">{v}<span className="text-xs font-normal text-muted-foreground">g</span></div>
    </div>
  );
}

function OverrideInput({ label, v, onChange }: { label: string; v?: number; onChange: (n: number | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={v ?? ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          onChange(isNaN(n) ? undefined : n);
        }} />
    </div>
  );
}
