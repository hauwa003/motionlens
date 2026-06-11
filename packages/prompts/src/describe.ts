import type { MotionGraph, MotionGraphNode, PropertyChange } from "@motionlens/motion-graph";

/**
 * Natural-language summarizer (Phase 10) — turns a MotionGraph into prose
 * and a technical specification, both reused by every platform formatter.
 */

const TRIGGER_PHRASES: Record<string, string> = {
  hover: "when the user hovers it",
  click: "when the user clicks it",
  scroll: "when the user scrolls",
  load: "when the page loads",
  focus: "when it receives focus",
  mousemove: "as the mouse moves",
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describeChange(change: PropertyChange): string {
  const timing =
    `over ${change.duration}ms` +
    (change.delay > 0 ? ` after a ${change.delay}ms delay` : "") +
    ` with \`${change.easing}\` easing`;
  return `\`${change.property}\` goes from \`${change.from}\` to \`${change.to}\` ${timing}`;
}

export function describeNode(node: MotionGraphNode): string {
  const kinds = node.motionTypes.length > 0 ? ` (${node.motionTypes.join(", ")})` : "";
  const changes = node.changes.map(describeChange).join("; ");
  return `\`${node.selector}\`${kinds}: ${changes}.`;
}

/** One-paragraph interaction description: what happens, in what order. */
export function describeInteraction(graph: MotionGraph): string {
  if (graph.nodes.length === 0) {
    return "No motion was captured.";
  }

  const trigger = TRIGGER_PHRASES[graph.trigger] ?? `on ${graph.trigger}`;
  const sequence =
    graph.sequence.kind === "stagger"
      ? `in a staggered sequence (~${graph.sequence.staggerMs ?? 0}ms apart)`
      : graph.sequence.kind === "chained"
        ? "one after another (chained)"
        : graph.sequence.kind === "parallel"
          ? "simultaneously"
          : "";

  const lead =
    `${plural(graph.nodes.length, "element")} animate${graph.nodes.length === 1 ? "s" : ""} ` +
    `${trigger}${sequence ? `, ${sequence}` : ""}, completing in ~${graph.durationMs}ms.`;

  const details = graph.nodes.map((node) => `- ${describeNode(node)}`).join("\n");
  return `${lead}\n\n${details}`;
}

/** Markdown technical specification: exact timing/easing/value table. */
export function technicalSpec(graph: MotionGraph): string {
  const rows = graph.nodes.flatMap((node) =>
    node.changes.map(
      (change) =>
        `| \`${node.selector}\` | ${change.property} | \`${change.from}\` | \`${change.to}\` | ` +
        `${change.duration}ms | ${change.delay}ms | \`${change.easing}\` |`,
    ),
  );

  return [
    "| Element | Property | From | To | Duration | Delay | Easing |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
