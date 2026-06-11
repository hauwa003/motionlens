import {
  MOTION_GRAPH_SCHEMA_VERSION,
  type MotionGraph,
  type PropertyChange,
} from "@motionlens/motion-graph";
import { describe, expect, it } from "vitest";

import { compareGraphs, easingCloseness, SCORE_WEIGHTS } from "./index";

function graphWith(changes: Array<Partial<PropertyChange> & { property: string }>): MotionGraph {
  return {
    schemaVersion: MOTION_GRAPH_SCHEMA_VERSION,
    sourceUrl: "https://example.com",
    trigger: "hover",
    capturedAt: new Date().toISOString(),
    durationMs: 300,
    sequence: { kind: "single", confidence: 1 },
    nodes: [
      {
        id: "n1",
        selector: ".card",
        parentId: null,
        motionTypes: ["fade"],
        changes: changes.map((change) => ({
          from: "0",
          to: "1",
          duration: 300,
          delay: 0,
          easing: "ease-out",
          ...change,
        })),
      },
    ],
  };
}

describe("SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("easingCloseness", () => {
  it("treats identical easings as perfect", () => {
    expect(easingCloseness("ease-out", "ease-out")).toBe(1);
  });

  it("treats a named easing and its bezier form as near-identical", () => {
    expect(easingCloseness("ease-out", "cubic-bezier(0, 0, 0.58, 1)")).toBeGreaterThan(0.95);
  });

  it("penalizes opposite curves", () => {
    expect(easingCloseness("ease-in", "ease-out")).toBeLessThan(0.7);
  });
});

describe("compareGraphs", () => {
  it("scores a perfect recreation 100", () => {
    const original = graphWith([{ property: "opacity" }]);
    const recreation = graphWith([{ property: "opacity" }]);

    const score = compareGraphs(original, recreation);
    expect(score.overall).toBe(100);
    expect(score.differences).toEqual([]);
  });

  it("penalizes timing drift and suggests the fix", () => {
    const original = graphWith([{ property: "opacity", duration: 300 }]);
    const recreation = graphWith([{ property: "opacity", duration: 150 }]);

    const score = compareGraphs(original, recreation);
    expect(score.categories.timing).toBeLessThan(90);
    expect(score.suggestions.join(" ")).toContain("300ms");
  });

  it("penalizes wrong easing", () => {
    const original = graphWith([{ property: "opacity", easing: "ease-out" }]);
    const recreation = graphWith([{ property: "opacity", easing: "ease-in" }]);

    const score = compareGraphs(original, recreation);
    expect(score.categories.easing).toBeLessThan(70);
  });

  it("flags properties missing from the recreation", () => {
    const original = graphWith([
      { property: "opacity" },
      { property: "transform", from: "matrix(1, 0, 0, 1, 0, 12)", to: "matrix(1, 0, 0, 1, 0, 0)" },
    ]);
    const recreation = graphWith([{ property: "opacity" }]);

    const score = compareGraphs(original, recreation);
    expect(score.differences.some((diff) => diff.message.includes("missing"))).toBe(true);
    expect(score.categories.spatial).toBeLessThan(60);
  });

  it("classifies spatial vs visual properties into the right buckets", () => {
    const original = graphWith([
      { property: "transform", from: "matrix(1, 0, 0, 1, 0, 0)", to: "matrix(1, 0, 0, 1, 0, 40)" },
    ]);
    const recreation = graphWith([
      { property: "transform", from: "matrix(1, 0, 0, 1, 0, 0)", to: "matrix(1, 0, 0, 1, 0, 5)" },
    ]);

    const score = compareGraphs(original, recreation);
    expect(score.categories.spatial).toBeLessThan(100);
    expect(score.categories.visual).toBe(100);
  });
});
