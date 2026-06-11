/**
 * MotionGraph — the structured representation of a captured interaction.
 *
 * A MotionGraph describes what happens on a page when a trigger fires:
 * which elements animate, which properties change, with what timing and
 * easing, and how the animations relate to each other (parallel, staggered,
 * chained). It is the shared contract between the capture engine, the
 * analysis engine, the prompt generator, and the validation engine.
 */

export const MOTION_GRAPH_SCHEMA_VERSION = "0.2.0";

export type TriggerType = "hover" | "click" | "scroll" | "load" | "focus" | "mousemove";

/** High-level categories of motion, used by classifiers and prompts. */
export type MotionType =
  | "fade"
  | "scale"
  | "translate"
  | "rotate"
  | "blur"
  | "shadow"
  | "color"
  | "layout-shift";

/** How multiple animated elements relate in time. */
export type SequenceKind = "single" | "parallel" | "stagger" | "chained";

export interface SequenceInfo {
  kind: SequenceKind;
  /** Median delay between successive elements (stagger only). */
  staggerMs?: number;
  /** 0–1. */
  confidence: number;
}

export interface PropertyChange {
  /** CSS property name, e.g. "opacity" or "transform". */
  property: string;
  from: string;
  to: string;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds from trigger to first change. */
  delay: number;
  /** CSS easing string, e.g. "ease-out" or "cubic-bezier(0.4, 0, 0.2, 1)". */
  easing: string;
  /** Confidence in the easing fit, 0–1. */
  easingConfidence?: number;
}

export interface MotionGraphNode {
  /** Stable identifier within the graph. */
  id: string;
  /** CSS selector locating the element at capture time. */
  selector: string;
  /** Parent node id, or null for root nodes. */
  parentId: string | null;
  /** Motion categories detected for this element. */
  motionTypes: MotionType[];
  changes: PropertyChange[];
}

export interface MotionGraph {
  schemaVersion: string;
  /** URL of the page the interaction was captured on. */
  sourceUrl: string;
  trigger: TriggerType;
  /** Confidence in the trigger classification, 0–1. */
  triggerConfidence?: number;
  capturedAt: string;
  /** Total span of the motion, ms. */
  durationMs: number;
  sequence: SequenceInfo;
  nodes: MotionGraphNode[];
}

export function createEmptyMotionGraph(sourceUrl: string, trigger: TriggerType): MotionGraph {
  return {
    schemaVersion: MOTION_GRAPH_SCHEMA_VERSION,
    sourceUrl,
    trigger,
    capturedAt: new Date().toISOString(),
    durationMs: 0,
    sequence: { kind: "single", confidence: 1 },
    nodes: [],
  };
}
