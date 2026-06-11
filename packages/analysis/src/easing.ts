import type { ValueSample } from "./summarize";

/**
 * Easing detection — fit a captured value curve to known easing functions.
 *
 * The curve is normalized to (t, v) in [0,1]² using a scalar metric extracted
 * from the CSS values, then compared against candidate cubic-béziers by RMSE.
 */

export interface EasingFit {
  /** CSS easing string. */
  easing: string;
  /** 0–1, derived from the fit error. */
  confidence: number;
}

const CANDIDATES: Array<{ name: string; bezier: [number, number, number, number] }> = [
  { name: "linear", bezier: [0, 0, 1, 1] },
  { name: "ease", bezier: [0.25, 0.1, 0.25, 1] },
  { name: "ease-in", bezier: [0.42, 0, 1, 1] },
  { name: "ease-out", bezier: [0, 0, 0.58, 1] },
  { name: "ease-in-out", bezier: [0.42, 0, 0.58, 1] },
  // Common design-system curve (Tailwind/Material "standard").
  { name: "cubic-bezier(0.4, 0, 0.2, 1)", bezier: [0.4, 0, 0.2, 1] },
];

/** Evaluate a CSS cubic-bézier easing at progress x ∈ [0,1] via bisection. */
export function cubicBezierAt(
  x: number,
  [x1, y1, x2, y2]: [number, number, number, number],
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const sample = (u: number, a: number, b: number) =>
    3 * u * (1 - u) * (1 - u) * a + 3 * u * u * (1 - u) * b + u * u * u;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (sample(mid, x1, x2) < x) lo = mid;
    else hi = mid;
  }
  const u = (lo + hi) / 2;
  return sample(u, y1, y2);
}

/**
 * Extract a scalar progress metric from a CSS value: the Euclidean norm of
 * every number it contains. Monotonic for single-axis animations (opacity,
 * sizes, translations, blur radii); colors and mixed transforms fall back to
 * a low-confidence linear fit naturally via high RMSE.
 */
export function scalarMetric(value: string): number | null {
  const numbers = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!numbers || numbers.length === 0) return null;
  return Math.hypot(...numbers.map(Number));
}

const MIN_SAMPLES = 4;
const LOW_CONFIDENCE_FALLBACK: EasingFit = { easing: "ease", confidence: 0.3 };

export function fitEasing(samples: ValueSample[]): EasingFit {
  if (samples.length < MIN_SAMPLES) return LOW_CONFIDENCE_FALLBACK;

  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const v0 = scalarMetric(first.value);
  const v1 = scalarMetric(last.value);
  if (v0 === null || v1 === null || v0 === v1) return LOW_CONFIDENCE_FALLBACK;

  const t0 = samples[1]!.timestamp; // first actual change
  const t1 = last.timestamp;
  if (t1 <= t0) return LOW_CONFIDENCE_FALLBACK;

  const points: Array<{ t: number; v: number }> = [];
  for (const sample of samples.slice(1)) {
    const metric = scalarMetric(sample.value);
    if (metric === null) continue;
    points.push({ t: (sample.timestamp - t0) / (t1 - t0), v: (metric - v0) / (v1 - v0) });
  }
  if (points.length < MIN_SAMPLES - 1) return LOW_CONFIDENCE_FALLBACK;

  let best: { name: string; rmse: number } | null = null;
  for (const { name, bezier } of CANDIDATES) {
    let sum = 0;
    for (const point of points) {
      const expected = cubicBezierAt(point.t, bezier);
      sum += (point.v - expected) ** 2;
    }
    const rmse = Math.sqrt(sum / points.length);
    if (!best || rmse < best.rmse) best = { name, rmse };
  }

  // rmse 0 → 1.0 confidence; rmse ≥ 0.25 → ~0.
  const confidence = Math.max(0, Math.min(1, 1 - best!.rmse * 4));
  if (confidence < 0.3) return LOW_CONFIDENCE_FALLBACK;
  return { easing: best!.name, confidence: Number(confidence.toFixed(2)) };
}
