import type { FrameworkScore } from "@motionlens/analysis";
import type { MotionGraph, MotionGraphNode } from "@motionlens/motion-graph";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Analysis UI (Phase 9) — motion breakdown panel, layer inspector, easing
 * curve visualizer, framework badge, and an interactive playback timeline.
 */

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

export function EasingCurve({ easing }: { easing: string }) {
  const [x1, y1, x2, y2] = bezierFor(easing);
  const path = `M 0 32 C ${x1 * 32} ${32 - y1 * 32}, ${x2 * 32} ${32 - y2 * 32}, 32 0`;

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="4" className="fill-zinc-900" />
      <path d={path} fill="none" strokeWidth="1.5" className="stroke-violet-400" />
    </svg>
  );
}

export function FrameworkBadges({ frameworks }: { frameworks: FrameworkScore[] }) {
  if (frameworks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {frameworks.slice(0, 3).map((score) => (
        <span
          key={score.framework}
          title={score.evidence.join(", ")}
          className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300"
        >
          {score.framework} {Math.round(score.confidence * 100)}%
        </span>
      ))}
    </div>
  );
}

function NodeCard({ node, depth }: { node: MotionGraphNode; depth: number }) {
  return (
    <li style={{ marginLeft: depth * 12 }}>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-[11px] text-emerald-300" title={node.selector}>
            {node.selector}
          </p>
          <div className="flex shrink-0 gap-1">
            {node.motionTypes.map((type) => (
              <span
                key={type}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-300"
              >
                {type}
              </span>
            ))}
          </div>
        </div>

        <ul className="mt-2 flex flex-col gap-2">
          {node.changes.map((change) => (
            <li key={change.property} className="flex items-center gap-2">
              <EasingCurve easing={change.easing} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-zinc-200">{change.property}</span>
                  <span className="font-mono text-[9px] text-zinc-500">
                    {change.delay > 0 ? `+${change.delay}ms · ` : ""}
                    {change.duration}ms · {change.easing}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="truncate text-zinc-500" title={change.from}>
                    {change.from}
                  </span>
                  <span className="shrink-0 text-zinc-600">→</span>
                  <span className="truncate text-zinc-300" title={change.to}>
                    {change.to}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
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
    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && timeMs >= graph.durationMs) setTimeMs(0);
            setPlaying((value) => !value);
          }}
          className="w-7 rounded bg-zinc-100 py-1 text-[10px] font-medium text-zinc-950 hover:bg-white"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={graph.durationMs}
          value={Math.round(timeMs)}
          onChange={(event) => {
            setPlaying(false);
            setTimeMs(Number(event.target.value));
          }}
          className="flex-1 accent-violet-400"
        />
        <span className="w-16 text-right font-mono text-[10px] text-zinc-400">
          {Math.round(timeMs)}/{graph.durationMs}ms
        </span>
      </div>

      <div className="relative mt-2 flex flex-col gap-1">
        {rows.map(({ node, change }, index) => {
          const left = (change.delay / graph.durationMs) * 100;
          const width = Math.max(1, (change.duration / graph.durationMs) * 100);
          const active = timeMs >= change.delay && timeMs <= change.delay + change.duration;
          return (
            <div key={index} className="flex items-center gap-2">
              <span
                className="w-20 shrink-0 truncate font-mono text-[9px] text-zinc-500"
                title={`${node.selector} ${change.property}`}
              >
                {change.property}
              </span>
              <div className="relative h-2 flex-1 rounded bg-zinc-800/60">
                <div
                  className={`absolute h-full rounded transition-colors ${
                    active ? "bg-violet-400" : "bg-violet-400/40"
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-zinc-200/60"
          style={{ left: `calc(5.5rem + (100% - 5.5rem) * ${progress / 100})` }}
        />
      </div>
    </div>
  );
}

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
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
          on {graph.trigger}
          {graph.triggerConfidence ? ` · ${Math.round(graph.triggerConfidence * 100)}%` : ""}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300">
          {sequenceLabel}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-300">
          {graph.durationMs}ms
        </span>
        <FrameworkBadges frameworks={frameworks} />
      </div>

      <TimelinePlayback graph={graph} />

      <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Layers</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {ordered.map((node) => (
          <NodeCard key={node.id} node={node} depth={nodeDepth(node, graph)} />
        ))}
      </ul>
    </div>
  );
}
