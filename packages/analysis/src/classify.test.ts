import { describe, expect, it } from "vitest";

import { classifyMotionTypes, classifySequence, decomposeMatrix } from "./classify";

describe("decomposeMatrix", () => {
  it("extracts translation, scale, and rotation", () => {
    const result = decomposeMatrix("matrix(1, 0, 0, 1, 24, -8)");
    expect(result).toMatchObject({ scaleX: 1, scaleY: 1, tx: 24, ty: -8 });
    expect(result?.rotationDeg).toBeCloseTo(0);
  });

  it("returns null for non-matrix values", () => {
    expect(decomposeMatrix("none")).toBeNull();
  });
});

describe("classifyMotionTypes", () => {
  it("classifies common motion categories", () => {
    const types = classifyMotionTypes([
      { property: "opacity", from: "0", to: "1" },
      { property: "transform", from: "matrix(1, 0, 0, 1, 0, 0)", to: "matrix(1, 0, 0, 1, 0, -12)" },
      { property: "box-shadow", from: "none", to: "rgb(0, 0, 0) 0px 8px 24px 0px" },
      { property: "background-color", from: "rgb(0, 0, 0)", to: "rgb(40, 40, 40)" },
    ]);

    expect(types).toEqual(expect.arrayContaining(["fade", "translate", "shadow", "color"]));
    expect(types).not.toContain("scale");
  });

  it("detects scale and rotation from matrices", () => {
    const types = classifyMotionTypes([
      {
        property: "transform",
        from: "matrix(1, 0, 0, 1, 0, 0)",
        to: "matrix(1.05, 0.1, -0.1, 1.05, 0, 0)",
      },
    ]);
    expect(types).toContain("scale");
    expect(types).toContain("rotate");
  });

  it("flags blur only when the filter actually blurs", () => {
    expect(classifyMotionTypes([{ property: "filter", from: "none", to: "blur(4px)" }])).toContain(
      "blur",
    );
    expect(classifyMotionTypes([{ property: "filter", from: "none", to: "grayscale(1)" }])).toEqual(
      [],
    );
  });
});

describe("classifySequence", () => {
  it("classifies a single element", () => {
    expect(classifySequence([{ startMs: 0, endMs: 300 }]).kind).toBe("single");
  });

  it("classifies simultaneous starts as parallel", () => {
    const result = classifySequence([
      { startMs: 0, endMs: 300 },
      { startMs: 10, endMs: 280 },
      { startMs: 20, endMs: 310 },
    ]);
    expect(result.kind).toBe("parallel");
  });

  it("classifies regular offsets as stagger with the right interval", () => {
    const result = classifySequence([
      { startMs: 0, endMs: 400 },
      { startMs: 80, endMs: 480 },
      { startMs: 160, endMs: 560 },
      { startMs: 240, endMs: 640 },
    ]);
    expect(result.kind).toBe("stagger");
    expect(result.staggerMs).toBe(80);
  });

  it("classifies sequential, non-overlapping animations as chained", () => {
    const result = classifySequence([
      { startMs: 0, endMs: 200 },
      { startMs: 200, endMs: 500 },
      { startMs: 510, endMs: 700 },
    ]);
    expect(result.kind).toBe("chained");
  });
});
