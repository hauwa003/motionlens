import type { MotionGraph } from "@motionlens/motion-graph";

/**
 * Platform-specific prompt sections (Phase 11). Each formatter frames the
 * shared interaction description + technical spec for its target tool.
 */

export const TARGET_PLATFORMS = ["claude", "cursor", "framer", "v0", "lovable", "webflow"] as const;

export type TargetPlatform = (typeof TARGET_PLATFORMS)[number];

export interface PlatformTemplate {
  /** Opening framing: who the tool is and what to produce. */
  intro: (graph: MotionGraph) => string;
  /** Closing output instructions. */
  outro: (graph: MotionGraph) => string;
}

const FIDELITY_NOTE =
  "Reproduce the timing, easing, and property values exactly as specified — " +
  "they were measured from the live site at 60fps.";

export const PLATFORM_TEMPLATES: Record<TargetPlatform, PlatformTemplate> = {
  claude: {
    intro: () =>
      "Implement the following interaction as a single self-contained HTML file " +
      "(inline CSS and vanilla JavaScript, no external dependencies).",
    outro: () =>
      `${FIDELITY_NOTE}\n\n` +
      "Output the complete HTML file in one code block. Prefer CSS transitions/animations; " +
      "use JavaScript only for triggers CSS can't express.",
  },
  cursor: {
    intro: () =>
      "Add the following interaction to the component I have open. " +
      "Match the existing code style and stack of this project.",
    outro: () =>
      `${FIDELITY_NOTE}\n\n` +
      "If the project uses a CSS-in-JS or utility-class system, express the transition there; " +
      "otherwise add a scoped stylesheet. Keep the change minimal — don't restructure the component.",
  },
  framer: {
    intro: () =>
      "Create a React component using Framer Motion that reproduces the following interaction. " +
      "Use `motion` elements with `variants` and `transition` props.",
    outro: (graph) =>
      `${FIDELITY_NOTE}\n\n` +
      "Map delays/durations to `transition` (seconds, not ms). " +
      (graph.sequence.kind === "stagger"
        ? `Use \`staggerChildren: ${((graph.sequence.staggerMs ?? 0) / 1000).toFixed(2)}\` on the parent variant instead of per-child delays. `
        : "") +
      "Convert cubic-bezier easings to Framer's `ease` array format.",
  },
  v0: {
    intro: () =>
      "Generate a React + Tailwind CSS component that reproduces the following interaction. " +
      "Use Tailwind transition utilities where possible.",
    outro: () =>
      `${FIDELITY_NOTE}\n\n` +
      "Use arbitrary values for exact durations/easings (e.g. `duration-[180ms]`, " +
      "`ease-[cubic-bezier(0.4,0,0.2,1)]`). Fall back to a `<style>` block only for what " +
      "Tailwind can't express.",
  },
  lovable: {
    intro: () =>
      "Build a polished, production-ready component with the following interaction. " +
      "Include complete styling and the animation behavior described below.",
    outro: () =>
      `${FIDELITY_NOTE}\n\n` +
      "Deliver the full component with its styles. Make the non-animated visual design " +
      "tasteful but minimal so the motion is the focus.",
  },
  webflow: {
    intro: () =>
      "Configure a Webflow interaction (Interactions 2.0) that reproduces the following motion. " +
      "Below is what happens; translate it into trigger + timed-animation steps.",
    outro: (graph) =>
      "Step-by-step:\n" +
      `1. Add an element trigger of type "${webflowTrigger(graph.trigger)}" on the target element.\n` +
      "2. Create a timed animation; add one action per row of the table above.\n" +
      "3. Set each action's duration and delay from the table (Webflow uses seconds).\n" +
      "4. Pick the closest easing preset; use custom cubic-bezier where given.\n" +
      (graph.sequence.kind === "stagger"
        ? `5. For the list items, enable "stagger" on the action group with ${(
            (graph.sequence.staggerMs ?? 0) / 1000
          ).toFixed(2)}s.\n`
        : ""),
  },
};

function webflowTrigger(trigger: MotionGraph["trigger"]): string {
  switch (trigger) {
    case "hover":
      return "Mouse hover";
    case "click":
      return "Mouse click (tap)";
    case "scroll":
      return "Scroll into view";
    case "focus":
      return "Mouse click (tap)";
    case "mousemove":
      return "Mouse move over element";
    default:
      return "Page load";
  }
}
