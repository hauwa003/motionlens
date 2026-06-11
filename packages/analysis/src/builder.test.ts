import { describe, expect, it } from "vitest";

import { buildMotionGraph } from "./builder";
import type { RawCapture } from "./capture/types";

function staggeredFadeCapture(): RawCapture {
  // Three list items fading in 80ms apart after a click at t=50.
  const frames: RawCapture["frames"] = [];
  const selectors = ["ul > li:nth-of-type(1)", "ul > li:nth-of-type(2)", "ul > li:nth-of-type(3)"];

  for (const selector of selectors) {
    frames.push({ timestamp: 0, selector, styles: { opacity: "0" } });
  }
  selectors.forEach((selector, index) => {
    const start = 100 + index * 80;
    for (let step = 1; step <= 10; step++) {
      frames.push({
        timestamp: start + step * 20,
        selector,
        styles: { opacity: String(step / 10) },
      });
    }
  });
  frames.sort((a, b) => a.timestamp - b.timestamp);

  return {
    sourceUrl: "https://example.com/pricing",
    startedAt: new Date().toISOString(),
    durationMs: 600,
    stopReason: "manual",
    observedElementCount: 3,
    frames,
    mutations: [],
    events: [{ timestamp: 50, type: "click" }],
  };
}

describe("buildMotionGraph", () => {
  const graph = buildMotionGraph(staggeredFadeCapture());

  it("classifies the trigger with confidence", () => {
    expect(graph.trigger).toBe("click");
    expect(graph.triggerConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it("creates one node per animated element with fade motion", () => {
    expect(graph.nodes).toHaveLength(3);
    for (const node of graph.nodes) {
      expect(node.motionTypes).toEqual(["fade"]);
      expect(node.changes).toHaveLength(1);
      expect(node.changes[0]).toMatchObject({ property: "opacity", from: "0", to: "1" });
    }
  });

  it("computes delay relative to the trigger event", () => {
    const delays = graph.nodes.map((node) => node.changes[0]!.delay).sort((a, b) => a - b);
    expect(delays).toEqual([70, 150, 230]);
  });

  it("detects the stagger sequence", () => {
    expect(graph.sequence.kind).toBe("stagger");
    expect(graph.sequence.staggerMs).toBe(80);
  });

  it("spans the full motion duration", () => {
    expect(graph.durationMs).toBe(410); // last change at t=460 minus trigger at t=50
  });

  it("links parent and child nodes by selector hierarchy", () => {
    const capture = staggeredFadeCapture();
    capture.frames.unshift(
      { timestamp: 0, selector: "ul", styles: { opacity: "0.5" } },
      { timestamp: 120, selector: "ul", styles: { opacity: "0.8" } },
      { timestamp: 140, selector: "ul", styles: { opacity: "1" } },
    );
    const withParent = buildMotionGraph(capture);

    const parent = withParent.nodes.find((node) => node.selector === "ul");
    const child = withParent.nodes.find((node) => node.selector === "ul > li:nth-of-type(1)");
    expect(parent).toBeDefined();
    expect(child?.parentId).toBe(parent?.id);
    expect(parent?.parentId).toBeNull();
  });
});
