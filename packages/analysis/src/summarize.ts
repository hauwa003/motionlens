import type { TriggerType } from "@motionlens/motion-graph";

import type { CaptureEvent, RawCapture } from "./capture/types";

/**
 * Pure analysis helpers over a RawCapture — property change summaries and
 * trigger detection. The MotionGraph builder (Phase 6) composes these.
 */

export interface ValueSample {
  /** Ms from recording start. */
  timestamp: number;
  value: string;
}

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
  /** Every observed value, baseline included, in capture order. */
  samples: ValueSample[];
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
    samples: ValueSample[];
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
          samples: [{ timestamp: frame.timestamp, value }],
        });
        continue;
      }

      if (value !== track.to) {
        track.startMs ??= frame.timestamp;
        track.endMs = frame.timestamp;
        track.to = value;
        track.samples.push({ timestamp: frame.timestamp, value });
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
      samples: track.samples,
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

export interface TriggerClassification {
  trigger: TriggerType;
  /** 0–1. */
  confidence: number;
  /** Timestamp of the triggering event, ms from recording start. */
  eventMs: number;
}

/**
 * Trigger classification: the most recent user event preceding the first
 * style change, with confidence based on how close it was. No qualifying
 * event means the motion started on its own (page load / autonomous).
 */
export function classifyTrigger(capture: RawCapture): TriggerClassification {
  const changes = diffCapture(capture);
  const first = changes[0];
  if (!first) return { trigger: "load", confidence: 0.5, eventMs: 0 };

  let match: { trigger: TriggerType; timestamp: number } | null = null;
  for (const event of capture.events) {
    if (event.timestamp > first.startMs) break;
    const trigger = EVENT_TO_TRIGGER[event.type];
    if (trigger) match = { trigger, timestamp: event.timestamp };
  }

  if (!match) return { trigger: "load", confidence: 0.6, eventMs: 0 };

  const gap = first.startMs - match.timestamp;
  const confidence = gap <= 300 ? 0.9 : gap <= 1000 ? 0.7 : 0.5;
  return { trigger: match.trigger, confidence, eventMs: match.timestamp };
}

/** Backwards-compatible helper: just the trigger type. */
export function detectTrigger(capture: RawCapture): TriggerType {
  return classifyTrigger(capture).trigger;
}
