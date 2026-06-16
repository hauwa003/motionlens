import type { AmbientBurst, AmbientObserverOptions } from "./ambient-types";
import {
  TRACKED_PROPERTIES,
  type CaptureEvent,
  type CaptureFrame,
  type RawCapture,
} from "./types";

/**
 * AmbientObserver — passively watches the entire page for CSS animations and
 * transitions, grouping detected changes into "bursts" that feed into the
 * existing buildMotionGraph pipeline unchanged.
 *
 * Uses IntersectionObserver to track which elements are visible, then polls
 * only visible elements via a throttled RAF loop. When style changes cluster
 * within a settle window then go silent, the burst is emitted.
 */

const OBSERVED_EVENT_TYPES = [
  "click",
  "pointerdown",
  "pointerover",
  "scroll",
  "focusin",
  "keydown",
] as const;

const MAX_EVENTS = 200;

interface WatchedEntry {
  selector: string;
  last: Record<string, string>;
}

interface ActiveBurst {
  startMs: number;
  lastChangeMs: number;
  frames: CaptureFrame[];
  events: CaptureEvent[];
  elements: Set<string>;
}

export class AmbientObserver {
  private readonly buildSelector: (el: Element) => string;
  private readonly onBurst: (burst: AmbientBurst) => void;
  private readonly maxWatchedElements: number;
  private readonly maxActiveElements: number;
  private readonly settleMs: number;
  private readonly frameSkip: number;
  private readonly maxBurstDurationMs: number;
  private readonly rescanIntervalMs: number;

  private watched = new Map<Element, WatchedEntry>();
  private visible = new Set<Element>();
  private intersectionObserver: IntersectionObserver | null = null;
  private rafId: number | null = null;
  private rescanTimer: ReturnType<typeof setInterval> | null = null;
  private frameCount = 0;
  private running = false;
  private paused = false;

  private activeBurst: ActiveBurst | null = null;
  private settleTimeout: ReturnType<typeof setTimeout> | null = null;
  private burstCounter = 0;

  constructor(options: AmbientObserverOptions) {
    this.buildSelector = options.buildSelector;
    this.onBurst = options.onBurst;
    this.maxWatchedElements = options.maxWatchedElements ?? 500;
    this.maxActiveElements = options.maxActiveElements ?? 80;
    this.settleMs = options.settleMs ?? 500;
    this.frameSkip = options.frameSkip ?? 1;
    this.maxBurstDurationMs = options.maxBurstDurationMs ?? 10_000;
    this.rescanIntervalMs = options.rescanIntervalMs ?? 5_000;
  }

  /** Start observing the page. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.visible.add(entry.target);
          } else {
            this.visible.delete(entry.target);
          }
        }
      },
      { rootMargin: "200px" },
    );

    this.scanForElements();
    this.rescanTimer = setInterval(() => this.scanForElements(), this.rescanIntervalMs);

    for (const type of OBSERVED_EVENT_TYPES) {
      window.addEventListener(type, this.handleEvent, { capture: true, passive: true });
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop observing and emit any in-progress burst. */
  stop(): void {
    this.running = false;
    this.paused = false;

    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;

    if (this.rescanTimer !== null) clearInterval(this.rescanTimer);
    this.rescanTimer = null;

    if (this.settleTimeout !== null) clearTimeout(this.settleTimeout);
    this.settleTimeout = null;

    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    for (const type of OBSERVED_EVENT_TYPES) {
      window.removeEventListener(type, this.handleEvent, true);
    }

    // Emit any in-progress burst
    if (this.activeBurst && this.activeBurst.frames.length > 0) {
      this.emitBurst();
    }

    this.watched.clear();
    this.visible.clear();
    this.activeBurst = null;
  }

  /** Suspend the RAF loop without losing watched elements. */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** Resume the RAF loop after a pause. */
  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    if (!this.running || this.paused) return;

    this.frameCount++;
    // Skip frames to achieve ~30fps polling instead of 60fps
    if (this.frameCount % (this.frameSkip + 1) !== 0) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const now = performance.now();

    // Force-emit long-running bursts
    if (
      this.activeBurst &&
      now - this.activeBurst.startMs >= this.maxBurstDurationMs
    ) {
      this.emitBurst();
    }

    let polled = 0;
    for (const element of this.visible) {
      if (polled >= this.maxActiveElements) break;

      const entry = this.watched.get(element);
      if (!entry || !element.isConnected) continue;

      polled++;
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
        const timestamp = this.activeBurst
          ? Math.round(now - this.activeBurst.startMs)
          : 0;

        if (!this.activeBurst) {
          this.activeBurst = {
            startMs: now,
            lastChangeMs: now,
            frames: [],
            events: [],
            elements: new Set(),
          };
        }

        this.activeBurst.frames.push({
          timestamp,
          selector: entry.selector,
          styles: changed,
        });
        this.activeBurst.elements.add(entry.selector);
        this.activeBurst.lastChangeMs = now;

        // Reset settle timer
        if (this.settleTimeout !== null) clearTimeout(this.settleTimeout);
        this.settleTimeout = setTimeout(() => this.emitBurst(), this.settleMs);
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private handleEvent = (event: Event) => {
    if (!this.activeBurst || this.paused) return;
    if (this.activeBurst.events.length >= MAX_EVENTS) return;

    this.activeBurst.events.push({
      timestamp: Math.round(performance.now() - this.activeBurst.startMs),
      type: event.type as CaptureEvent["type"],
      ...(event.target instanceof Element && this.watched.has(event.target)
        ? { selector: this.watched.get(event.target)!.selector }
        : {}),
    });
  };

  private emitBurst(): void {
    if (!this.activeBurst || this.activeBurst.frames.length === 0) return;

    if (this.settleTimeout !== null) clearTimeout(this.settleTimeout);
    this.settleTimeout = null;

    const burst = this.activeBurst;
    this.activeBurst = null;

    const durationMs = Math.round(burst.lastChangeMs - burst.startMs);

    const capture: RawCapture = {
      sourceUrl: window.location.href,
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs,
      stopReason: "timeout",
      observedElementCount: burst.elements.size,
      frames: burst.frames,
      mutations: [],
      events: burst.events,
    };

    const id = `burst-${Date.now()}-${++this.burstCounter}`;

    this.onBurst({
      id,
      capture,
      elementCount: burst.elements.size,
      detectedAt: new Date().toISOString(),
    });
  }

  private scanForElements(): void {
    if (!this.intersectionObserver) return;

    const elements = document.querySelectorAll("body *");
    const limit = Math.min(elements.length, this.maxWatchedElements * 2);

    for (let i = 0; i < limit; i++) {
      if (this.watched.size >= this.maxWatchedElements) break;

      const element = elements[i]!;
      if (this.watched.has(element)) continue;
      if (!(element instanceof HTMLElement)) continue;

      const style = getComputedStyle(element);
      const hasTransition =
        style.transitionDuration.split(",").some((d) => parseFloat(d) > 0) &&
        style.transitionProperty !== "none";
      const hasAnimation = style.animationName !== "none";

      if (!hasTransition && !hasAnimation) continue;

      const selector = this.buildSelector(element);
      // Take baseline snapshot so first real change is a delta
      const last: Record<string, string> = {};
      for (const property of TRACKED_PROPERTIES) {
        last[property] = style.getPropertyValue(property);
      }

      this.watched.set(element, { selector, last });
      this.intersectionObserver.observe(element);
    }
  }
}
