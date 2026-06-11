import type { PlasmoCSConfig } from "plasmo";

/**
 * Content script — confirms DOM access on the target page.
 * Phase 3 replaces this with the element picker overlay. MotionLens is
 * strictly read-only: it must never modify the target website.
 */

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
};

console.debug("[MotionLens] content script loaded on", window.location.href);
