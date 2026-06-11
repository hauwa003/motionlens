import { describe, expect, it } from "vitest";

import { buildMotionGraph, type RawCapture } from "./index";

describe("buildMotionGraph", () => {
  it("carries the capture source and detected trigger into the graph", () => {
    const capture: RawCapture = {
      sourceUrl: "https://example.com",
      startedAt: new Date().toISOString(),
      durationMs: 500,
      stopReason: "manual",
      observedElementCount: 1,
      frames: [
        { timestamp: 0, selector: ".a", styles: { opacity: "0" } },
        { timestamp: 100, selector: ".a", styles: { opacity: "1" } },
      ],
      mutations: [],
      events: [{ timestamp: 20, type: "pointerover" }],
    };

    const graph = buildMotionGraph(capture);

    expect(graph.sourceUrl).toBe("https://example.com");
    expect(graph.trigger).toBe("hover");
  });
});
