/**
 * Analysis engine — records interactions on the live page and transforms the
 * raw capture data into a structured MotionGraph.
 */

export {
  TRACKED_PROPERTIES,
  type CaptureEvent,
  type CaptureFrame,
  type CaptureMutation,
  type RawCapture,
  type TrackedProperty,
} from "./capture/types";
export { CaptureRecorder, type RecorderOptions } from "./capture/recorder";
export {
  classifyTrigger,
  detectTrigger,
  diffCapture,
  type PropertyChangeSummary,
  type TriggerClassification,
  type ValueSample,
} from "./summarize";
export { cubicBezierAt, fitEasing, scalarMetric, type EasingFit } from "./easing";
export {
  classifyMotionTypes,
  classifySequence,
  decomposeMatrix,
  type NodeTiming,
} from "./classify";
export { buildMotionGraph } from "./builder";
