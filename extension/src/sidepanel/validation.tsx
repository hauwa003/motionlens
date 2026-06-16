import type { MotionGraph } from "@motionlens/motion-graph";
import { compareGraphs, SCORE_WEIGHTS, type ScoreCategory } from "@motionlens/validation";
import clsx from "clsx";
import {
  AlertTriangle,
  Lightbulb,
  Pause,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, IconButton, Pill, ProgressBar, SectionHeader } from "~components/ui";

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

function scoreColor(score: number): "emerald" | "amber" | "red" {
  return score >= 85 ? "emerald" : score >= 60 ? "amber" : "red";
}

/* ─── Circular Score Ring ─── */

function ScoreRing({ score }: { score: number }) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  const colorMap = {
    emerald: "stroke-accent-emerald",
    amber: "stroke-accent-amber",
    red: "stroke-accent-red",
  };
  const textColorMap = {
    emerald: "text-accent-emerald",
    amber: "text-accent-amber",
    red: "text-accent-red",
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-surface-raised"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className={clsx("text-lg font-semibold tabular-nums", textColorMap[color])}>
          {score}
        </span>
      </div>
    </div>
  );
}

/* ─── Gantt Rows ─── */

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
            className="relative h-2.5 rounded-sm bg-surface-raised"
            title={`${node.selector} ${change.property}`}
          >
            <div
              className={clsx("absolute h-full rounded-sm transition-opacity", color, active ? "opacity-100" : "opacity-30")}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Synced Playback ─── */

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
    <Card className="mt-3">
      <div className="flex items-center gap-2">
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? "Pause" : "Play"}
          className="h-8 w-8 bg-accent-violet text-white hover:bg-violet-500"
          onClick={() => {
            if (!playing && timeMs >= durationMs) setTimeMs(0);
            setPlaying((value) => !value);
          }}
        />
        <div className="flex-1">
          <ProgressBar value={timeMs} max={durationMs} />
        </div>
        <span className="w-20 text-right font-mono text-xs-meta text-text-tertiary">
          {Math.round(timeMs)}/{durationMs}ms
        </span>
      </div>

      <div className="mt-2">
        <p className="text-xs-meta font-medium uppercase tracking-wide text-text-disabled mb-1">Original</p>
        <GanttRows graph={original} durationMs={durationMs} timeMs={timeMs} color="bg-accent-violet" />
      </div>
      <div className="mt-2">
        <p className="text-xs-meta font-medium uppercase tracking-wide text-text-disabled mb-1">Recreation</p>
        <GanttRows graph={recreation} durationMs={durationMs} timeMs={timeMs} color="bg-accent-emerald" />
      </div>
    </Card>
  );
}

/* ─── Validation Panel (main export) ─── */

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
    <section className="mt-4 border-t border-surface-border pt-4">
      <SectionHeader
        title="Validation"
        action={
          <button
            type="button"
            onClick={onClearOriginal}
            className="text-xs-meta text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Clear original
          </button>
        }
      />
      <p className="mt-1 truncate text-xs-meta text-text-disabled" title={original.graph.sourceUrl}>
        vs {original.graph.sourceUrl}
      </p>

      <Card className="mt-3">
        <div className="flex items-center gap-4">
          <ScoreRing score={score.overall} />
          <div className="flex flex-1 flex-col gap-1.5">
            {(Object.keys(SCORE_WEIGHTS) as ScoreCategory[]).map((category) => {
              const val = score.categories[category];
              return (
                <div key={category} className="flex items-center gap-2">
                  <span className="w-12 text-xs-meta text-text-tertiary">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <ProgressBar
                    value={val}
                    color={scoreColor(val)}
                    className="h-2.5 flex-1"
                  />
                  <span className="w-7 text-right font-mono text-xs-meta text-text-secondary">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <SyncedPlayback original={original.graph} recreation={recreation} />

      {score.differences.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-1.5 text-xs-meta font-medium uppercase tracking-wide text-text-tertiary">
            <AlertTriangle size={12} />
            What's off
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {score.differences.slice(0, 8).map((difference, index) => (
              <Card key={index}>
                <div className="flex items-start gap-2 text-xs">
                  <Pill variant="amber" className="shrink-0">{difference.property}</Pill>
                  <div className="min-w-0">
                    <span className="font-mono text-text-secondary">{difference.selector}</span>
                    <p className="mt-0.5 text-text-tertiary">{difference.message}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {score.suggestions.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-1.5 text-xs-meta font-medium uppercase tracking-wide text-text-tertiary">
            <Lightbulb size={12} />
            To get closer
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {score.suggestions.slice(0, 8).map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-text-secondary">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-violet-muted text-xs-meta font-semibold text-accent-violet">
                  {index + 1}
                </span>
                {suggestion}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
