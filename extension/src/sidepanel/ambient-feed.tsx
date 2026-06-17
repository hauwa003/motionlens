import { buildMotionGraph, type AmbientBurst, type FrameworkScore } from "@motionlens/analysis";
import type { MotionGraph } from "@motionlens/motion-graph";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, Mouse, Navigation, Pointer, Save, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button, Card, EmptyState, Pill } from "~components/ui";

import { MotionBreakdown } from "./breakdown";
import { PromptPanel } from "./prompts";

/* ─── Helpers ─── */

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function detectMotionTypes(graph: MotionGraph): string[] {
  const types = new Set<string>();
  for (const node of graph.nodes) {
    for (const mt of node.motionTypes) types.add(mt);
  }
  return Array.from(types);
}

type TriggerInfo = { label: string; icon: typeof Mouse };

function detectTrigger(burst: AmbientBurst): TriggerInfo {
  const events = burst.capture.events;
  if (events.length === 0) return { label: "Auto animation", icon: Eye };

  const types = new Set(events.map((e) => e.type));
  if (types.has("scroll")) return { label: "Scroll animation", icon: Navigation };
  if (types.has("click") || types.has("pointerdown")) return { label: "Click animation", icon: Pointer };
  if (types.has("pointerover")) return { label: "Hover animation", icon: Mouse };
  if (types.has("focusin")) return { label: "Focus animation", icon: Pointer };
  return { label: "Animation detected", icon: Eye };
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
  const trigger = useMemo(() => detectTrigger(burst), [burst]);

  if (graph.nodes.length === 0) return null;

  const TriggerIcon = trigger.icon;
  const summary = motionTypes.length > 0
    ? `${burst.elementCount} element${burst.elementCount !== 1 ? "s" : ""} \u00b7 ${motionTypes.join(", ")}`
    : `${burst.elementCount} element${burst.elementCount !== 1 ? "s" : ""}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card interactive className="overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full flex-col gap-2 text-left"
        >
          {/* Screenshot */}
          {burst.screenshot && (
            <div className="-mx-3 -mt-3 mb-1 overflow-hidden">
              <img
                src={burst.screenshot}
                alt="Page at time of animation"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}

          {/* Title row */}
          <div className="flex w-full items-center gap-2">
            <TriggerIcon size={14} className="shrink-0 text-accent-violet" />
            <span className="text-sm font-medium text-text-primary">
              {trigger.label}
            </span>
            <span className="ml-auto text-xs text-text-disabled">
              {relativeTime(burst.detectedAt)}
            </span>
            <ChevronDown
              size={14}
              className={clsx(
                "shrink-0 text-text-disabled transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>

          {/* Subtitle */}
          <span className="text-xs text-text-tertiary">{summary}</span>
        </button>

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
                    Save
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
        icon={Eye}
        title="Watching for animations"
        description="Interact with the page normally — scroll, hover, click. Animations will appear here automatically."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {bursts.length} animation{bursts.length !== 1 ? "s" : ""} found
        </p>
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={onClear}
          className="h-7 px-2 text-xs-meta"
        >
          Clear
        </Button>
      </div>

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
