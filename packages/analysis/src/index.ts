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
export { AmbientObserver } from "./capture/ambient-observer";
export type { AmbientBurst, AmbientObserverOptions } from "./capture/ambient-types";
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
export {
  DOM_MARKER_SELECTORS,
  GLOBAL_PROBES,
  scoreFrameworks,
  type FrameworkScore,
  type FrameworkSignals,
} from "./frameworks";
