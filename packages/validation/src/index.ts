/**
 * Validation engine (Phase 14) — compares the original MotionGraph against a
 * recreation and produces a weighted match score, a difference report, and
 * concrete improvement suggestions.
 */

import { cubicBezierAt, scalarMetric } from "@motionlens/analysis";
import type { MotionGraph, MotionGraphNode, PropertyChange } from "@motionlens/motion-graph";

/** Category weights for the overall match score (must sum to 1). */
export const SCORE_WEIGHTS = {
  timing: 0.3,
  easing: 0.3,
  spatial: 0.25,
  visual: 0.15,
} as const;

export type ScoreCategory = keyof typeof SCORE_WEIGHTS;

export interface Difference {
  category: ScoreCategory;
  /** Selector of the original element. */
  selector: string;
  property: string;
  message: string;
  /** How far off, 0 (perfect) – 1 (completely different). */
  severity: number;
}

export interface MatchScore {
  /** 0–100 per category. */
  categories: Record<ScoreCategory, number>;
  /** Weighted overall score, 0–100. */
  overall: number;
  differences: Difference[];
  suggestions: string[];
}

const SPATIAL_PROPERTIES = new Set([
  "transform",
  "translate",
  "scale",
  "rotate",
  "width",
  "height",
  "top",
  "left",
]);

/** 1 when equal, → 0 as values diverge relative to their magnitude. */
function relativeCloseness(a: number, b: number): number {
  if (a === b) return 1;
  const denominator = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.max(0, 1 - Math.abs(a - b) / denominator);
}

function valueCloseness(a: string, b: string): number {
  if (a === b) return 1;
  const metricA = scalarMetric(a);
  const metricB = scalarMetric(b);
  if (metricA === null || metricB === null) return 0;
  return relativeCloseness(metricA, metricB);
}

const NAMED_BEZIERS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function bezierFor(easing: string): [number, number, number, number] | null {
  const named = NAMED_BEZIERS[easing];
  if (named) return named;
  const numbers = easing.match(/-?\d*\.?\d+/g)?.map(Number);
  return numbers?.length === 4 ? (numbers as [number, number, number, number]) : null;
}

/** Compare two easings by sampling their curves. 1 = identical shape. */
export function easingCloseness(a: string, b: string): number {
  if (a === b) return 1;
  const bezierA = bezierFor(a);
  const bezierB = bezierFor(b);
  if (!bezierA || !bezierB) return 0.5;

  let sum = 0;
  const STEPS = 16;
  for (let i = 1; i < STEPS; i++) {
    const x = i / STEPS;
    sum += Math.abs(cubicBezierAt(x, bezierA) - cubicBezierAt(x, bezierB));
  }
  const meanError = sum / (STEPS - 1);
  return Math.max(0, 1 - meanError * 4);
}

interface PairedChange {
  selector: string;
  original: PropertyChange;
  recreation: PropertyChange;
}

/**
 * Pair nodes between the two graphs by animation order (start time), then
 * pair changes within each node by property name.
 */
function pairChanges(
  original: MotionGraph,
  recreation: MotionGraph,
): {
  pairs: PairedChange[];
  unmatched: Array<{ node: MotionGraphNode; change: PropertyChange }>;
} {
  const byStart = (graph: MotionGraph) =>
    [...graph.nodes].sort(
      (a, b) =>
        Math.min(...a.changes.map((c) => c.delay)) - Math.min(...b.changes.map((c) => c.delay)),
    );

  const originalNodes = byStart(original);
  const recreationNodes = byStart(recreation);

  const pairs: PairedChange[] = [];
  const unmatched: Array<{ node: MotionGraphNode; change: PropertyChange }> = [];

  originalNodes.forEach((node, index) => {
    const counterpart = recreationNodes[index];
    for (const change of node.changes) {
      const match = counterpart?.changes.find((c) => c.property === change.property);
      if (match) {
        pairs.push({ selector: node.selector, original: change, recreation: match });
      } else {
        unmatched.push({ node, change });
      }
    }
  });

  return { pairs, unmatched };
}

export function compareGraphs(original: MotionGraph, recreation: MotionGraph): MatchScore {
  const { pairs, unmatched } = pairChanges(original, recreation);

  const buckets: Record<ScoreCategory, number[]> = {
    timing: [],
    easing: [],
    spatial: [],
    visual: [],
  };
  const differences: Difference[] = [];
  const suggestions: string[] = [];

  const note = (
    category: ScoreCategory,
    selector: string,
    property: string,
    closeness: number,
    message: string,
    suggestion?: string,
  ) => {
    buckets[category].push(closeness);
    if (closeness < 0.9) {
      differences.push({ category, selector, property, message, severity: 1 - closeness });
      if (suggestion) suggestions.push(suggestion);
    }
  };

  for (const { selector, original: a, recreation: b } of pairs) {
    const durationCloseness = relativeCloseness(a.duration, b.duration);
    note(
      "timing",
      selector,
      a.property,
      durationCloseness,
      `duration is ${b.duration}ms, original is ${a.duration}ms`,
      durationCloseness < 0.9
        ? `Set ${a.property} duration on \`${selector}\` to ${a.duration}ms (currently ${b.duration}ms).`
        : undefined,
    );

    const delayCloseness = a.delay === 0 && b.delay === 0 ? 1 : relativeCloseness(a.delay, b.delay);
    note(
      "timing",
      selector,
      a.property,
      delayCloseness,
      `delay is ${b.delay}ms, original is ${a.delay}ms`,
      delayCloseness < 0.9
        ? `Set ${a.property} delay on \`${selector}\` to ${a.delay}ms (currently ${b.delay}ms).`
        : undefined,
    );

    const easeCloseness = easingCloseness(a.easing, b.easing);
    note(
      "easing",
      selector,
      a.property,
      easeCloseness,
      `easing is \`${b.easing}\`, original is \`${a.easing}\``,
      easeCloseness < 0.9
        ? `Use \`${a.easing}\` easing for ${a.property} on \`${selector}\`.`
        : undefined,
    );

    const category: ScoreCategory = SPATIAL_PROPERTIES.has(a.property) ? "spatial" : "visual";
    const endCloseness = valueCloseness(a.to, b.to);
    const startCloseness = valueCloseness(a.from, b.from);
    note(
      category,
      selector,
      a.property,
      (endCloseness + startCloseness) / 2,
      `values go \`${b.from}\` → \`${b.to}\`, original goes \`${a.from}\` → \`${a.to}\``,
      endCloseness < 0.9
        ? `End ${a.property} on \`${selector}\` at \`${a.to}\` (currently \`${b.to}\`).`
        : undefined,
    );
  }

  for (const { node, change } of unmatched) {
    const category: ScoreCategory = SPATIAL_PROPERTIES.has(change.property) ? "spatial" : "visual";
    buckets[category].push(0);
    buckets.timing.push(0);
    differences.push({
      category,
      selector: node.selector,
      property: change.property,
      message: `missing in recreation: ${change.property} (${change.from} → ${change.to})`,
      severity: 1,
    });
    suggestions.push(
      `Animate ${change.property} on \`${node.selector}\` from \`${change.from}\` to \`${change.to}\`.`,
    );
  }

  const categories = Object.fromEntries(
    (Object.keys(SCORE_WEIGHTS) as ScoreCategory[]).map((category) => {
      const values = buckets[category];
      const average =
        values.length === 0 ? 1 : values.reduce((sum, value) => sum + value, 0) / values.length;
      return [category, Math.round(average * 100)];
    }),
  ) as Record<ScoreCategory, number>;

  const overall = Math.round(
    (Object.keys(SCORE_WEIGHTS) as ScoreCategory[]).reduce(
      (sum, category) => sum + categories[category] * SCORE_WEIGHTS[category],
      0,
    ),
  );

  differences.sort((a, b) => b.severity - a.severity);
  return { categories, overall, differences, suggestions };
}
