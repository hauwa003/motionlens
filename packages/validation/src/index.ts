/**
 * Validation engine — compares the original MotionGraph against a recreation
 * and produces a weighted match score.
 *
 * Phase 1 scaffold: defines the score shape and category weights from the
 * roadmap. Phase 14 implements the real comparison algorithm.
 */

import type { MotionGraph } from "@motionlens/motion-graph";

/** Category weights for the overall match score (must sum to 1). */
export const SCORE_WEIGHTS = {
  timing: 0.3,
  easing: 0.3,
  spatial: 0.25,
  visual: 0.15,
} as const;

export type ScoreCategory = keyof typeof SCORE_WEIGHTS;

export interface MatchScore {
  /** 0–100 per category. */
  categories: Record<ScoreCategory, number>;
  /** Weighted overall score, 0–100. */
  overall: number;
}

/**
 * Compare an original capture against a recreation.
 *
 * Placeholder implementation: returns a zero score with the correct shape so
 * the UI and prompt layers can compile against the real signature. Phase 14
 * implements timing, easing, spatial, and visual comparison.
 */
export function compareGraphs(original: MotionGraph, recreation: MotionGraph): MatchScore {
  void original;
  void recreation;

  const categories: Record<ScoreCategory, number> = {
    timing: 0,
    easing: 0,
    spatial: 0,
    visual: 0,
  };

  const overall = (Object.keys(categories) as ScoreCategory[]).reduce(
    (sum, category) => sum + categories[category] * SCORE_WEIGHTS[category],
    0,
  );

  return { categories, overall };
}
