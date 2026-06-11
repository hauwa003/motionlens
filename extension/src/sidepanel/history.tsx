import { generatePrompt } from "@motionlens/prompts";
import { useMemo, useState } from "react";

import { matchesQuery, type SavedAnalysis } from "~lib/history";

/**
 * Motion library UI (Phases 16 + 20) — saved analyses with search, tags,
 * reopen/delete, and batch prompt export.
 */

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function TagEditor({
  entry,
  onUpdateTags,
}: {
  entry: SavedAnalysis;
  onUpdateTags: (entry: SavedAnalysis, tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim().toLowerCase();
    setDraft("");
    setAdding(false);
    if (tag && !entry.tags.includes(tag)) {
      onUpdateTags(entry, [...entry.tags, tag]);
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {entry.tags.map((tag) => (
        <button
          key={tag}
          type="button"
          title="Remove tag"
          onClick={() =>
            onUpdateTags(
              entry,
              entry.tags.filter((candidate) => candidate !== tag),
            )
          }
          className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:bg-zinc-700"
        >
          {tag} ✕
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[9px] text-zinc-200 outline-none"
          placeholder="tag name"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-[9px] text-zinc-600 hover:text-zinc-300"
        >
          + tag
        </button>
      )}
    </div>
  );
}

export function HistoryList({
  entries,
  onOpen,
  onDelete,
  onUpdateTags,
}: {
  entries: SavedAnalysis[];
  onOpen: (entry: SavedAnalysis) => void;
  onDelete: (entry: SavedAnalysis) => void;
  onUpdateTags: (entry: SavedAnalysis, tags: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(
    () => entries.filter((entry) => matchesQuery(entry, query)),
    [entries, query],
  );

  if (entries.length === 0) return null;

  const copyAllPrompts = async () => {
    const text = filtered
      .map((entry) => generatePrompt(entry.graph, "claude").text)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-300">Library</h2>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => void copyAllPrompts()}
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
            title="Copy Claude prompts for every analysis shown below"
          >
            {copied ? "Copied ✓" : `Copy prompts (${filtered.length})`}
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search site, trigger, motion, tag…"
        className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
      />

      <ul className="mt-2 flex flex-col gap-1.5">
        {filtered.map((entry) => (
          <li
            key={entry.id}
            className="group rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-zinc-700"
          >
            <div className="flex items-center gap-2">
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
            </div>
            <TagEditor entry={entry} onUpdateTags={onUpdateTags} />
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-2 text-center text-[11px] text-zinc-600">No matches for “{query}”</li>
        )}
      </ul>
    </section>
  );
}
