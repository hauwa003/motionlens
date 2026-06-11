import {
  MOTION_GRAPH_SCHEMA_VERSION,
  type MotionGraph,
  type MotionGraphNode,
  type PropertyChange,
} from "@motionlens/motion-graph";

import type { RawCapture } from "./capture/types";
import { classifyMotionTypes, classifySequence } from "./classify";
import { fitEasing } from "./easing";
import { classifyTrigger, diffCapture } from "./summarize";

/**
 * MotionGraph builder (Phase 6) — transforms a RawCapture into the structured
 * graph: nodes per element, property changes with timing and fitted easing,
 * element hierarchy, and sequence classification.
 */

/** True if `child` is a descendant of `parent` going by selector paths. */
function isDescendantSelector(child: string, parent: string): boolean {
  return child !== parent && child.startsWith(`${parent} > `);
}

export function buildMotionGraph(capture: RawCapture): MotionGraph {
  const trigger = classifyTrigger(capture);
  const changes = diffCapture(capture);

  // Group property changes by element.
  const bySelector = new Map<string, typeof changes>();
  for (const change of changes) {
    const list = bySelector.get(change.selector) ?? [];
    list.push(change);
    bySelector.set(change.selector, list);
  }

  const selectors = Array.from(bySelector.keys());
  const idBySelector = new Map(selectors.map((selector, index) => [selector, `n${index + 1}`]));

  const nodes: MotionGraphNode[] = [];
  const timings: Array<{ startMs: number; endMs: number }> = [];
  let graphEndMs = 0;

  for (const selector of selectors) {
    const elementChanges = bySelector.get(selector)!;

    const propertyChanges: PropertyChange[] = elementChanges.map((change) => {
      const easing = fitEasing(change.samples);
      return {
        property: change.property,
        from: change.from,
        to: change.to,
        duration: change.durationMs,
        delay: Math.max(0, change.startMs - trigger.eventMs),
        easing: easing.easing,
        easingConfidence: easing.confidence,
      };
    });

    // Parent: the longest other animated selector this one descends from.
    let parentSelector: string | null = null;
    for (const candidate of selectors) {
      if (!isDescendantSelector(selector, candidate)) continue;
      if (!parentSelector || candidate.length > parentSelector.length) {
        parentSelector = candidate;
      }
    }

    const startMs = Math.min(...elementChanges.map((c) => c.startMs)) - trigger.eventMs;
    const endMs = Math.max(...elementChanges.map((c) => c.endMs)) - trigger.eventMs;
    timings.push({ startMs: Math.max(0, startMs), endMs: Math.max(0, endMs) });
    graphEndMs = Math.max(graphEndMs, endMs);

    nodes.push({
      id: idBySelector.get(selector)!,
      selector,
      parentId: parentSelector ? (idBySelector.get(parentSelector) ?? null) : null,
      motionTypes: classifyMotionTypes(elementChanges),
      changes: propertyChanges,
    });
  }

  return {
    schemaVersion: MOTION_GRAPH_SCHEMA_VERSION,
    sourceUrl: capture.sourceUrl,
    trigger: trigger.trigger,
    triggerConfidence: trigger.confidence,
    capturedAt: capture.startedAt,
    durationMs: Math.max(0, Math.round(graphEndMs)),
    sequence: classifySequence(timings),
    nodes,
  };
}
