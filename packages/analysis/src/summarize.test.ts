import { describe, expect, it } from "vitest";

import type { RawCapture } from "./capture/types";
import { detectTrigger, diffCapture } from "./summarize";

function capture(partial: Partial<RawCapture>): RawCapture {
  return {
    sourceUrl: "https://example.com",
    startedAt: new Date().toISOString(),
    durationMs: 1000,
    stopReason: "manual",
    observedElementCount: 1,
    frames: [],
    mutations: [],
    events: [],
    ...partial,
  };
}

describe("diffCapture", () => {
  it("summarizes baseline → final value with change timestamps", () => {
    const result = diffCapture(
      capture({
        frames: [
          { timestamp: 0, selector: "div > .card", styles: { opacity: "0", transform: "none" } },
          { timestamp: 120, selector: "div > .card", styles: { opacity: "0.4" } },
          { timestamp: 300, selector: "div > .card", styles: { opacity: "1" } },
        ],
      }),
    );

    expect(result).toEqual([
      {
        selector: "div > .card",
        property: "opacity",
        from: "0",
        to: "1",
        startMs: 120,
        endMs: 300,
        durationMs: 180,
      },
    ]);
  });

  it("ignores properties that never change and values that revert to baseline", () => {
    const result = diffCapture(
      capture({
        frames: [
          { timestamp: 0, selector: ".a", styles: { opacity: "1" } },
          { timestamp: 100, selector: ".a", styles: { opacity: "0.5" } },
          { timestamp: 200, selector: ".a", styles: { opacity: "1" } },
        ],
      }),
    );

    expect(result).toEqual([]);
  });

  it("keeps selectors containing spaces intact", () => {
    const selector = "main > section:nth-of-type(2) > div";
    const result = diffCapture(
      capture({
        frames: [
          { timestamp: 0, selector, styles: { color: "rgb(0, 0, 0)" } },
          { timestamp: 50, selector, styles: { color: "rgb(255, 0, 0)" } },
        ],
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.selector).toBe(selector);
    expect(result[0]?.property).toBe("color");
  });
});

describe("detectTrigger", () => {
  const frames = [
    { timestamp: 0, selector: ".a", styles: { opacity: "0" } },
    { timestamp: 150, selector: ".a", styles: { opacity: "1" } },
  ];

  it("attributes motion to the most recent event before the first change", () => {
    const result = detectTrigger(
      capture({
        frames,
        events: [
          { timestamp: 40, type: "pointerover" },
          { timestamp: 90, type: "click" },
          { timestamp: 400, type: "scroll" },
        ],
      }),
    );

    expect(result).toBe("click");
  });

  it("falls back to load when no event precedes the change", () => {
    expect(detectTrigger(capture({ frames }))).toBe("load");
  });

  it("falls back to load when nothing changed", () => {
    expect(detectTrigger(capture({ events: [{ timestamp: 10, type: "click" }] }))).toBe("load");
  });
});
