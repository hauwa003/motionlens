// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AmbientBurst } from "./ambient-types";
import { AmbientObserver } from "./ambient-observer";
import { buildMotionGraph } from "../builder";

/* ─── DOM Mocks ─── */

let intersectionCallbacks: ((entries: IntersectionObserverEntry[]) => void)[] = [];
let observedElements: Set<Element> = new Set();

class MockIntersectionObserver {
  constructor(
    callback: (entries: IntersectionObserverEntry[]) => void,
    _options?: IntersectionObserverInit,
  ) {
    intersectionCallbacks.push(callback);
  }

  observe(el: Element) {
    observedElements.add(el);
    // Simulate the element being immediately visible
    const entries: IntersectionObserverEntry[] = [
      {
        target: el,
        isIntersecting: true,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: 0,
      },
    ];
    for (const cb of intersectionCallbacks) cb(entries);
  }

  disconnect() {
    intersectionCallbacks = [];
    observedElements.clear();
  }

  unobserve() {}
}

function simulateInvisible(el: Element) {
  const entries: IntersectionObserverEntry[] = [
    {
      target: el,
      isIntersecting: false,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0,
    },
  ];
  for (const cb of intersectionCallbacks) cb(entries);
}

/* ─── Style Mock ─── */

let styleOverrides = new Map<Element, Record<string, string>>();

function mockGetComputedStyle(el: Element): CSSStyleDeclaration {
  const overrides = styleOverrides.get(el) ?? {};
  return {
    transitionDuration: overrides._transitionDuration ?? "0.3s",
    transitionProperty: overrides._transitionProperty ?? "all",
    animationName: overrides._animationName ?? "none",
    getPropertyValue(prop: string) {
      return overrides[prop] ?? "none";
    },
  } as unknown as CSSStyleDeclaration;
}

/* ─── RAF Mock ─── */

let rafCallbacks: ((time: number) => void)[] = [];
let rafId = 0;

function mockRAF(callback: (time: number) => void): number {
  rafCallbacks.push(callback);
  return ++rafId;
}

function flushRAF(time: number) {
  const cbs = [...rafCallbacks];
  rafCallbacks = [];
  for (const cb of cbs) cb(time);
}

/* ─── Test Setup ─── */

let mockElements: HTMLElement[];

beforeEach(() => {
  vi.useFakeTimers();

  // Create mock elements
  mockElements = Array.from({ length: 3 }, (_, i) => {
    const el = document.createElement("div");
    el.className = `animated-${i}`;
    document.body.appendChild(el);
    return el;
  });

  // Set default style overrides (transition properties)
  for (const el of mockElements) {
    styleOverrides.set(el, {
      _transitionDuration: "0.3s",
      _transitionProperty: "all",
      _animationName: "none",
      opacity: "1",
      transform: "none",
    });
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("getComputedStyle", mockGetComputedStyle);
  vi.stubGlobal("requestAnimationFrame", mockRAF);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  intersectionCallbacks = [];
  observedElements.clear();
  styleOverrides.clear();
  rafCallbacks = [];
  rafId = 0;
  document.body.innerHTML = "";
});

/* ─── Tests ─── */

describe("AmbientObserver", () => {
  it("discovers elements with transitionDuration > 0", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
    });

    observer.start();
    expect(observedElements.size).toBe(3);
    observer.stop();
  });

  it("skips elements without transitions or animations", () => {
    // Add a non-animated element
    const plainEl = document.createElement("span");
    plainEl.className = "plain";
    document.body.appendChild(plainEl);
    styleOverrides.set(plainEl, {
      _transitionDuration: "0s",
      _transitionProperty: "none",
      _animationName: "none",
      opacity: "1",
      transform: "none",
    });

    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: () => {},
    });

    observer.start();
    // Only the 3 animated elements should be observed, not the plain one
    expect(observedElements.size).toBe(3);
    observer.stop();
  });

  it("only polls visible elements", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
      settleMs: 100,
      frameSkip: 0,
    });

    observer.start();

    // Make element 0 invisible
    simulateInvisible(mockElements[0]!);

    // Change style on element 0 (invisible) and element 1 (visible)
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0.5",
    });
    styleOverrides.set(mockElements[1]!, {
      ...styleOverrides.get(mockElements[1]!)!,
      opacity: "0.5",
    });

    // Flush two RAF frames (frameSkip=0 means every frame is processed)
    flushRAF(100);
    flushRAF(200);

    // Let the settle timer fire
    vi.advanceTimersByTime(200);

    // Should have captured a burst with only element 1 (element 0 was invisible)
    expect(bursts.length).toBe(1);
    expect(bursts[0]!.elementCount).toBe(1);

    observer.stop();
  });

  it("groups changes within settleMs into one burst", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
      settleMs: 100,
      frameSkip: 0,
    });

    observer.start();

    // First change
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0.8",
    });
    flushRAF(100);

    // Second change within settle window
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0.5",
    });
    flushRAF(150);

    // Not enough time for settle
    expect(bursts.length).toBe(0);

    // Let settle timer fire
    vi.advanceTimersByTime(200);

    expect(bursts.length).toBe(1);
    expect(bursts[0]!.capture.frames.length).toBe(2);

    observer.stop();
  });

  it("produces separate bursts for temporally separated changes", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
      settleMs: 100,
      frameSkip: 0,
    });

    observer.start();

    // First change
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0.5",
    });
    flushRAF(100);

    // Let settle timer fire for first burst
    vi.advanceTimersByTime(200);
    expect(bursts.length).toBe(1);

    // Second change after settle
    styleOverrides.set(mockElements[1]!, {
      ...styleOverrides.get(mockElements[1]!)!,
      opacity: "0.3",
    });
    flushRAF(400);

    // Let settle timer fire for second burst
    vi.advanceTimersByTime(200);
    expect(bursts.length).toBe(2);

    observer.stop();
  });

  it("emitted RawCapture has valid structure for buildMotionGraph", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
      settleMs: 50,
      frameSkip: 0,
    });

    observer.start();

    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0",
    });
    flushRAF(100);

    vi.advanceTimersByTime(100);
    expect(bursts.length).toBe(1);

    const capture = bursts[0]!.capture;
    expect(capture.sourceUrl).toBe("http://localhost:3000/");
    expect(capture.frames.length).toBeGreaterThan(0);
    expect(capture.mutations).toEqual([]);
    expect(typeof capture.durationMs).toBe("number");
    expect(typeof capture.startedAt).toBe("string");

    // Should not throw
    const graph = buildMotionGraph(capture);
    expect(graph).toBeDefined();

    observer.stop();
  });

  it("respects maxWatchedElements cap", () => {
    // Add many elements
    for (let i = 0; i < 10; i++) {
      const el = document.createElement("div");
      el.className = `extra-${i}`;
      document.body.appendChild(el);
      styleOverrides.set(el, {
        _transitionDuration: "0.5s",
        _transitionProperty: "all",
        _animationName: "none",
        opacity: "1",
      });
    }

    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: () => {},
      maxWatchedElements: 5,
    });

    observer.start();
    expect(observedElements.size).toBe(5);
    observer.stop();
  });

  it("emits no frames while paused", () => {
    const bursts: AmbientBurst[] = [];
    const observer = new AmbientObserver({
      buildSelector: (el) => (el as HTMLElement).className,
      onBurst: (b) => bursts.push(b),
      settleMs: 50,
      frameSkip: 0,
    });

    observer.start();
    observer.pause();

    // Change while paused
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0",
    });
    flushRAF(100);
    vi.advanceTimersByTime(200);

    expect(bursts.length).toBe(0);

    // Resume and change
    observer.resume();
    styleOverrides.set(mockElements[0]!, {
      ...styleOverrides.get(mockElements[0]!)!,
      opacity: "0.5",
    });
    flushRAF(300);
    vi.advanceTimersByTime(200);

    expect(bursts.length).toBe(1);

    observer.stop();
  });
});
