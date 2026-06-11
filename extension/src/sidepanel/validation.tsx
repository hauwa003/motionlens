import type { MotionGraph } from "@motionlens/motion-graph";
import { compareGraphs, SCORE_WEIGHTS, type ScoreCategory } from "@motionlens/validation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Validation UI (Phases 13 + 15) — compares a saved "original" MotionGraph
 * against the latest capture (the recreation): match score, category
 * breakdown, synchronized playback, difference report, and suggestions.
 */

export interface SavedOriginal {
  graph: MotionGraph;
  savedAt: string;
}

const ORIGINAL_KEY = "validation-original";

export async function loadOriginal(): Promise<SavedOriginal | null> {
  const result = await chrome.storage.local.get(ORIGINAL_KEY);
  return (result[ORIGINAL_KEY] as SavedOriginal | undefined) ?? null;
}

export async function saveOriginal(graph: MotionGraph): Promise<SavedOriginal> {
  const saved: SavedOriginal = { graph, savedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [ORIGINAL_KEY]: saved });
  return saved;
}

export async function clearOriginal(): Promise<void> {
  await chrome.storage.local.remove(ORIGINAL_KEY);
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  timing: "Timing",
  easing: "Easing",
  spatial: "Spatial",
  visual: "Visual",
};

function scoreColor(score: number): string {
  return score >= 85 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-red-300";
}

function GanttRows({
  graph,
  durationMs,
  timeMs,
  color,
}: {
  graph: MotionGraph;
  durationMs: number;
  timeMs: number;
  color: string;
}) {
  const rows = graph.nodes.flatMap((node) => node.changes.map((change) => ({ node, change })));
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map(({ node, change }, index) => {
        const left = (change.delay / durationMs) * 100;
        const width = Math.max(1, (change.duration / durationMs) * 100);
        const active = timeMs >= change.delay && timeMs <= change.delay + change.duration;
        return (
          <div
            key={index}
            className="relative h-1.5 rounded bg-zinc-800/60"
            title={`${node.selector} ${change.property}`}
          >
            <div
              className={`absolute h-full rounded ${color} ${active ? "opacity-100" : "opacity-40"}`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function SyncedPlayback({
  original,
  recreation,
}: {
  original: MotionGraph;
  recreation: MotionGraph;
}) {
  const durationMs = Math.max(original.durationMs, recreation.durationMs, 1);
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
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationMs]);

  return (
    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && timeMs >= durationMs) setTimeMs(0);
            setPlaying((value) => !value);
          }}
          className="w-7 rounded bg-zinc-100 py-1 text-[10px] font-medium text-zinc-950 hover:bg-white"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={durationMs}
          value={Math.round(timeMs)}
          onChange={(event) => {
            setPlaying(false);
            setTimeMs(Number(event.target.value));
          }}
          className="flex-1 accent-violet-400"
        />
        <span className="w-16 text-right font-mono text-[10px] text-zinc-400">
          {Math.round(timeMs)}/{durationMs}ms
        </span>
      </div>

      <p className="mt-2 text-[9px] uppercase tracking-wide text-zinc-500">Original</p>
      <GanttRows graph={original} durationMs={durationMs} timeMs={timeMs} color="bg-violet-400" />
      <p className="mt-2 text-[9px] uppercase tracking-wide text-zinc-500">Recreation</p>
      <GanttRows
        graph={recreation}
        durationMs={durationMs}
        timeMs={timeMs}
        color="bg-emerald-400"
      />
    </div>
  );
}

export function ValidationPanel({
  original,
  recreation,
  onClearOriginal,
}: {
  original: SavedOriginal;
  recreation: MotionGraph;
  onClearOriginal: () => void;
}) {
  const score = useMemo(
    () => compareGraphs(original.graph, recreation),
    [original.graph, recreation],
  );

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-300">Validation</h2>
        <button
          type="button"
          onClick={onClearOriginal}
          className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          Clear original
        </button>
      </div>
      <p className="mt-1 truncate text-[10px] text-zinc-500" title={original.graph.sourceUrl}>
        vs {original.graph.sourceUrl}
      </p>

      <div className="mt-3 flex items-center gap-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-center">
          <p className={`text-2xl font-semibold tabular-nums ${scoreColor(score.overall)}`}>
            {score.overall}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-zinc-500">Match</p>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {(Object.keys(SCORE_WEIGHTS) as ScoreCategory[]).map((category) => (
            <div key={category} className="flex items-center gap-2">
              <span className="w-12 text-[9px] uppercase tracking-wide text-zinc-500">
                {CATEGORY_LABELS[category]}
              </span>
              <div className="h-1.5 flex-1 rounded bg-zinc-800">
                <div
                  className="h-full rounded bg-violet-400"
                  style={{ width: `${score.categories[category]}%` }}
                />
              </div>
              <span className="w-7 text-right font-mono text-[9px] text-zinc-400">
                {score.categories[category]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <SyncedPlayback original={original.graph} recreation={recreation} />

      {score.differences.length > 0 && (
        <>
          <h3 className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            What's off
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {score.differences.slice(0, 8).map((difference, index) => (
              <li key={index} className="font-mono text-[10px] leading-relaxed text-zinc-400">
                <span className="text-amber-300">{difference.property}</span> on{" "}
                <span className="text-zinc-300">{difference.selector}</span>: {difference.message}
              </li>
            ))}
          </ul>
        </>
      )}

      {score.suggestions.length > 0 && (
        <>
          <h3 className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            To get closer
          </h3>
          <ul className="mt-1 list-inside list-decimal text-[10px] leading-relaxed text-zinc-400">
            {score.suggestions.slice(0, 8).map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
