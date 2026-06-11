/**
 * Analysis engine — records interactions on the live page and transforms the
 * raw capture data into a structured MotionGraph.
 */

import { createEmptyMotionGraph, type MotionGraph } from "@motionlens/motion-graph";

import type { RawCapture } from "./capture/types";
import { detectTrigger } from "./summarize";

export {
  TRACKED_PROPERTIES,
  type CaptureEvent,
  type CaptureFrame,
  type CaptureMutation,
  type RawCapture,
  type TrackedProperty,
} from "./capture/types";
export { CaptureRecorder, type RecorderOptions } from "./capture/recorder";
export { detectTrigger, diffCapture, type PropertyChangeSummary } from "./summarize";

/**
 * Build a MotionGraph from raw capture frames.
 *
 * Phase 6 will implement frame-to-node transformation, duration/delay
 * derivation, and element hierarchy construction. For now this returns an
 * empty graph with the detected trigger so downstream packages can compile
 * against the real signature.
 */
export function buildMotionGraph(capture: RawCapture): MotionGraph {
  return createEmptyMotionGraph(capture.sourceUrl, detectTrigger(capture));
}
