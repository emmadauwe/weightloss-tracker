import { describe, expect, test } from "bun:test";
import { exerciseMuscleKey, muscleIntensity, MUSCLE_IDS } from "./muscles";
import { analyseMusclesOnce } from "./muscle-cache";

describe("exercise muscle mapping", () => {
  test("the same exercise name has one key despite case and spacing", () => {
    expect(exerciseMuscleKey("  Hip   Thrust ")).toBe(exerciseMuscleKey("hip thrust"));
  });
  test("distinguishes all three glute muscles and inner/outer thighs", () => {
    for (const id of ["gluteus_maximus", "gluteus_medius", "gluteus_minimus", "adductoren", "quadriceps_binnen", "quadriceps_buiten"]) {
      expect(MUSCLE_IDS.includes(id as typeof MUSCLE_IDS[number])).toBe(true);
    }
    const analysis = { muscles: [{ id: "gluteus_maximus" as const, intensity: 3 }, { id: "gluteus_medius" as const, intensity: 1 }] };
    expect(muscleIntensity(analysis, "gluteus_maximus")).toBe(3);
    expect(muscleIntensity(analysis, "gluteus_medius")).toBe(1);
    expect(muscleIntensity(analysis, "gluteus_minimus")).toBe(0);
  });
  test("existing coarse results work without reanalysis", () => {
    expect(muscleIntensity({ muscles: [{ id: "billen", intensity: 2 }] }, "gluteus_maximus")).toBe(2);
  });
  test("simultaneous views only request analysis once", async () => {
    let calls = 0;
    const analyse = async () => { calls++; return { muscles: [{ id: "borst" as const, intensity: 3 }] }; };
    await Promise.all([analyseMusclesOnce("Bench press", analyse), analyseMusclesOnce(" bench  PRESS ", analyse)]);
    expect(calls).toBe(1);
  });
});