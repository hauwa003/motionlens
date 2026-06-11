import { useEffect, useState } from "react";

import { listAnalyses, type SavedAnalysis } from "~lib/history";

/**
 * Cloud sync (Phase 17) — pushes/pulls the local library through the web
 * app's /api/analyses endpoint, authenticated with a Supabase access token
 * copied from the dashboard.
 */

const SETTINGS_KEY = "sync-settings";
const DEFAULT_BASE_URL = "http://localhost:3000";

interface SyncSettings {
  baseUrl: string;
  token: string;
}

async function loadSettings(): Promise<SyncSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (
    (result[SETTINGS_KEY] as SyncSettings | undefined) ?? { baseUrl: DEFAULT_BASE_URL, token: "" }
  );
}

interface RemoteAnalysis {
  client_id: string;
  source_url: string;
  saved_at: string;
  graph: SavedAnalysis["graph"];
  frameworks: SavedAnalysis["frameworks"];
  tags: string[];
}

export function SyncPanel({
  onHistoryChanged,
}: {
  onHistoryChanged: (entries: SavedAnalysis[]) => void;
}) {
  const [settings, setSettings] = useState<SyncSettings>({
    baseUrl: DEFAULT_BASE_URL,
    token: "",
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const persist = (next: SyncSettings) => {
    setSettings(next);
    void chrome.storage.local.set({ [SETTINGS_KEY]: next });
  };

  const endpoint = `${settings.baseUrl.replace(/\/$/, "")}/api/analyses`;

  const push = async () => {
    setBusy("push");
    setStatus(null);
    try {
      const entries = await listAnalyses();
      if (entries.length === 0) {
        setStatus("Nothing to push — the library is empty.");
        return;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.token}`,
        },
        body: JSON.stringify({
          analyses: entries.map((entry) => ({
            client_id: entry.id,
            source_url: entry.sourceUrl,
            saved_at: entry.savedAt,
            graph: entry.graph,
            frameworks: entry.frameworks,
            tags: entry.tags,
          })),
        }),
      });
      const body = (await response.json()) as { error?: string; count?: number };
      setStatus(
        response.ok
          ? `Pushed ${body.count ?? entries.length} analyses ✓`
          : `Push failed: ${body.error}`,
      );
    } catch (error) {
      setStatus(`Push failed: ${String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const pull = async () => {
    setBusy("pull");
    setStatus(null);
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${settings.token}` },
      });
      const body = (await response.json()) as { error?: string; analyses?: RemoteAnalysis[] };
      if (!response.ok) {
        setStatus(`Pull failed: ${body.error}`);
        return;
      }

      const local = await listAnalyses();
      const byId = new Map(local.map((entry) => [entry.id, entry]));
      for (const remote of body.analyses ?? []) {
        byId.set(remote.client_id, {
          id: remote.client_id,
          sourceUrl: remote.source_url,
          savedAt: remote.saved_at,
          graph: remote.graph,
          frameworks: remote.frameworks ?? [],
          tags: remote.tags ?? [],
        });
      }
      const merged = Array.from(byId.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      await chrome.storage.local.set({ "analysis-history": merged });
      onHistoryChanged(merged);
      setStatus(`Pulled — library now has ${merged.length} analyses ✓`);
    } catch (error) {
      setStatus(`Pull failed: ${String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const ready = settings.token.trim().length > 0 && settings.baseUrl.trim().length > 0;

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-xs font-medium text-zinc-300"
      >
        Sync
        <span className="text-zinc-600">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={settings.baseUrl}
            onChange={(event) => persist({ ...settings, baseUrl: event.target.value })}
            placeholder="Web app URL"
            className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          <input
            value={settings.token}
            onChange={(event) => persist({ ...settings, token: event.target.value })}
            placeholder="Sync token (dashboard → Copy sync token)"
            type="password"
            className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!ready || busy !== null}
              onClick={() => void push()}
              className="flex-1 rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
            >
              {busy === "push" ? "Pushing…" : "Push library"}
            </button>
            <button
              type="button"
              disabled={!ready || busy !== null}
              onClick={() => void pull()}
              className="flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "pull" ? "Pulling…" : "Pull from cloud"}
            </button>
          </div>
          {status && <p className="text-[10px] text-zinc-500">{status}</p>}
        </div>
      )}
    </section>
  );
}
