import {
  createEmptyMotionGraph,
  MOTION_GRAPH_SCHEMA_VERSION,
  type MotionGraph,
} from "@motionlens/motion-graph";
import { describe, expect, it } from "vitest";

import { assessQuality, generatePrompt, TARGET_PLATFORMS } from "./index";

function sampleGraph(): MotionGraph {
  return {
    schemaVersion: MOTION_GRAPH_SCHEMA_VERSION,
    sourceUrl: "https://example.com",
    trigger: "hover",
    triggerConfidence: 0.9,
    capturedAt: new Date().toISOString(),
    durationMs: 250,
    sequence: { kind: "single", confidence: 1 },
    nodes: [
      {
        id: "n1",
        selector: ".card",
        parentId: null,
        motionTypes: ["fade", "translate"],
        changes: [
          {
            property: "opacity",
            from: "0",
            to: "1",
            duration: 250,
            delay: 0,
            easing: "ease-out",
            easingConfidence: 0.9,
          },
          {
            property: "transform",
            from: "matrix(1, 0, 0, 1, 0, 12)",
            to: "matrix(1, 0, 0, 1, 0, 0)",
            duration: 250,
            delay: 0,
            easing: "ease-out",
            easingConfidence: 0.85,
          },
        ],
      },
    ],
  };
}

describe("generatePrompt", () => {
  it("produces a complete prompt for every supported platform", () => {
    const graph = sampleGraph();

    for (const platform of TARGET_PLATFORMS) {
      const prompt = generatePrompt(graph, platform);
      expect(prompt.platform).toBe(platform);
      expect(prompt.text).toContain("https://example.com");
      expect(prompt.text).toContain("hover");
      expect(prompt.text).toContain("ease-out");
      expect(prompt.text).toContain("250ms");
      expect(prompt.quality.score).toBeGreaterThan(80);
    }
  });

  it("includes the exact specification table", () => {
    const prompt = generatePrompt(sampleGraph(), "claude");
    expect(prompt.text).toContain("| Element | Property | From | To |");
    expect(prompt.text).toContain("`.card`");
  });
});

describe("assessQuality", () => {
  it("scores an empty graph zero", () => {
    const quality = assessQuality(createEmptyMotionGraph("https://example.com", "hover"));
    expect(quality.score).toBe(0);
  });

  it("penalizes low-confidence easing", () => {
    const graph = sampleGraph();
    for (const node of graph.nodes) {
      for (const change of node.changes) change.easingConfidence = 0.3;
    }
    const quality = assessQuality(graph);
    expect(quality.score).toBeLessThan(100);
    expect(quality.notes.join(" ")).toMatch(/easing/i);
  });
});
