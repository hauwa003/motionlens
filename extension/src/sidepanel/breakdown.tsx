import type { FrameworkScore } from "@motionlens/analysis";
import type { MotionGraph, MotionGraphNode } from "@motionlens/motion-graph";
import clsx from "clsx";
import {
  Clock,
  Layers,
  Pause,
  Play,
  Repeat,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, IconButton, Pill, ProgressBar } from "~components/ui";

const NAMED_BEZIERS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function bezierFor(easing: string): [number, number, number, number] {
  const named = NAMED_BEZIERS[easing];
  if (named) return named;
  const numbers = easing.match(/-?\d*\.?\d+/g)?.map(Number);
  if (numbers?.length === 4) return numbers as [number, number, number, number];
  return NAMED_BEZIERS.ease!;
}

/* ─── Easing Curve (32x32) ─── */

export function EasingCurve({ easing }: { easing: string }) {
  const [x1, y1, x2, y2] = bezierFor(easing);
  const s = 32;
  const path = `M 0 ${s} C ${x1 * s} ${s - y1 * s}, ${x2 * s} ${s - y2 * s}, ${s} 0`;

  return (
    <svg
      width="32"
      height="32"
      viewBox={`0 0 ${s} ${s}`}
      className="shrink-0 rounded transition-shadow hover:shadow-glow-violet/20"
    >
      <rect width={s} height={s} rx="4" className="fill-surface-raised" />
      <line x1="0" y1={s / 2} x2={s} y2={s / 2} stroke="#27272a" strokeWidth="0.5" />
      <line x1={s / 2} y1="0" x2={s / 2} y2={s} stroke="#27272a" strokeWidth="0.5" />
      <path d={path} fill="none" strokeWidth="1.5" className="stroke-accent-violet" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Framework Badges ─── */

const FRAMEWORK_COLORS: Record<string, string> = {
  gsap: "bg-emerald-500",
  "framer-motion": "bg-violet-500",
  "react-spring": "bg-blue-500",
  animejs: "bg-orange-500",
  css: "bg-zinc-500",
};

export function FrameworkBadges({ frameworks }: { frameworks: FrameworkScore[] }) {
  if (frameworks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {frameworks.slice(0, 3).map((score) => {
        const color = FRAMEWORK_COLORS[score.framework.toLowerCase()] ?? "bg-zinc-500";
        return (
          <Pill key={score.framework} variant="violet">
            <span className={clsx("h-2.5 w-2.5 rounded-sm text-[8px] font-bold text-white flex items-center justify-center", color)}>
              {score.framework[0]?.toUpperCase()}
            </span>
            {score.framework} {Math.round(score.confidence * 100)}%
          </Pill>
        );
      })}
    </div>
  );
}

/* ─── Node Card ─── */

function NodeCard({ node, depth }: { node: MotionGraphNode; depth: number }) {
  return (
    <li style={{ marginLeft: depth * 16 }} className="relative">
      {depth > 0 && (
        <div className="absolute -left-2 top-0 bottom-0 w-px bg-surface-border" />
      )}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-sm text-accent-emerald" title={node.selector}>
            {node.selector}
          </p>
          <div className="flex shrink-0 gap-1">
            {node.motionTypes.map((type) => (
              <Pill key={type} variant="default" className="text-[10px] uppercase tracking-wide">
                {type}
              </Pill>
            ))}
          </div>
        </div>

        <ul className="mt-2 flex flex-col gap-2">
          {node.changes.map((change) => (
            <li key={change.property} className="flex items-center gap-2">
              <EasingCurve easing={change.easing} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-text-primary">{change.property}</span>
                  <span className="font-mono text-xs-meta text-text-tertiary">
                    {change.delay > 0 ? `+${change.delay}ms · ` : ""}
                    {change.duration}ms · {change.easing}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="truncate text-text-disabled" title={change.from}>
                    {change.from}
                  </span>
                  <span className="shrink-0 text-text-disabled">→</span>
                  <span className="truncate text-text-primary" title={change.to}>
                    {change.to}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </li>
  );
}

function nodeDepth(node: MotionGraphNode, graph: MotionGraph): number {
  let depth = 0;
  let current = node;
  while (current.parentId) {
    const parent = graph.nodes.find((candidate) => candidate.id === current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

/* ─── Timeline Playback ─── */

function TimelinePlayback({ graph }: { graph: MotionGraph }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      lastTick.current = null;
      return;
    }
    let raf: number;
    const step = (now: number) => {
      const delta = lastTick.current === null ? 0 : now - lastTick.current;
      lastTick.current = now;
      setTimeMs((current) => {
        const next = current + delta;
        if (next >= graph.durationMs) {
          setPlaying(false);
          return graph.durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, graph.durationMs]);

  if (graph.durationMs === 0) return null;

  const rows = graph.nodes.flatMap((node) => node.changes.map((change) => ({ node, change })));
  const progress = (timeMs / graph.durationMs) * 100;

  return (
    <Card className="mt-3">
      <div className="flex items-center gap-2">
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? "Pause" : "Play"}
          className="h-8 w-8 bg-accent-violet text-white hover:bg-violet-500"
          onClick={() => {
            if (!playing && timeMs >= graph.durationMs) setTimeMs(0);
            setPlaying((value) => !value);
          }}
        />
        <div className="flex-1">
          <ProgressBar value={timeMs} max={graph.durationMs} />
        </div>
        <span className="w-20 text-right font-mono text-xs-meta text-text-tertiary">
          {Math.round(timeMs)}/{graph.durationMs}ms
        </span>
      </div>

      <div className="relative mt-3 flex flex-col gap-1">
        {rows.map(({ node, change }, index) => {
          const left = (change.delay / graph.durationMs) * 100;
          const width = Math.max(1, (change.duration / graph.durationMs) * 100);
          const active = timeMs >= change.delay && timeMs <= change.delay + change.duration;
          return (
            <div key={index} className="flex items-center gap-2">
              <span
                className="w-20 shrink-0 truncate font-mono text-xs-meta text-text-disabled"
                title={`${node.selector} ${change.property}`}
              >
                {change.property}
              </span>
              <div className="relative h-3 flex-1 rounded-sm bg-surface-raised">
                <div
                  className={clsx(
                    "absolute h-full rounded-sm transition-colors",
                    active ? "bg-accent-violet" : "bg-accent-violet/30",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
        {/* Playhead */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 flex flex-col items-center"
          style={{ left: `calc(5.5rem + (100% - 5.5rem) * ${progress / 100})` }}
        >
          <div className="h-full w-px bg-text-primary/60" />
          <div className="absolute -top-1 h-2 w-2 rotate-45 rounded-[1px] bg-text-primary" />
        </div>
      </div>
    </Card>
  );
}

/* ─── Motion Breakdown (main export) ─── */

export function MotionBreakdown({
  graph,
  frameworks,
}: {
  graph: MotionGraph;
  frameworks: FrameworkScore[];
}) {
  const ordered = useMemo(
    () =>
      [...graph.nodes].sort((a, b) => {
        const delayA = Math.min(...a.changes.map((change) => change.delay));
        const delayB = Math.min(...b.changes.map((change) => change.delay));
        return delayA - delayB;
      }),
    [graph],
  );

  const sequenceLabel =
    graph.sequence.kind === "stagger" && graph.sequence.staggerMs
      ? `stagger · ${graph.sequence.staggerMs}ms`
      : graph.sequence.kind;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill variant="emerald" icon={Zap}>
          on {graph.trigger}
          {graph.triggerConfidence ? ` · ${Math.round(graph.triggerConfidence * 100)}%` : ""}
        </Pill>
        <Pill variant="default" icon={Repeat}>
          {sequenceLabel}
        </Pill>
        <Pill variant="default" icon={Clock}>
          {graph.durationMs}ms
        </Pill>
        <FrameworkBadges frameworks={frameworks} />
      </div>

      <TimelinePlayback graph={graph} />

      <div className="mt-4 flex items-center gap-1.5 text-xs-meta font-medium uppercase tracking-wide text-text-tertiary">
        <Layers size={12} />
        Elements
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {ordered.map((node) => (
          <NodeCard key={node.id} node={node} depth={nodeDepth(node, graph)} />
        ))}
      </ul>
    </div>
  );
}
