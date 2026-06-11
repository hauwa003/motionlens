import type { SavedAnalysis } from "~lib/history";

/**
 * History UI (Phase 16) — saved analysis list with reopen/delete/export.
 */

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function HistoryList({
  entries,
  onOpen,
  onDelete,
}: {
  entries: SavedAnalysis[];
  onOpen: (entry: SavedAnalysis) => void;
  onDelete: (entry: SavedAnalysis) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <h2 className="text-xs font-medium text-zinc-300">History</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="group flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-zinc-700"
          >
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-[11px] text-zinc-200">{hostnameOf(entry.sourceUrl)}</p>
              <p className="font-mono text-[9px] text-zinc-500">
                {new Date(entry.savedAt).toLocaleString()} · on {entry.graph.trigger} ·{" "}
                {entry.graph.nodes.length} element{entry.graph.nodes.length === 1 ? "" : "s"} ·{" "}
                {entry.graph.durationMs}ms
              </p>
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry)}
              className="text-[10px] text-zinc-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
              title="Delete"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
