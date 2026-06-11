/**
 * Raw capture data structures — the unprocessed output of a recording
 * session, consumed by the analysis pipeline (Phase 6+).
 *
 * All timestamps are milliseconds relative to recording start.
 */

/** Computed style properties tracked during recording. */
export const TRACKED_PROPERTIES = [
  "transform",
  "opacity",
  "filter",
  "box-shadow",
  "color",
  "background-color",
  "width",
  "height",
  "top",
  "left",
  "translate",
  "scale",
  "rotate",
] as const;

export type TrackedProperty = (typeof TRACKED_PROPERTIES)[number];

/**
 * One element's style values at one point in time. The first frame for a
 * selector is a full baseline snapshot; subsequent frames contain only the
 * properties that changed since that element's previous frame.
 */
export interface CaptureFrame {
  timestamp: number;
  selector: string;
  styles: Record<string, string>;
}

/** A DOM mutation observed during recording. */
export interface CaptureMutation {
  timestamp: number;
  kind: "childList" | "attributes" | "characterData";
  /** Selector of the mutation target (or its nearest element). */
  selector: string;
  attribute?: string;
}

/** A user-interaction event observed (passively) during recording. */
export interface CaptureEvent {
  timestamp: number;
  type: "click" | "pointerdown" | "pointerover" | "scroll" | "focusin" | "keydown";
  selector?: string;
}

export interface RawCapture {
  sourceUrl: string;
  startedAt: string;
  durationMs: number;
  /** Why the recording ended. */
  stopReason: "manual" | "timeout" | "frame-limit";
  /** Number of elements that were being observed. */
  observedElementCount: number;
  frames: CaptureFrame[];
  mutations: CaptureMutation[];
  events: CaptureEvent[];
}
