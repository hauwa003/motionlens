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
 *
 * A MutationObserver watches the entire page for class/style attribute changes
 * so that elements animated by JS libraries (GSAP, AOS, Framer Motion, etc.)
 * are picked up the instant their animation classes are applied.
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
  private mutationObserver: MutationObserver | null = null;
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

    // Watch the entire page for class/style attribute changes so we catch
    // elements animated by JS libraries (GSAP ScrollTrigger, AOS, Framer
    // Motion, etc.) the moment their animation classes are applied.
    this.mutationObserver = new MutationObserver(this.handleMutations);
    this.mutationObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
    });

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

    this.mutationObserver?.disconnect();
    this.mutationObserver = null;

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

  /**
   * MutationObserver callback — when a class or style attribute changes on any
   * element, or new elements are added to the DOM, we immediately check if
   * they should be watched. This catches animation libraries that add classes
   * dynamically (AOS `data-aos-animate`, GSAP ScrollTrigger, Framer Motion,
   * Tailwind `animate-*`, etc.).
   */
  private handleMutations = (records: MutationRecord[]) => {
    if (!this.intersectionObserver) return;

    for (const record of records) {
      if (record.type === "attributes") {
        const target = record.target;
        if (!(target instanceof HTMLElement)) continue;
        this.tryWatch(target);
      } else if (record.type === "childList") {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          this.tryWatch(node);
          // Also check immediate children of added nodes (common for
          // frameworks that insert wrapper divs with animated children)
          for (const child of node.querySelectorAll("*")) {
            if (child instanceof HTMLElement) this.tryWatch(child);
          }
        }
      }
    }
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

  /**
   * Try to add a single element to the watch list. Checks if the element is
   * animatable (has transition, animation, will-change, or non-default
   * transform/opacity indicating it's mid-animation).
   */
  private tryWatch(element: HTMLElement): void {
    if (!this.intersectionObserver) return;
    if (this.watched.has(element)) return;
    if (this.watched.size >= this.maxWatchedElements) return;

    const style = getComputedStyle(element);
    if (this.isAnimatable(style)) {
      this.addToWatchList(element, style);
    }
  }

  /**
   * Broader check than just transition/animation. Also catches:
   * - Elements with `will-change` set (intent to animate)
   * - Elements with non-default opacity (likely mid-animation or animated)
   * - Elements with transform set (likely animated)
   */
  private isAnimatable(style: CSSStyleDeclaration): boolean {
    // Has CSS transition
    const hasTransition =
      style.transitionDuration.split(",").some((d) => parseFloat(d) > 0) &&
      style.transitionProperty !== "none";
    if (hasTransition) return true;

    // Has CSS animation
    if (style.animationName !== "none") return true;

    // Has will-change hint (the developer intends to animate this)
    const willChange = style.willChange;
    if (willChange && willChange !== "auto") return true;

    // Non-default opacity (many scroll animations fade in from 0)
    const opacity = parseFloat(style.opacity);
    if (!isNaN(opacity) && opacity < 1) return true;

    // Non-default transform (translateY, scale, etc.)
    const transform = style.transform;
    if (transform && transform !== "none") return true;

    return false;
  }

  private addToWatchList(element: HTMLElement, style: CSSStyleDeclaration): void {
    if (!this.intersectionObserver) return;

    const selector = this.buildSelector(element);
    const last: Record<string, string> = {};
    for (const property of TRACKED_PROPERTIES) {
      last[property] = style.getPropertyValue(property);
    }

    this.watched.set(element, { selector, last });
    this.intersectionObserver.observe(element);
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
      if (!this.isAnimatable(style)) continue;

      this.addToWatchList(element, style);
    }
  }
}
