/**
 * Analysis engine — transforms raw capture data into a structured MotionGraph.
 *
 * Phase 1 scaffold: defines the raw capture data shapes the capture engine
 * (Phase 4) will produce and the analysis entry point (Phase 6) will consume.
 */

import {
  createEmptyMotionGraph,
  type MotionGraph,
  type TriggerType,
} from "@motionlens/motion-graph";

/** A single computed-style snapshot of one element at one point in time. */
export interface CaptureFrame {
  /** Milliseconds since recording started. */
  timestamp: number;
  /** CSS selector of the observed element. */
  selector: string;
  /** Computed style values keyed by property name. */
  styles: Record<string, string>;
}

export interface RawCapture {
  sourceUrl: string;
  trigger: TriggerType;
  startedAt: string;
  frames: CaptureFrame[];
}

/**
 * Build a MotionGraph from raw capture frames.
 *
 * Phase 6 will implement frame diffing, duration/delay derivation, and
 * element hierarchy construction. For now this returns an empty graph so
 * downstream packages can compile against the real signature.
 */
export function buildMotionGraph(capture: RawCapture): MotionGraph {
  return createEmptyMotionGraph(capture.sourceUrl, capture.trigger);
}
