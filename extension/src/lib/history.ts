import type { FrameworkScore } from "@motionlens/analysis";
import type { MotionGraph } from "@motionlens/motion-graph";

/**
 * Analysis history (Phase 16) — saved analyses in chrome.storage.local.
 * Stores the MotionGraph (not raw frames) to stay well within quota;
 * raw captures remain exportable as JSON while live.
 */

export interface SavedAnalysis {
  id: string;
  sourceUrl: string;
  savedAt: string;
  graph: MotionGraph;
  frameworks: FrameworkScore[];
  tags: string[];
}

const HISTORY_KEY = "analysis-history";
const MAX_ENTRIES = 50;

export async function listAnalyses(): Promise<SavedAnalysis[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  const entries = (result[HISTORY_KEY] as SavedAnalysis[] | undefined) ?? [];
  // Entries saved before tags existed.
  return entries.map((entry) => ({ ...entry, tags: entry.tags ?? [] }));
}

export async function saveAnalysis(
  graph: MotionGraph,
  frameworks: FrameworkScore[],
): Promise<SavedAnalysis[]> {
  const entry: SavedAnalysis = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceUrl: graph.sourceUrl,
    savedAt: new Date().toISOString(),
    graph,
    frameworks,
    tags: [],
  };
  const history = [entry, ...(await listAnalyses())].slice(0, MAX_ENTRIES);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  return history;
}

export async function deleteAnalysis(id: string): Promise<SavedAnalysis[]> {
  const history = (await listAnalyses()).filter((entry) => entry.id !== id);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  return history;
}

export async function updateAnalysisTags(id: string, tags: string[]): Promise<SavedAnalysis[]> {
  const history = (await listAnalyses()).map((entry) =>
    entry.id === id ? { ...entry, tags } : entry,
  );
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  return history;
}

/** Case-insensitive match on hostname, trigger, motion types, and tags. */
export function matchesQuery(entry: SavedAnalysis, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    entry.sourceUrl,
    entry.graph.trigger,
    ...entry.tags,
    ...entry.graph.nodes.flatMap((node) => node.motionTypes),
    ...entry.frameworks.map((framework) => framework.framework),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
