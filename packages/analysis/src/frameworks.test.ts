import { describe, expect, it } from "vitest";

import { scoreFrameworks } from "./frameworks";

describe("scoreFrameworks", () => {
  it("scores GSAP highest when global + script agree", () => {
    const scores = scoreFrameworks({
      globals: ["gsap", "jQuery"],
      scriptSrcs: ["https://cdn.example.com/gsap.min.js", "https://cdn.example.com/jquery.js"],
      domMarkers: [],
    });

    expect(scores[0]?.framework).toBe("GSAP");
    expect(scores[0]?.confidence).toBeGreaterThan(0.8);
    expect(scores.map((s) => s.framework)).toContain("jQuery animate");
  });

  it("detects Framer Motion from DOM markers alone", () => {
    const scores = scoreFrameworks({
      globals: [],
      scriptSrcs: [],
      domMarkers: ["data-framer-name"],
    });

    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({ framework: "Framer Motion", confidence: 0.4 });
  });

  it("returns an empty list when nothing matches", () => {
    expect(scoreFrameworks({ globals: [], scriptSrcs: [], domMarkers: [] })).toEqual([]);
  });
});
