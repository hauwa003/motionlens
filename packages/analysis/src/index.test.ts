import { describe, expect, it } from "vitest";

import { buildMotionGraph, type RawCapture } from "./index";

describe("buildMotionGraph", () => {
  it("carries the capture source and trigger into the graph", () => {
    const capture: RawCapture = {
      sourceUrl: "https://example.com",
      trigger: "click",
      startedAt: new Date().toISOString(),
      frames: [],
    };

    const graph = buildMotionGraph(capture);

    expect(graph.sourceUrl).toBe("https://example.com");
    expect(graph.trigger).toBe("click");
  });
});
