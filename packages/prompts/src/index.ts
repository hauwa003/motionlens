/**
 * Prompt generation — turns a MotionGraph into copy-paste-ready prompts
 * for AI coding tools and design platforms.
 */

import type { MotionGraph } from "@motionlens/motion-graph";

import { describeInteraction, technicalSpec } from "./describe";
import { PLATFORM_TEMPLATES, TARGET_PLATFORMS, type TargetPlatform } from "./platforms";

export { describeInteraction, describeNode, technicalSpec } from "./describe";
export { PLATFORM_TEMPLATES, TARGET_PLATFORMS, type TargetPlatform } from "./platforms";

export interface PromptQuality {
  /** 0–100. */
  score: number;
  notes: string[];
}

export interface GeneratedPrompt {
  platform: TargetPlatform;
  text: string;
  quality: PromptQuality;
}

/** How trustworthy/complete the prompt is, with reasons. */
export function assessQuality(graph: MotionGraph): PromptQuality {
  const notes: string[] = [];
  let score = 100;

  if (graph.nodes.length === 0) {
    return { score: 0, notes: ["No motion captured — nothing to generate."] };
  }

  if ((graph.triggerConfidence ?? 0) < 0.7) {
    score -= 15;
    notes.push("Trigger detection is uncertain — verify the trigger before using.");
  }

  const easings = graph.nodes.flatMap((node) =>
    node.changes.map((change) => change.easingConfidence ?? 0),
  );
  const avgEasing = easings.reduce((sum, value) => sum + value, 0) / easings.length;
  if (avgEasing < 0.6) {
    score -= 20;
    notes.push("Easing fits are low-confidence — curves may differ from the original.");
  }

  if (graph.sequence.confidence < 0.6 && graph.nodes.length > 1) {
    score -= 10;
    notes.push("Sequence classification is uncertain (stagger vs chained).");
  }

  if (graph.durationMs < 50) {
    score -= 15;
    notes.push("Very short capture — the interaction may not have been fully recorded.");
  }

  if (notes.length === 0) notes.push("High-fidelity capture — prompt is ready to use.");
  return { score: Math.max(0, score), notes };
}

/** Generate a copy-paste-ready implementation prompt for the given platform. */
export function generatePrompt(graph: MotionGraph, platform: TargetPlatform): GeneratedPrompt {
  const template = PLATFORM_TEMPLATES[platform];

  const text = [
    template.intro(graph),
    `## Interaction (captured from ${graph.sourceUrl})`,
    `Trigger: **${graph.trigger}**`,
    describeInteraction(graph),
    "## Exact specification",
    technicalSpec(graph),
    "## Output",
    template.outro(graph),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { platform, text, quality: assessQuality(graph) };
}

/** Generate prompts for every supported platform at once. */
export function generateAllPrompts(graph: MotionGraph): GeneratedPrompt[] {
  return TARGET_PLATFORMS.map((platform) => generatePrompt(graph, platform));
}
