import { generatePrompt } from "@motionlens/prompts";
import clsx from "clsx";
import {
  Check,
  Clock,
  Copy,
  Globe,
  Layers,
  Search,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Card, EmptyState, IconButton, Input, Pill, SectionHeader } from "~components/ui";
import { matchesQuery, type SavedAnalysis } from "~lib/history";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/* ─── Tag Editor ─── */

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
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
          className="group/tag"
        >
          <Pill variant="violet" className="hover:border-accent-red-border transition-colors">
            <Tag size={10} />
            {tag}
            <span className="text-text-disabled group-hover/tag:text-accent-red transition-colors">×</span>
          </Pill>
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
          className="h-6 w-32 rounded-lg border border-accent-violet-border bg-surface-raised px-1.5 text-xs-meta text-text-primary outline-none"
          placeholder="tag name"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs-meta text-text-disabled hover:text-accent-violet transition-colors"
        >
          + tag
        </button>
      )}
    </div>
  );
}

/* ─── History List (main export) ─── */

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

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No saved captures yet"
        description="Record a motion on any website, then save it to build your library."
      />
    );
  }

  const copyAllPrompts = async () => {
    const text = filtered
      .map((entry) => generatePrompt(entry.graph, "claude").text)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <SectionHeader
        title="Library"
        icon={BookOpen}
        action={
          filtered.length > 0 ? (
            <Button
              variant="secondary"
              icon={copied ? Check : Copy}
              onClick={() => void copyAllPrompts()}
              className={clsx("h-7 px-2 text-xs-meta", copied && "text-accent-emerald")}
            >
              {copied ? "Copied!" : `Copy prompts (${filtered.length})`}
            </Button>
          ) : undefined
        }
      />

      <div className="mt-3">
        <Input
          icon={Search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search site, trigger, motion, tag..."
        />
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Card interactive className="group">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <Globe size={12} className="shrink-0 text-text-tertiary" />
                    <span className="truncate text-sm font-medium text-text-primary">
                      {hostnameOf(entry.sourceUrl)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs-meta text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(entry.savedAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={10} />
                      {entry.graph.trigger}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers size={10} />
                      {entry.graph.nodes.length} element{entry.graph.nodes.length === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono">{entry.graph.durationMs}ms</span>
                  </div>
                </button>
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-disabled hover:text-accent-red"
                  onClick={() => onDelete(entry)}
                />
              </div>
              <TagEditor entry={entry} onUpdateTags={onUpdateTags} />
            </Card>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-4 text-center text-xs text-text-disabled">
            No matches for "{query}"
          </li>
        )}
      </ul>
    </div>
  );
}

// Re-export BookOpen for the empty state fallback in index
import { BookOpen } from "lucide-react";
