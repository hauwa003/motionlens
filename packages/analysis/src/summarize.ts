import type { TriggerType } from "@motionlens/motion-graph";

import type { CaptureEvent, RawCapture } from "./capture/types";

/**
 * Pure analysis helpers over a RawCapture — property change summaries and
 * basic trigger detection. Phase 6 builds the full MotionGraph on top.
 */

export interface PropertyChangeSummary {
  selector: string;
  property: string;
  /** Baseline value at recording start (or first seen). */
  from: string;
  /** Final value. */
  to: string;
  /** When the value first changed, ms from recording start. */
  startMs: number;
  /** When the value last changed, ms from recording start. */
  endMs: number;
  durationMs: number;
}

/**
 * Collapse raw frames into one summary per (element, property) that actually
 * changed: baseline value → final value with first/last change timestamps.
 */
export function diffCapture(capture: RawCapture): PropertyChangeSummary[] {
  interface Track {
    from: string;
    to: string;
    startMs: number | null;
    endMs: number;
    hasBaseline: boolean;
  }

  const tracks = new Map<string, Track>();

  for (const frame of capture.frames) {
    for (const [property, value] of Object.entries(frame.styles)) {
      const key = `${frame.selector}\u0000${property}`;
      const track = tracks.get(key);

      if (!track) {
        // First sighting — the baseline frame at t≈0, or an element that
        // appeared mid-recording.
        tracks.set(key, {
          from: value,
          to: value,
          startMs: null,
          endMs: frame.timestamp,
          hasBaseline: true,
        });
        continue;
      }

      if (value !== track.to) {
        track.startMs ??= frame.timestamp;
        track.endMs = frame.timestamp;
        track.to = value;
      }
    }
  }

  const summaries: PropertyChangeSummary[] = [];
  for (const [key, track] of tracks) {
    if (track.startMs === null || track.from === track.to) continue;
    const [selector, property] = key.split("\u0000") as [string, string];
    summaries.push({
      selector,
      property,
      from: track.from,
      to: track.to,
      startMs: track.startMs,
      endMs: track.endMs,
      durationMs: track.endMs - track.startMs,
    });
  }

  summaries.sort((a, b) => a.startMs - b.startMs || a.selector.localeCompare(b.selector));
  return summaries;
}

const EVENT_TO_TRIGGER: Partial<Record<CaptureEvent["type"], TriggerType>> = {
  click: "click",
  pointerdown: "click",
  pointerover: "hover",
  scroll: "scroll",
  focusin: "focus",
};

/**
 * Basic trigger detection: the most recent user event preceding the first
 * style change. No qualifying event means the motion started on its own
 * (page load / autonomous animation).
 */
export function detectTrigger(capture: RawCapture): TriggerType {
  const changes = diffCapture(capture);
  const first = changes[0];
  if (!first) return "load";

  let trigger: TriggerType | null = null;
  for (const event of capture.events) {
    if (event.timestamp > first.startMs) break;
    trigger = EVENT_TO_TRIGGER[event.type] ?? trigger;
  }

  return trigger ?? "load";
}
