/**
 * Framework detection (Phase 8) — scores animation frameworks from signals
 * collected on the page: runtime globals, loaded script URLs, and
 * framework-specific DOM attributes/classes.
 *
 * Signal collection happens in the extension (MAIN-world script); this
 * module is the pure scoring half.
 */

export interface FrameworkSignals {
  /** Names of detected window globals, e.g. "gsap", "Motion". */
  globals: string[];
  /** `src` of every script tag on the page. */
  scriptSrcs: string[];
  /** Framework-specific attributes/classes found in the DOM. */
  domMarkers: string[];
}

export interface FrameworkScore {
  framework: string;
  /** 0–1. */
  confidence: number;
  evidence: string[];
}

interface FrameworkDefinition {
  framework: string;
  globals?: string[];
  scriptPattern?: RegExp;
  domMarkers?: string[];
}

const DEFINITIONS: FrameworkDefinition[] = [
  {
    framework: "GSAP",
    globals: ["gsap", "TweenMax", "TweenLite", "ScrollTrigger"],
    scriptPattern: /gsap|tweenmax/i,
    domMarkers: ["gsap-marker-start", "pin-spacer"],
  },
  {
    framework: "Framer Motion",
    globals: ["__framer", "Framer", "MotionAppearAnimations"],
    scriptPattern: /framer/i,
    domMarkers: ["data-framer-name", "data-framer-appear-id", "data-projection-id"],
  },
  {
    framework: "Motion One",
    globals: ["Motion"],
    scriptPattern: /motion(?:\.min)?\.js|@motionone|motion-one/i,
  },
  {
    framework: "anime.js",
    globals: ["anime"],
    scriptPattern: /anime(?:\.min)?\.js/i,
  },
  {
    framework: "Lottie",
    globals: ["lottie", "bodymovin"],
    scriptPattern: /lottie|bodymovin/i,
    domMarkers: ["lottie-player", "data-lottie"],
  },
  {
    framework: "AOS",
    globals: ["AOS"],
    scriptPattern: /\baos\b/i,
    domMarkers: ["data-aos"],
  },
  {
    framework: "jQuery animate",
    globals: ["jQuery"],
    scriptPattern: /jquery/i,
  },
  {
    framework: "Velocity.js",
    globals: ["Velocity"],
    scriptPattern: /velocity/i,
  },
];

const GLOBAL_WEIGHT = 0.6;
const SCRIPT_WEIGHT = 0.3;
const DOM_WEIGHT = 0.4;
const MAX_CONFIDENCE = 0.95;

export function scoreFrameworks(signals: FrameworkSignals): FrameworkScore[] {
  const scores: FrameworkScore[] = [];

  for (const definition of DEFINITIONS) {
    let confidence = 0;
    const evidence: string[] = [];

    const matchedGlobal = definition.globals?.find((name) => signals.globals.includes(name));
    if (matchedGlobal) {
      confidence += GLOBAL_WEIGHT;
      evidence.push(`window.${matchedGlobal}`);
    }

    if (definition.scriptPattern) {
      const matchedScript = signals.scriptSrcs.find((src) => definition.scriptPattern!.test(src));
      if (matchedScript) {
        confidence += SCRIPT_WEIGHT;
        evidence.push(`script: ${matchedScript.split("/").pop() ?? matchedScript}`);
      }
    }

    const matchedMarker = definition.domMarkers?.find((marker) =>
      signals.domMarkers.includes(marker),
    );
    if (matchedMarker) {
      confidence += DOM_WEIGHT;
      evidence.push(`dom: ${matchedMarker}`);
    }

    if (confidence > 0) {
      scores.push({
        framework: definition.framework,
        confidence: Math.min(MAX_CONFIDENCE, Number(confidence.toFixed(2))),
        evidence,
      });
    }
  }

  scores.sort((a, b) => b.confidence - a.confidence);
  return scores;
}

/** The DOM markers the collector should look for (selector → marker name). */
export const DOM_MARKER_SELECTORS: Array<[selector: string, marker: string]> = [
  ["[data-framer-name]", "data-framer-name"],
  ["[data-framer-appear-id]", "data-framer-appear-id"],
  ["[data-projection-id]", "data-projection-id"],
  ["[data-aos]", "data-aos"],
  ["[data-lottie]", "data-lottie"],
  ["lottie-player", "lottie-player"],
  [".gsap-marker-start", "gsap-marker-start"],
  [".pin-spacer", "pin-spacer"],
];

/** The window globals the collector should probe for. */
export const GLOBAL_PROBES: string[] = Array.from(
  new Set(DEFINITIONS.flatMap((definition) => definition.globals ?? [])),
);
