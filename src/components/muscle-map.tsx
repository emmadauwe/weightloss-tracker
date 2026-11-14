import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyseExerciseMuscles, fallbackMuscleAnalysis, MUSCLE_LABELS, type MuscleAnalysis, type MuscleId } from "@/lib/muscles";
import { useCloudDoc } from "@/lib/cloud-store";

const CACHE_KEY = "exercise-muscle-analysis-v1";
const EMPTY_CACHE: Record<string, MuscleAnalysis> = {};

function muscleFill(muscles: MuscleAnalysis["muscles"], id: MuscleId) {
  const intensity = muscles.find((m) => m.id === id)?.intensity ?? 0;
  return intensity === 3 ? "var(--success-strong)" : intensity === 2 ? "var(--primary)" : intensity === 1 ? "var(--secondary)" : "var(--muted)";
}

export function MuscleMap({ exerciseName }: { exerciseName: string }) {
  const { value: cache, setValue: setCache } = useCloudDoc<Record<string, MuscleAnalysis>>(CACHE_KEY, EMPTY_CACHE);
  const key = exerciseName.trim().toLowerCase();
  const cached = cache[key];
  const [analysis, setAnalysis] = useState<MuscleAnalysis>(() => cached ?? fallbackMuscleAnalysis(exerciseName));
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const existing = cache[key];
    if (existing) {
      setAnalysis(existing);
      setLoading(false);
      return () => { active = false; };
    }
    setAnalysis(fallbackMuscleAnalysis(exerciseName));
    setLoading(true);
    setError(false);
    void analyseExerciseMuscles(exerciseName)
      .then((result) => {
        if (!active) return;
        setAnalysis(result);
        setCache((prev) => ({ ...prev, [key]: result }));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => { active = false; };
    // Alleen opnieuw analyseren bij een andere oefening of een expliciete nieuwe poging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const labels = useMemo(
    () => analysis.muscles.filter((m) => m.intensity > 0).sort((a, b) => b.intensity - a.intensity).slice(0, 4),
    [analysis],
  );

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Getrainde spieren
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {loading ? "AI analyseert deze oefening…" : analysis.summary ?? "Donkerder betekent meer belasting"}
          </p>
        </div>
        {error && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setAttempt((n) => n + 1)} aria-label="Spieranalyse opnieuw proberen">
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
          </Button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <BodyFigure side="front" analysis={analysis} />
          <BodyFigure side="back" analysis={analysis} />
        </div>
        <div className="w-24 space-y-1.5">
          {labels.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: muscleFill(analysis.muscles, m.id) }} />
              <span>{MUSCLE_LABELS[m.id]}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Vooraanzicht · achteraanzicht</p>
    </div>
  );
}

function BodyFigure({ side, analysis }: { side: "front" | "back"; analysis: MuscleAnalysis }) {
  const fill = (id: MuscleId) => muscleFill(analysis.muscles, id);
  const stroke = "var(--muted-foreground)";
  const common = { stroke, strokeWidth: 1.2, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 100 210" className="mx-auto h-44 w-full max-w-24" role="img" aria-label={side === "front" ? "Spieren vooraanzicht" : "Spieren achteraanzicht"}>
      <circle cx="50" cy="15" r="10" fill="var(--muted)" {...common} />
      <path d="M42 26 L39 34 L29 39 L23 61 L27 88 L34 87 L34 62 L38 55 L38 101 L32 135 L34 174 L39 198 L47 198 L48 163 L50 135 L52 163 L53 198 L61 198 L66 174 L68 135 L62 101 L62 55 L66 62 L66 87 L73 88 L77 61 L71 39 L61 34 L58 26 Z" fill="var(--muted)" {...common} />
      {side === "front" ? (
        <g {...common}>
          <path d="M38 40 Q44 35 49 41 L49 60 Q41 61 38 53 Z" fill={fill("borst")} />
          <path d="M62 40 Q56 35 51 41 L51 60 Q59 61 62 53 Z" fill={fill("borst")} />
          <path d="M29 40 Q35 35 39 38 L36 51 L28 52 Z M71 40 Q65 35 61 38 L64 51 L72 52 Z" fill={fill("schouders")} />
          <path d="M27 53 L35 53 L33 73 L27 73 Z M73 53 L65 53 L67 73 L73 73 Z" fill={fill("biceps")} />
          <path d="M27 74 L33 74 L32 89 L27 89 Z M73 74 L67 74 L68 89 L73 89 Z" fill={fill("onderarmen")} />
          <path d="M41 63 L49 63 L49 72 L41 72 Z M51 63 L59 63 L59 72 L51 72 Z M41 75 L49 75 L49 84 L41 84 Z M51 75 L59 75 L59 84 L51 84 Z M43 87 L49 87 L49 98 L41 98 Z M51 87 L57 87 L59 98 L51 98 Z" fill={fill("buik")} />
          <path d="M37 106 L49 106 L47 145 L36 145 L34 130 Z M63 106 L51 106 L53 145 L64 145 L66 130 Z" fill={fill("quadriceps")} />
          <path d="M36 149 L47 149 L45 184 L38 184 L34 169 Z M64 149 L53 149 L55 184 L62 184 L66 169 Z" fill={fill("kuiten")} />
        </g>
      ) : (
        <g {...common}>
          <path d="M39 35 L49 29 L49 46 L37 51 Z M61 35 L51 29 L51 46 L63 51 Z" fill={fill("trapezius")} />
          <path d="M29 40 Q35 35 39 38 L36 51 L28 52 Z M71 40 Q65 35 61 38 L64 51 L72 52 Z" fill={fill("schouders")} />
          <path d="M27 53 L35 53 L33 73 L27 73 Z M73 53 L65 53 L67 73 L73 73 Z" fill={fill("triceps")} />
          <path d="M27 74 L33 74 L32 89 L27 89 Z M73 74 L67 74 L68 89 L73 89 Z" fill={fill("onderarmen")} />
          <path d="M38 51 L48 47 L48 85 L39 77 Z M62 51 L52 47 L52 85 L61 77 Z" fill={fill("lats")} />
          <path d="M40 48 L48 48 L48 91 L41 82 Z M60 48 L52 48 L52 91 L59 82 Z" fill={fill("rug")} opacity={0.8} />
          <path d="M43 85 L49 85 L49 103 L40 103 Z M51 85 L57 85 L60 103 L51 103 Z" fill={fill("onderrug")} />
          <path d="M37 105 Q43 100 49 106 L47 124 L36 121 Z M63 105 Q57 100 51 106 L53 124 L64 121 Z" fill={fill("billen")} />
          <path d="M36 126 L47 126 L46 150 L36 150 L34 139 Z M64 126 L53 126 L54 150 L64 150 L66 139 Z" fill={fill("hamstrings")} />
          <path d="M36 153 L46 153 L44 184 L38 184 L34 169 Z M64 153 L54 153 L56 184 L62 184 L66 169 Z" fill={fill("kuiten")} />
        </g>
      )}
    </svg>
  );
}
