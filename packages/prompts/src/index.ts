/**
 * Prompt generation — turns a MotionGraph into copy-paste-ready prompts
 * for AI coding tools and design platforms.
 *
 * Phase 1 scaffold: defines the supported target platforms and the generator
 * entry point. Phases 10–11 implement the summarizer and per-platform formatters.
 */

import type { MotionGraph } from "@motionlens/motion-graph";

export const TARGET_PLATFORMS = ["claude", "cursor", "framer", "v0", "lovable", "webflow"] as const;

export type TargetPlatform = (typeof TARGET_PLATFORMS)[number];

export interface GeneratedPrompt {
  platform: TargetPlatform;
  text: string;
}

/**
 * Generate an implementation prompt for the given platform.
 *
 * Placeholder implementation: produces a minimal description so the pipeline
 * is wired end to end. Phase 10 replaces this with the real summarizer and
 * template system.
 */
export function generatePrompt(graph: MotionGraph, platform: TargetPlatform): GeneratedPrompt {
  const text = [
    `Recreate the following interaction captured from ${graph.sourceUrl}.`,
    `Trigger: ${graph.trigger}.`,
    `Animated elements: ${graph.nodes.length}.`,
  ].join("\n");

  return { platform, text };
}
