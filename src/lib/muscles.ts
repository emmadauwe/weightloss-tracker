export const MUSCLE_IDS = [
  "borst",
  "schouders",
  "biceps",
  "triceps",
  "buik",
  "onderarmen",
  "quadriceps",
  "hamstrings",
  "billen",
  "kuiten",
  "rug",
  "lats",
  "onderrug",
  "trapezius",
  "borst_boven", "borst_onder", "schouders_voor", "schouders_zij", "schouders_achter",
  "buik_schuin", "quadriceps_binnen", "quadriceps_buiten", "quadriceps_midden",
  "adductoren", "abductoren", "hamstrings_binnen", "hamstrings_buiten",
  "gluteus_maximus", "gluteus_medius", "gluteus_minimus", "gastrocnemius", "soleus",
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];
export type MuscleTarget = { id: MuscleId; intensity: number };
export type MuscleAnalysis = { muscles: MuscleTarget[]; summary?: string; anatomyVersion?: number };
export const ANATOMY_VERSION = 2;
export const GENERAL_MUSCLE_IDS: MuscleId[] = ["borst", "schouders", "quadriceps", "hamstrings", "billen", "kuiten"];
export function hasDetailedMuscleAnalysis(analysis: MuscleAnalysis | undefined) {
  return Boolean(analysis && analysis.anatomyVersion === ANATOMY_VERSION && !analysis.muscles.some((m) => GENERAL_MUSCLE_IDS.includes(m.id)));
}

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  borst: "Borst",
  schouders: "Schouders",
  biceps: "Biceps",
  triceps: "Triceps",
  buik: "Buikspieren",
  onderarmen: "Onderarmen",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  billen: "Billen",
  kuiten: "Kuiten",
  rug: "Bovenrug",
  lats: "Latissimus",
  onderrug: "Onderrug",
  trapezius: "Trapezius",
  borst_boven: "Bovenborst", borst_onder: "Onderborst",
  schouders_voor: "Voorste schouder", schouders_zij: "Zijschouder", schouders_achter: "Achterste schouder",
  buik_schuin: "Schuine buikspieren", quadriceps_binnen: "Binnenste quadriceps",
  quadriceps_buiten: "Buitenste quadriceps", quadriceps_midden: "Middelste quadriceps",
  adductoren: "Binnenkant bovenbeen", abductoren: "Heupabductoren",
  hamstrings_binnen: "Binnenste hamstrings", hamstrings_buiten: "Buitenste hamstrings",
  gluteus_maximus: "Grote bilspier", gluteus_medius: "Middelste bilspier",
  gluteus_minimus: "Kleine bilspier (diep)", gastrocnemius: "Oppervlakkige kuit", soleus: "Diepe kuit",
};

export const MUSCLE_PARENTS: Partial<Record<MuscleId, MuscleId>> = {
  borst_boven: "borst", borst_onder: "borst", schouders_voor: "schouders", schouders_zij: "schouders", schouders_achter: "schouders",
  buik_schuin: "buik", quadriceps_binnen: "quadriceps", quadriceps_buiten: "quadriceps", quadriceps_midden: "quadriceps",
  hamstrings_binnen: "hamstrings", hamstrings_buiten: "hamstrings",
  gluteus_maximus: "billen", gluteus_medius: "billen", gluteus_minimus: "billen", gastrocnemius: "kuiten", soleus: "kuiten",
};

export function exerciseMuscleKey(name: string) {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function muscleIntensity(analysis: MuscleAnalysis, id: MuscleId) {
  const direct = analysis.muscles.find((m) => m.id === id);
  if (direct) return direct.intensity;
  // Never propagate a broad group's intensity to distinct anatomical regions.
  return 0;
}

/** Directe, voorzichtige schatting terwijl de AI-analyse wordt opgehaald. */
export function fallbackMuscleAnalysis(exerciseName: string): MuscleAnalysis {
  const name = exerciseName.toLowerCase();
  const has = (...words: string[]) => words.some((word) => name.includes(word));
  const targets: MuscleTarget[] = [];
  const add = (id: MuscleId, intensity: number) => targets.push({ id, intensity });

  if (has("bench", "bankdruk", "push up", "push-up", "opdruk", "chest", "fly")) {
    add("borst", 3); add("triceps", 2); add("schouders", 1);
  } else if (has("squat", "beenpers", "leg press", "lunge", "split")) {
    add("quadriceps", 3); add("billen", 2); add("hamstrings", 1);
  } else if (has("deadlift", "rugtrek", "hip thrust", "good morning")) {
    add("billen", 3); add("hamstrings", 2); add("onderrug", 2);
  } else if (has("row", "roeien", "pull up", "pull-up", "lat pulldown", "pulldown")) {
    add("lats", 3); add("rug", 2); add("biceps", 2);
  } else if (has("shoulder", "overhead", "schouder", "lateral", "side raise")) {
    add("schouders", 3); add("trapezius", 1); add("triceps", 1);
  } else if (has("curl", "bicep")) {
    add("biceps", 3); add("onderarmen", 1);
  } else if (has("tricep", "dips", "pushdown")) {
    add("triceps", 3); add("borst", 1);
  } else if (has("calf", "kuit")) {
    add("kuiten", 3);
  } else if (has("hamstring", "leg curl")) {
    add("hamstrings", 3); add("billen", 1);
  } else if (has("plank", "crunch", "buik", "ab ")) {
    add("buik", 3); add("onderrug", 1);
  } else {
    add("buik", 1); add("rug", 1);
  }
  return { muscles: targets, summary: "Voorlopige schatting" };
}

export async function analyseExerciseMuscles(name: string): Promise<MuscleAnalysis> {
  const res = await fetch("/api/exercise-muscles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const json = (await res.json().catch(() => null)) as (MuscleAnalysis & { error?: string }) | null;
  if (!res.ok || !json) throw new Error(json?.error ?? "De spieranalyse is niet gelukt.");
  return {
    muscles: (json.muscles ?? []).filter((m) => MUSCLE_IDS.includes(m.id)).map((m) => ({
      id: m.id,
      intensity: Math.max(0, Math.min(3, Math.round(m.intensity))),
    })),
    summary: json.summary,
  };
}
