import type { RawCapture } from "./types";

/** A cluster of style changes captured by the AmbientObserver. */
export interface AmbientBurst {
  /** Unique burst ID (e.g., "burst-1718..."). */
  id: string;
  /** Standard capture — feeds into buildMotionGraph unchanged. */
  capture: RawCapture;
  /** How many distinct elements animated in this burst. */
  elementCount: number;
  /** ISO timestamp when the burst was first detected. */
  detectedAt: string;
}

export interface AmbientObserverOptions {
  /** Build a stable CSS selector for an element (provided by the caller). */
  buildSelector: (el: Element) => string;
  /** Called when a burst settles and is ready for processing. */
  onBurst: (burst: AmbientBurst) => void;
  /** Total elements to monitor across the page. Default 500. */
  maxWatchedElements?: number;
  /** Max visible elements polled per frame. Default 80. */
  maxActiveElements?: number;
  /** Silence (ms) before a burst is emitted. Default 500. */
  settleMs?: number;
  /** Skip N frames between polls (~30fps at frameSkip=1). Default 1. */
  frameSkip?: number;
  /** Force-emit bursts longer than this (ms). Default 10_000. */
  maxBurstDurationMs?: number;
  /** Rescan the page for new animated elements every N ms. Default 5_000. */
  rescanIntervalMs?: number;
}
