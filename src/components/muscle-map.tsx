import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExerciseMuscles } from "@/hooks/use-exercise-muscles";
import { exerciseMuscleKey, hasDetailedMuscleAnalysis, muscleIntensity, MUSCLE_LABELS, type MuscleAnalysis, type MuscleId } from "@/lib/muscles";

function muscleFill(analysis: MuscleAnalysis, id: MuscleId) {
  const intensity = muscleIntensity(analysis, id);
  return intensity === 3 ? "var(--success-strong)" : intensity === 2 ? "var(--primary)" : intensity === 1 ? "var(--secondary)" : "var(--muted)";
}

export function MuscleMap({ exerciseName }: { exerciseName: string }) {
  const { cache, loaded, ensure } = useExerciseMuscles();
  const key = exerciseMuscleKey(exerciseName);
  const saved = cache[key] ?? cache[exerciseName.trim().toLowerCase()];
  const cached = hasDetailedMuscleAnalysis(saved) ? saved : undefined;
  const [result, setResult] = useState<MuscleAnalysis | undefined>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError("");
    if (loaded && !cached) {
      void ensure(exerciseName).then((analysis) => { if (active) setResult(analysis); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Spieranalyse niet beschikbaar."); });
    }
    return () => { active = false; };
  }, [key, loaded, cached, ensure, attempt]);
  const analysis = cached ?? result ?? { muscles: [] };
  return (
    <div className="mt-4" aria-busy={!cached && !result && !error}>
      <div className="grid grid-cols-2 gap-5">
        <BodyFigure side="front" analysis={analysis} />
        <BodyFigure side="back" analysis={analysis} />
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground" aria-label="Belastingsintensiteit">
        {([1, 2, 3] as const).map((intensity) => <span key={intensity} className="flex items-center gap-1">
          <svg width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill={intensity === 3 ? "var(--success-strong)" : intensity === 2 ? "var(--primary)" : "var(--secondary)"} /></svg>
          {intensity === 3 ? "Hoofdspier" : intensity === 2 ? "Hulpspier" : "Licht"}
        </span>)}
      </div>
      {error && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <span className="min-w-0 flex-1">{error}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Spieranalyse opnieuw proberen" onClick={() => setAttempt((n) => n + 1)}><RotateCcw className="h-3.5 w-3.5" /></Button>
      </div>}
    </div>
  );
}

type Region = { id: MuscleId; d: string; deep?: boolean };
const front: Region[] = [
  { id: "schouders_zij", d: "M52 53 C44 54 38 61 37 71 L45 77 C47 67 52 64 56 62 Z" },
  { id: "schouders_voor", d: "M54 54 C58 53 62 55 63 61 L55 72 L47 75 C48 65 52 59 54 54 Z" },
  { id: "borst_boven", d: "M64 57 C69 55 74 58 78 61 L78 73 C69 73 61 72 57 69 Z" },
  { id: "borst_onder", d: "M57 71 C62 75 70 76 78 75 L78 86 C69 89 61 85 57 80 Z" },
  { id: "biceps", d: "M39 77 C44 77 47 80 46 87 L40 105 C36 106 32 103 33 98 Z" },
  { id: "triceps", d: "M48 79 L51 83 C50 92 46 100 42 105 L44 89 Z" },
  { id: "onderarmen", d: "M32 107 C35 110 39 110 40 108 C38 120 32 133 29 145 L24 144 C24 132 28 116 32 107 Z" },
  { id: "buik_schuin", d: "M56 88 L64 92 L63 124 L70 147 C61 143 55 136 54 125 Z" },
  { id: "buik", d: "M67 90 Q72 88 78 90 L78 100 L67 100 Z M67 103 L78 103 L78 114 L67 114 Z M67 117 L78 117 L78 128 L67 128 Z M68 131 L78 131 L78 147 Q72 145 68 139 Z" },
  { id: "abductoren", d: "M53 147 C48 154 46 166 47 177 L53 172 L59 150 Z" },
  { id: "quadriceps_buiten", d: "M51 175 C48 185 48 203 51 219 Q54 226 58 229 L62 219 L60 176 Z" },
  { id: "quadriceps_midden", d: "M62 159 Q67 157 71 165 L68 208 Q66 220 62 224 L60 202 Z" },
  { id: "adductoren", d: "M73 158 L78 165 C75 181 75 199 72 214 L69 199 Z" },
  { id: "quadriceps_binnen", d: "M70 206 C73 212 73 225 68 233 Q62 232 63 226 Z" },
  { id: "gastrocnemius", d: "M52 244 C47 252 48 271 53 280 L59 272 L59 248 Z" },
  { id: "soleus", d: "M62 249 C65 256 63 277 60 295 L56 310 L53 309 L56 280 Z" },
];
const back: Region[] = [
  { id: "trapezius", d: "M72 41 L78 45 L78 82 C68 73 62 64 55 59 Z" },
  { id: "schouders_achter", d: "M51 55 C43 56 38 62 37 72 L46 78 L58 65 Z" },
  { id: "triceps", d: "M38 80 C43 78 47 80 47 86 L42 107 C36 110 32 105 33 98 Z" },
  { id: "onderarmen", d: "M32 110 L40 111 C37 123 31 136 29 145 L24 144 C25 128 28 117 32 110 Z" },
  { id: "rug", d: "M58 68 L75 84 L74 96 Q64 89 56 85 Z" },
  { id: "lats", d: "M55 88 Q63 89 74 99 L72 122 L64 135 C57 121 54 104 55 88 Z" },
  { id: "onderrug", d: "M75 101 L78 103 L78 148 L66 143 L72 128 Z" },
  { id: "gluteus_medius", d: "M54 145 Q61 143 69 147 L63 160 L49 169 C47 158 50 149 54 145 Z" },
  { id: "gluteus_maximus", d: "M65 153 Q73 149 78 154 L78 175 C72 184 60 185 51 177 L51 171 Z" },
  // De kleine bilspier ligt onder de middelste: gestippelde projectie, geen oppervlakkige anatomie.
  { id: "gluteus_minimus", deep: true, d: "M53 152 Q58 148 63 151 L59 159 L51 163 Z" },
  { id: "hamstrings_buiten", d: "M51 184 L60 188 C59 202 60 219 58 233 L52 236 C49 222 47 199 51 184 Z" },
  { id: "hamstrings_binnen", d: "M64 188 Q72 186 75 183 C74 200 71 218 68 234 L61 233 Z" },
  { id: "adductoren", d: "M76 180 L78 180 L73 208 L71 214 L73 190 Z" },
  { id: "gastrocnemius", d: "M53 244 C48 250 47 266 53 279 Q57 280 59 273 L59 249 Z M62 247 C68 253 67 268 63 278 L60 274 L60 251 Z" },
  { id: "soleus", d: "M51 280 L57 284 L61 282 C61 292 57 306 55 312 L52 311 Z" },
];

export function BodyFigure({ side, analysis }: { side: "front" | "back"; analysis: MuscleAnalysis }) {
  const regions = side === "front" ? front : back;
  return (
    <svg viewBox="0 0 160 350" className="mx-auto h-64 w-full max-w-36" role="img" aria-label={side === "front" ? "Spieren vooraanzicht" : "Spieren achteraanzicht"}>
      <g stroke="var(--muted-foreground)" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M80 9 C69 9 66 17 67 27 C63 25 64 36 69 37 L73 45 Q80 50 87 45 L91 37 C96 36 97 25 93 27 C94 17 91 9 80 9 Z" fill="var(--muted)" />
        {[false, true].map((mirror) => <g key={String(mirror)} transform={mirror ? "translate(160 0) scale(-1 1)" : undefined}>
          <path d="M73 42 C73 50 63 50 53 53 C44 54 37 59 34 69 L30 92 C27 104 25 111 23 121 L20 147 C19 152 17 157 18 163 L20 171 Q23 174 24 169 L24 159 L26 171 Q29 172 29 167 L29 157 L31 153 Q35 153 35 149 L34 143 L42 122 L46 109 L52 89 C53 101 51 117 52 130 L54 142 C47 153 43 168 44 184 C43 204 47 222 49 237 C47 251 44 265 48 282 L51 310 L50 320 C47 323 42 331 46 336 C50 340 58 335 62 330 L65 324 L63 315 L66 286 C69 268 70 252 67 240 C72 220 75 198 76 184 L80 171 L80 47" fill="var(--muted)" />
          {regions.map((region, index) => <path key={index} d={region.d} fill={muscleFill(analysis, region.id)} stroke={region.deep ? "var(--muted-foreground)" : "var(--card)"} strokeWidth={region.deep ? 0.8 : 1.2} strokeDasharray={region.deep ? "2 2" : undefined}><title>{MUSCLE_LABELS[region.id]} · {muscleIntensity(analysis, region.id)}/3</title></path>)}
          <path d="M54 238 Q59 235 65 239 M53 313 L59 315" fill="none" opacity="0.5" />
        </g>)}
      </g>
    </svg>
  );
}
