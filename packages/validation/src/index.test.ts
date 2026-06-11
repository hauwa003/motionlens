import { createEmptyMotionGraph } from "@motionlens/motion-graph";
import { describe, expect, it } from "vitest";

import { compareGraphs, SCORE_WEIGHTS } from "./index";

describe("SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("compareGraphs", () => {
  it("returns a score for every category and an overall value", () => {
    const a = createEmptyMotionGraph("https://example.com", "hover");
    const b = createEmptyMotionGraph("http://localhost:3000", "hover");

    const score = compareGraphs(a, b);

    expect(Object.keys(score.categories).sort()).toEqual(Object.keys(SCORE_WEIGHTS).sort());
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });
});
