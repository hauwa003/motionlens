import { DOM_MARKER_SELECTORS, GLOBAL_PROBES } from "@motionlens/analysis";
import type { PlasmoCSConfig } from "plasmo";

/**
 * Framework signal collector — runs in the page's MAIN world so it can see
 * runtime globals like window.gsap. Posts its findings to the isolated-world
 * content script via window.postMessage (chrome.* APIs are unavailable here).
 *
 * Read-only: probes globals, script srcs, and DOM markers; never modifies.
 */

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  world: "MAIN",
};

export const SIGNALS_MESSAGE_SOURCE = "motionlens-detector";

function collectSignals() {
  const globals = GLOBAL_PROBES.filter(
    (name) => (window as unknown as Record<string, unknown>)[name] !== undefined,
  );

  const scriptSrcs = Array.from(document.querySelectorAll("script[src]"))
    .map((script) => script.getAttribute("src") ?? "")
    .filter(Boolean)
    .slice(0, 100);

  const domMarkers = DOM_MARKER_SELECTORS.filter(([selector]) => {
    try {
      return document.querySelector(selector) !== null;
    } catch {
      return false;
    }
  }).map(([, marker]) => marker);

  return { globals, scriptSrcs, domMarkers };
}

function post() {
  window.postMessage(
    { source: SIGNALS_MESSAGE_SOURCE, type: "framework-signals", signals: collectSignals() },
    window.location.origin,
  );
}

// Libraries may load late; probe once now and once after the page settles.
post();
window.addEventListener("load", () => setTimeout(post, 1500), { once: true });
