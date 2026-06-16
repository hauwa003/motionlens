import { generatePrompt, TARGET_PLATFORMS, type TargetPlatform } from "@motionlens/prompts";
import type { MotionGraph } from "@motionlens/motion-graph";
import clsx from "clsx";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Pill, ProgressBar, SectionHeader } from "~components/ui";

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
  const [notesOpen, setNotesOpen] = useState(false);

  const generated = useMemo(() => generatePrompt(graph, platform), [graph, platform]);

  useEffect(() => setText(generated.text), [generated.text]);

  if (graph.nodes.length === 0) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const quality = generated.quality;
  const qualityColor =
    quality.score >= 80 ? "emerald" : quality.score >= 50 ? "amber" : "red";

  return (
    <section className="mt-4 border-t border-surface-border pt-4">
      <SectionHeader
        title="Implementation prompt"
        action={
          <div className="flex items-center gap-2">
            <ProgressBar
              value={quality.score}
              max={100}
              color={qualityColor}
              className="w-16"
            />
            <span className={clsx("font-mono text-xs-meta", `text-accent-${qualityColor}`)}>
              {quality.score}
            </span>
          </div>
        }
      />

      {/* Platform selector */}
      <div className="mt-3 flex flex-wrap gap-1">
        {TARGET_PLATFORMS.map((candidate) => {
          const active = candidate === platform;
          return (
            <button
              key={candidate}
              type="button"
              onClick={() => setPlatform(candidate)}
              className={clsx(
                "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                active
                  ? "bg-accent-violet text-white shadow-glow-violet/30"
                  : "bg-surface-raised text-text-secondary border border-surface-border hover:border-accent-violet-border hover:text-text-primary",
              )}
            >
              {PLATFORM_LABELS[candidate]}
            </button>
          );
        })}
      </div>

      {/* Quality notes (collapsible) */}
      {quality.notes.length > 0 && quality.score < 100 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setNotesOpen(!notesOpen)}
            className="flex items-center gap-1 text-xs-meta text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <ChevronDown
              size={12}
              className={clsx("transition-transform", notesOpen && "rotate-180")}
            />
            {quality.notes.length} note{quality.notes.length === 1 ? "" : "s"}
          </button>
          {notesOpen && (
            <ul className="mt-1 list-inside list-disc text-xs text-text-secondary space-y-0.5">
              {quality.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Editable prompt */}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        rows={12}
        className="mt-3 w-full resize-y rounded-lg border border-surface-border bg-surface-raised p-3 font-mono text-xs leading-relaxed text-text-secondary outline-none transition-colors focus:border-accent-violet-border"
      />

      {/* Copy button */}
      <Button
        variant="primary"
        icon={copied ? Check : Copy}
        onClick={() => void copy()}
        className={clsx(
          "mt-2 w-full transition-all",
          copied && "bg-accent-emerald hover:bg-emerald-400 shadow-glow-emerald/30",
        )}
      >
        {copied ? "Copied!" : `Copy ${PLATFORM_LABELS[platform]} prompt`}
      </Button>
    </section>
  );
}
