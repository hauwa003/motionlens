/**
 * MotionGraph — the structured representation of a captured interaction.
 *
 * A MotionGraph describes what happens on a page when a trigger fires:
 * which elements animate, which properties change, with what timing and easing.
 * It is the shared contract between the capture engine, the analysis engine,
 * the prompt generator, and the validation engine.
 */

export const MOTION_GRAPH_SCHEMA_VERSION = "0.1.0";

export type TriggerType = "hover" | "click" | "scroll" | "load" | "focus" | "mousemove";

export type AnimatableProperty =
  | "opacity"
  | "transform"
  | "filter"
  | "box-shadow"
  | "color"
  | "background-color"
  | "width"
  | "height"
  | "top"
  | "left";

export interface PropertyChange {
  property: AnimatableProperty;
  from: string;
  to: string;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds from trigger to first change. */
  delay: number;
  /** CSS easing string, e.g. "ease-out" or "cubic-bezier(0.4, 0, 0.2, 1)". */
  easing: string;
}

export interface MotionGraphNode {
  /** Stable identifier within the graph. */
  id: string;
  /** CSS selector locating the element at capture time. */
  selector: string;
  /** Parent node id, or null for root nodes. */
  parentId: string | null;
  changes: PropertyChange[];
}

export interface MotionGraph {
  schemaVersion: string;
  /** URL of the page the interaction was captured on. */
  sourceUrl: string;
  trigger: TriggerType;
  capturedAt: string;
  nodes: MotionGraphNode[];
}

export function createEmptyMotionGraph(sourceUrl: string, trigger: TriggerType): MotionGraph {
  return {
    schemaVersion: MOTION_GRAPH_SCHEMA_VERSION,
    sourceUrl,
    trigger,
    capturedAt: new Date().toISOString(),
    nodes: [],
  };
}
