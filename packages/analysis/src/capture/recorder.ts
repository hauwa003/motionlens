import {
  TRACKED_PROPERTIES,
  type CaptureEvent,
  type CaptureFrame,
  type CaptureMutation,
  type RawCapture,
} from "./types";

/**
 * CaptureRecorder — records computed-style changes, DOM mutations, and user
 * events for a set of root elements (and their descendants) on the live page.
 *
 * Strictly read-only: observation only, via getComputedStyle, MutationObserver,
 * and passive event listeners.
 *
 * Performance guards: element cap, frame cap, and a hard duration limit.
 */

export interface RecorderOptions {
  /** Selected elements to observe (descendants are included automatically). */
  roots: Element[];
  /** Build a stable selector for an element (provided by the caller). */
  buildSelector: (element: Element) => string;
  /** Hard stop after this long. Default 10s. */
  maxDurationMs?: number;
  /** Cap on observed elements (roots + descendants). Default 150. */
  maxElements?: number;
  /** Cap on stored frames. Default 20,000. */
  maxFrames?: number;
  /** Called when the recorder stops itself (timeout or frame limit). */
  onAutoStop?: (capture: RawCapture) => void;
}

const OBSERVED_EVENT_TYPES = [
  "click",
  "pointerdown",
  "pointerover",
  "scroll",
  "focusin",
  "keydown",
] as const;

const MAX_EVENTS = 500;
const MAX_MUTATIONS = 2000;

export class CaptureRecorder {
  private readonly roots: Element[];
  private readonly buildSelector: (element: Element) => string;
  private readonly maxDurationMs: number;
  private readonly maxElements: number;
  private readonly maxFrames: number;
  private readonly onAutoStop?: (capture: RawCapture) => void;

  private observed = new Map<Element, { selector: string; last: Record<string, string> }>();
  private frames: CaptureFrame[] = [];
  private mutations: CaptureMutation[] = [];
  private events: CaptureEvent[] = [];

  private mutationObserver: MutationObserver | null = null;
  private rafId: number | null = null;
  private startedAtMs = 0;
  private startedAtIso = "";
  private recording = false;
  private stopReason: RawCapture["stopReason"] = "manual";

  constructor(options: RecorderOptions) {
    this.roots = options.roots;
    this.buildSelector = options.buildSelector;
    this.maxDurationMs = options.maxDurationMs ?? 10_000;
    this.maxElements = options.maxElements ?? 150;
    this.maxFrames = options.maxFrames ?? 20_000;
    this.onAutoStop = options.onAutoStop;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  start(): void {
    if (this.recording) return;
    this.recording = true;
    this.stopReason = "manual";
    this.startedAtMs = performance.now();
    this.startedAtIso = new Date().toISOString();

    for (const root of this.roots) {
      this.observe(root);
      for (const descendant of root.querySelectorAll("*")) {
        if (this.observed.size >= this.maxElements) break;
        this.observe(descendant);
      }
    }

    // Baseline snapshot at t=0, then deltas per animation frame.
    this.snapshotAll(0);

    this.mutationObserver = new MutationObserver(this.handleMutations);
    for (const root of this.roots) {
      this.mutationObserver.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }

    for (const type of OBSERVED_EVENT_TYPES) {
      window.addEventListener(type, this.handleEvent, { capture: true, passive: true });
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): RawCapture {
    const durationMs = this.recording ? Math.round(performance.now() - this.startedAtMs) : 0;
    this.recording = false;

    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    for (const type of OBSERVED_EVENT_TYPES) {
      window.removeEventListener(type, this.handleEvent, true);
    }

    const capture: RawCapture = {
      sourceUrl: window.location.href,
      startedAt: this.startedAtIso,
      durationMs,
      stopReason: this.stopReason,
      observedElementCount: this.observed.size,
      frames: this.frames,
      mutations: this.mutations,
      events: this.events,
    };

    this.observed.clear();
    this.frames = [];
    this.mutations = [];
    this.events = [];

    return capture;
  }

  private observe(element: Element): void {
    if (this.observed.has(element) || this.observed.size >= this.maxElements) return;
    this.observed.set(element, { selector: this.buildSelector(element), last: {} });
  }

  private elapsed(): number {
    return Math.round(performance.now() - this.startedAtMs);
  }

  private tick = () => {
    if (!this.recording) return;

    const timestamp = this.elapsed();
    if (timestamp >= this.maxDurationMs) {
      this.autoStop("timeout");
      return;
    }

    this.snapshotAll(timestamp);

    if (this.frames.length >= this.maxFrames) {
      this.autoStop("frame-limit");
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private snapshotAll(timestamp: number): void {
    for (const [element, entry] of this.observed) {
      if (!element.isConnected) continue;

      const computed = getComputedStyle(element);
      let changed: Record<string, string> | null = null;

      for (const property of TRACKED_PROPERTIES) {
        const value = computed.getPropertyValue(property);
        if (entry.last[property] !== value) {
          (changed ??= {})[property] = value;
          entry.last[property] = value;
        }
      }

      if (changed) {
        this.frames.push({ timestamp, selector: entry.selector, styles: changed });
      }
    }
  }

  private handleMutations = (records: MutationRecord[]) => {
    const timestamp = this.elapsed();

    for (const record of records) {
      if (this.mutations.length >= MAX_MUTATIONS) return;

      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!target) continue;

      this.mutations.push({
        timestamp,
        kind: record.type,
        selector: this.observed.get(target)?.selector ?? this.buildSelector(target),
        ...(record.attributeName ? { attribute: record.attributeName } : {}),
      });

      // Track elements added mid-recording (enter animations).
      for (const node of record.addedNodes) {
        if (node instanceof Element) this.observe(node);
      }
    }
  };

  private handleEvent = (event: Event) => {
    if (this.events.length >= MAX_EVENTS) return;

    this.events.push({
      timestamp: this.elapsed(),
      type: event.type as CaptureEvent["type"],
      ...(event.target instanceof Element && this.observed.has(event.target)
        ? { selector: this.observed.get(event.target)!.selector }
        : {}),
    });
  };

  private autoStop(reason: RawCapture["stopReason"]): void {
    this.stopReason = reason;
    const capture = this.stop();
    capture.stopReason = reason;
    this.onAutoStop?.(capture);
  }
}
