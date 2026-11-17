import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { exerciseMuscleKey, muscleIntensity, MUSCLE_IDS, hasDetailedMuscleAnalysis, ANATOMY_VERSION } from "./muscles";
import { analyseMusclesOnce } from "./muscle-cache";

describe("exercise muscle mapping", () => {
  test("the same exercise name has one key despite case and spacing", () => {
    assert.equal(exerciseMuscleKey("  Hip   Thrust "), exerciseMuscleKey("hip thrust"));
  });
  test("distinguishes all three glute muscles and inner/outer thighs", () => {
    for (const id of ["gluteus_maximus", "gluteus_medius", "gluteus_minimus", "adductoren", "quadriceps_binnen", "quadriceps_buiten"]) {
      assert.equal(MUSCLE_IDS.includes(id as typeof MUSCLE_IDS[number]), true);
    }
    const analysis = { muscles: [{ id: "gluteus_maximus" as const, intensity: 3 }, { id: "gluteus_medius" as const, intensity: 1 }] };
    assert.equal(muscleIntensity(analysis, "gluteus_maximus"), 3);
    assert.equal(muscleIntensity(analysis, "gluteus_medius"), 1);
    assert.equal(muscleIntensity(analysis, "gluteus_minimus"), 0);
  });
  test("a broad glute group never colors the three distinct glutes", () => {
    for (const id of ["gluteus_maximus", "gluteus_medius", "gluteus_minimus"] as const) {
      assert.equal(muscleIntensity({ muscles: [{ id: "billen", intensity: 3 }] }, id), 0);
    }
  });
  test("coarse caches are upgraded once, current detailed results are reusable", () => {
    assert.equal(hasDetailedMuscleAnalysis({ anatomyVersion: 2, muscles: [{ id: "gluteus_maximus", intensity: 3 }] }), false);
    assert.equal(hasDetailedMuscleAnalysis({ muscles: [{ id: "billen", intensity: 3 }] }), false);
    assert.equal(hasDetailedMuscleAnalysis({ anatomyVersion: ANATOMY_VERSION, muscles: [{ id: "gluteus_maximus", intensity: 3 }] }), true);
    assert.equal(hasDetailedMuscleAnalysis({ anatomyVersion: ANATOMY_VERSION, muscles: [{ id: "quadriceps", intensity: 3 }] }), false);
  });
  test("simultaneous views only request analysis once", async () => {
    let calls = 0;
    const analyse = async () => { calls++; return { muscles: [{ id: "borst" as const, intensity: 3 }] }; };
    await Promise.all([analyseMusclesOnce("Bench press", analyse), analyseMusclesOnce(" bench  PRESS ", analyse)]);
    assert.equal(calls, 1);
  });
});