import type { MotionType, SequenceInfo } from "@motionlens/motion-graph";

/**
 * Motion and sequence classifiers (Phase 7).
 */

/** Parse a CSS `matrix(a, b, c, d, tx, ty)` into its affine components. */
export function decomposeMatrix(value: string): {
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  tx: number;
  ty: number;
} | null {
  const match = value.match(/matrix\(([^)]+)\)/);
  if (!match) return null;
  const [a, b, c, d, tx, ty] = match[1]!.split(",").map((n) => parseFloat(n.trim()));
  if ([a, b, c, d, tx, ty].some((n) => n === undefined || Number.isNaN(n))) return null;
  return {
    scaleX: Math.hypot(a!, b!),
    scaleY: Math.hypot(c!, d!),
    rotationDeg: (Math.atan2(b!, a!) * 180) / Math.PI,
    tx: tx!,
    ty: ty!,
  };
}

interface ChangeLike {
  property: string;
  from: string;
  to: string;
}

const EPSILON = 0.001;

/** Which motion categories a set of property changes represents. */
export function classifyMotionTypes(changes: ChangeLike[]): MotionType[] {
  const types = new Set<MotionType>();

  for (const change of changes) {
    switch (change.property) {
      case "opacity":
        types.add("fade");
        break;
      case "transform": {
        const from = decomposeMatrix(change.from);
        const to = decomposeMatrix(change.to);
        if (!from || !to) {
          // "none" → matrix, or non-matrix values: inspect keywords.
          if (/scale/.test(change.to + change.from)) types.add("scale");
          else if (/rotate/.test(change.to + change.from)) types.add("rotate");
          else types.add("translate");
          break;
        }
        if (
          Math.abs(from.scaleX - to.scaleX) > EPSILON ||
          Math.abs(from.scaleY - to.scaleY) > EPSILON
        ) {
          types.add("scale");
        }
        if (Math.abs(from.rotationDeg - to.rotationDeg) > 0.5) types.add("rotate");
        if (Math.abs(from.tx - to.tx) > EPSILON || Math.abs(from.ty - to.ty) > EPSILON) {
          types.add("translate");
        }
        break;
      }
      case "translate":
        types.add("translate");
        break;
      case "scale":
        types.add("scale");
        break;
      case "rotate":
        types.add("rotate");
        break;
      case "filter":
        if (/blur/.test(change.from + change.to)) types.add("blur");
        break;
      case "box-shadow":
        types.add("shadow");
        break;
      case "color":
      case "background-color":
        types.add("color");
        break;
      case "width":
      case "height":
      case "top":
      case "left":
        types.add("layout-shift");
        break;
    }
  }

  return Array.from(types);
}

export interface NodeTiming {
  /** Ms from trigger to the node's first change. */
  startMs: number;
  /** Ms from trigger to the node's last change. */
  endMs: number;
}

const PARALLEL_TOLERANCE_MS = 40;
const CHAIN_OVERLAP_MS = 30;

/** How multiple animated elements relate in time. */
export function classifySequence(timings: NodeTiming[]): SequenceInfo {
  if (timings.length <= 1) return { kind: "single", confidence: 1 };

  const sorted = [...timings].sort((a, b) => a.startMs - b.startMs);
  const starts = sorted.map((t) => t.startMs);
  const spread = starts[starts.length - 1]! - starts[0]!;

  if (spread <= PARALLEL_TOLERANCE_MS) {
    return { kind: "parallel", confidence: 0.9 };
  }

  // Chained: each element starts only after the previous one ends.
  const chained = sorted.every(
    (timing, index) => index === 0 || timing.startMs >= sorted[index - 1]!.endMs - CHAIN_OVERLAP_MS,
  );
  if (chained) return { kind: "chained", confidence: 0.8 };

  // Stagger: regular gaps between successive starts.
  const gaps = starts.slice(1).map((start, index) => start - starts[index]!);
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
  const regular = mean > 0 && Math.sqrt(variance) / mean < 0.5;

  if (regular) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const staggerMs = Math.round(sortedGaps[Math.floor(sortedGaps.length / 2)]!);
    return { kind: "stagger", staggerMs, confidence: 0.8 };
  }

  return { kind: "stagger", staggerMs: Math.round(mean), confidence: 0.4 };
}
