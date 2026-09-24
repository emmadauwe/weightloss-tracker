import type { Macros } from "./nutrition-math";
import { sportOf, type Workout } from "./workouts";

/**
 * MET-waarden (Compendium of Physical Activities), bewust aan de lage kant.
 * Per sport: [rustig, gemiddeld, intensief].
 */
const MET: Record<string, [number, number, number]> = {
  lopen: [7, 9, 11],
  fietsen: [5, 7, 9.5],
  wandelen: [3, 3.5, 4.5],
  zwemmen: [5, 7, 9],
  roeien: [4.5, 7, 9],
  skien: [4.5, 6, 8],
  krachttraining: [3, 4, 5],
  calisthenics: [3.5, 4.5, 6],
  yoga: [2, 2.5, 3],
  pilates: [2.5, 3, 3.5],
  stretchen: [2, 2.3, 2.5],
  hiit: [6, 7.5, 9],
  voetbal: [5.5, 7, 9],
  tennis: [5, 6.5, 8],
  padel: [4.5, 5.5, 7],
  basketbal: [5, 6.5, 8],
  volleybal: [3, 4, 6],
  dansen: [3.5, 5, 7],
  klimmen: [5, 6.5, 8],
  vechtsport: [5, 7, 10],
  anders: [3.5, 5, 6.5],
};

/** Minuten bij een krachtsessie zonder duur: ± 2,5 min per set (incl. rust). */
function durationOf(w: Workout): number {
  if (w.duration_min && w.duration_min > 0) return w.duration_min;
  if (sportOf(w.sport).kind === "kracht") {
    const sets = (w.exercises ?? []).reduce((t, e) => t + e.sets.length, 0);
    return sets * 2.5;
  }
  return 0;
}

function metOf(w: Workout): number {
  const row = MET[w.sport] ?? MET.anders;
  let met = row[w.intensity === "rustig" ? 0 : w.intensity === "intensief" ? 2 : 1];
  // Gemeten snelheid geeft een betere schatting bij lopen/fietsen.
  if (w.avg_speed) {
    if (w.sport === "lopen") met = Math.min(met, Math.max(6, w.avg_speed * 1.0));
    if (w.sport === "fietsen") met = Math.min(met, w.avg_speed < 16 ? 4 : w.avg_speed < 20 ? 6 : w.avg_speed < 25 ? 8 : 10);
  }
  return met;
}

/**
 * Extra energie door een training, bovenop je gewone dagverbruik.
 * - Enkel de netto-verbranding (MET − 1), want rust zit al in je doel.
 * - Veiligheidsmarge: bij afvallen telt slechts 60 %, anders 80 %.
 */
export function workoutExtraKcal(w: Workout, weightKg: number, losing: boolean): number {
  const hours = durationOf(w) / 60;
  if (hours <= 0 || !weightKg) return 0;
  const net = Math.max(0, metOf(w) - 1) * weightKg * hours;
  return Math.round(net * (losing ? 0.6 : 0.8));
}

/** Extra macro's voor één dag: vooral koolhydraten, wat vet, eiwit bij kracht. */
export function extraMacrosForDate(
  date: string,
  workouts: Workout[],
  weightKg: number,
  losing: boolean,
): Macros {
  let kcal = 0;
  let strengthKcal = 0;
  for (const w of workouts) {
    if (w.date !== date) continue;
    const k = workoutExtraKcal(w, weightKg, losing);
    kcal += k;
    if (sportOf(w.sport).kind === "kracht") strengthKcal += k;
  }
  if (kcal <= 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round((strengthKcal * 0.2) / 4);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}
