import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyWeightChanges } from "./weekly-weight";

test("weekly progress is weight lost or gained, not average body weight", () => {
  const result = weeklyWeightChanges([
    { date: "2026-11-02", weight: 80 }, { date: "2026-11-04", weight: 82 },
    { date: "2026-11-09", weight: 80 }, { date: "2026-11-11", weight: 81 },
    { date: "2026-11-16", weight: 81 },
  ]);
  assert.deepEqual(result.map((point) => point.change), [-0.5, 0.5]);
});
test("a missing week does not turn a two-week change into a one-week change", () => {
  assert.equal(weeklyWeightChanges([{ date: "2026-11-02", weight: 80 }, { date: "2026-11-16", weight: 79 }])[0]?.change, -0.5);
  assert.deepEqual(weeklyWeightChanges([{ date: "2026-11-02", weight: 80 }]), []);
});