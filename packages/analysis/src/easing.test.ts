import { describe, expect, it } from "vitest";

import { cubicBezierAt, fitEasing, scalarMetric } from "./easing";
import type { ValueSample } from "./summarize";

function samplesFor(bezier: [number, number, number, number], steps = 20): ValueSample[] {
  const samples: ValueSample[] = [{ timestamp: 0, value: "0" }];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    samples.push({
      timestamp: 100 + t * 300,
      value: String(cubicBezierAt(t, bezier)),
    });
  }
  return samples;
}

describe("cubicBezierAt", () => {
  it("is identity for linear", () => {
    expect(cubicBezierAt(0.5, [0, 0, 1, 1])).toBeCloseTo(0.5, 3);
  });

  it("clamps the ends", () => {
    expect(cubicBezierAt(0, [0.42, 0, 1, 1])).toBe(0);
    expect(cubicBezierAt(1, [0.42, 0, 1, 1])).toBe(1);
  });
});

describe("scalarMetric", () => {
  it("extracts numbers from CSS values", () => {
    expect(scalarMetric("0.5")).toBeCloseTo(0.5);
    expect(scalarMetric("matrix(1, 0, 0, 1, 30, 40)")).toBeCloseTo(Math.hypot(1, 0, 0, 1, 30, 40));
    expect(scalarMetric("none")).toBeNull();
  });
});

describe("fitEasing", () => {
  it.each([
    ["linear", [0, 0, 1, 1]],
    ["ease-in", [0.42, 0, 1, 1]],
    ["ease-out", [0, 0, 0.58, 1]],
    ["ease-in-out", [0.42, 0, 0.58, 1]],
  ] as Array<[string, [number, number, number, number]]>)(
    "recovers %s from its own curve",
    (name, bezier) => {
      const fit = fitEasing(samplesFor(bezier));
      expect(fit.easing).toBe(name);
      expect(fit.confidence).toBeGreaterThan(0.8);
    },
  );

  it("falls back gracefully with too few samples", () => {
    const fit = fitEasing([
      { timestamp: 0, value: "0" },
      { timestamp: 100, value: "1" },
    ]);
    expect(fit.confidence).toBeLessThanOrEqual(0.3);
  });
});
