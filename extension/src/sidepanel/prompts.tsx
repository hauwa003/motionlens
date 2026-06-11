import { generatePrompt, TARGET_PLATFORMS, type TargetPlatform } from "@motionlens/prompts";
import type { MotionGraph } from "@motionlens/motion-graph";
import { useEffect, useMemo, useState } from "react";

/**
 * Prompt UI (Phase 12) — platform selector, editable prompt preview,
 * quality indicator, one-click copy.
 */

const PLATFORM_LABELS: Record<TargetPlatform, string> = {
  claude: "Claude",
  cursor: "Cursor",
  framer: "Framer",
  v0: "v0",
  lovable: "Lovable",
  webflow: "Webflow",
};

export function PromptPanel({ graph }: { graph: MotionGraph }) {
  const [platform, setPlatform] = useState<TargetPlatform>("claude");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const generated = useMemo(() => generatePrompt(graph, platform), [graph, platform]);

  // Re-seed the editable text whenever the source prompt changes.
  useEffect(() => setText(generated.text), [generated.text]);

  if (graph.nodes.length === 0) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const quality = generated.quality;
  const qualityColor =
    quality.score >= 80
      ? "text-emerald-300"
      : quality.score >= 50
        ? "text-amber-300"
        : "text-red-300";

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-300">Implementation prompt</h2>
        <span className={`font-mono text-[10px] ${qualityColor}`} title={quality.notes.join("\n")}>
          quality {quality.score}/100
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {TARGET_PLATFORMS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setPlatform(candidate)}
            className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
              candidate === platform
                ? "bg-zinc-100 font-medium text-zinc-950"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {PLATFORM_LABELS[candidate]}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        rows={12}
        className="mt-2 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[10px] leading-relaxed text-zinc-300 outline-none focus:border-zinc-600"
      />

      {quality.notes.length > 0 && quality.score < 100 && (
        <ul className="mt-1 list-inside list-disc text-[10px] text-zinc-500">
          {quality.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 w-full rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
      >
        {copied ? "Copied ✓" : `Copy ${PLATFORM_LABELS[platform]} prompt`}
      </button>
    </section>
  );
}
