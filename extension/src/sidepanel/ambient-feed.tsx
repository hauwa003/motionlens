import { buildMotionGraph, type AmbientBurst, type FrameworkScore } from "@motionlens/analysis";
import type { MotionGraph } from "@motionlens/motion-graph";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Radar, Save, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button, Card, EmptyState, Pill, SectionHeader } from "~components/ui";

import { MotionBreakdown } from "./breakdown";
import { PromptPanel } from "./prompts";

/* ─── Time helpers ─── */

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ─── Motion type detection from capture ─── */

function detectMotionTypes(graph: MotionGraph): string[] {
  const types = new Set<string>();
  for (const node of graph.nodes) {
    for (const mt of node.motionTypes) {
      types.add(mt);
    }
  }
  return Array.from(types);
}

function detectTriggerLabel(burst: AmbientBurst): string {
  const events = burst.capture.events;
  if (events.length === 0) return "auto";

  const types = new Set(events.map((e) => e.type));
  if (types.has("scroll")) return "scroll";
  if (types.has("click") || types.has("pointerdown")) return "click";
  if (types.has("pointerover")) return "hover";
  if (types.has("focusin")) return "focus";
  return "interaction";
}

/* ─── Burst Card ─── */

function AmbientBurstCard({
  burst,
  expanded,
  onToggle,
  onSave,
  frameworks,
}: {
  burst: AmbientBurst;
  expanded: boolean;
  onToggle: () => void;
  onSave: () => void;
  frameworks: FrameworkScore[];
}) {
  const graph = useMemo(() => buildMotionGraph(burst.capture), [burst.capture]);
  const motionTypes = useMemo(() => detectMotionTypes(graph), [graph]);
  const trigger = useMemo(() => detectTriggerLabel(burst), [burst]);

  if (graph.nodes.length === 0) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card interactive className="overflow-hidden">
        {/* Screenshot preview */}
        {burst.screenshot && (
          <div className="mb-2 overflow-hidden rounded-md">
            <img
              src={burst.screenshot}
              alt="Page screenshot when animation was detected"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        )}

        {/* Header — always visible */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-left"
        >
          <Pill variant="emerald">{trigger}</Pill>
          <span className="text-xs text-text-secondary">
            {burst.elementCount} element{burst.elementCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs-meta text-text-disabled">
            {formatDuration(burst.capture.durationMs)}
          </span>
          <span className="ml-auto text-xs-meta text-text-disabled">
            {relativeTime(burst.detectedAt)}
          </span>
          <ChevronDown
            size={14}
            className={clsx(
              "shrink-0 text-text-disabled transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        {/* Motion type pills */}
        {motionTypes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {motionTypes.map((mt) => (
              <Pill key={mt} variant="violet">
                {mt}
              </Pill>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t border-surface-border pt-3">
                <MotionBreakdown graph={graph} frameworks={frameworks} />
                <PromptPanel graph={graph} />

                <div className="mt-3 flex justify-end">
                  <Button
                    variant="secondary"
                    icon={Save}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSave();
                    }}
                    className="h-7 px-2 text-xs-meta"
                  >
                    Save to library
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

/* ─── Ambient Feed ─── */

export function AmbientFeed({
  bursts,
  expandedId,
  onToggle,
  onSave,
  onClear,
  frameworks,
}: {
  bursts: AmbientBurst[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onSave: (burst: AmbientBurst) => void;
  onClear: () => void;
  frameworks: FrameworkScore[];
}) {
  if (bursts.length === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="Watching for animations"
        description="Scroll, hover, or click on the page. Detected animations will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title={`${bursts.length} animation${bursts.length !== 1 ? "s" : ""} captured`}
        icon={Radar}
        action={
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={onClear}
            className="h-7 px-2 text-xs-meta"
          >
            Clear
          </Button>
        }
      />

      <div className="flex flex-col gap-2 overflow-y-auto">
        <AnimatePresence>
          {bursts.map((burst) => (
            <AmbientBurstCard
              key={burst.id}
              burst={burst}
              expanded={expandedId === burst.id}
              onToggle={() => onToggle(burst.id)}
              onSave={() => onSave(burst)}
              frameworks={frameworks}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
