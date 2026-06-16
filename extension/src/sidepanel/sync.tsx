import clsx from "clsx";
import {
  Cloud,
  Download,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, ErrorCard, Input, LoadingSpinner, SectionHeader } from "~components/ui";
import { listAnalyses, type SavedAnalysis } from "~lib/history";

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
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

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
        setStatus({ type: "error", message: "Nothing to push — the library is empty." });
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
          ? { type: "success", message: `Pushed ${body.count ?? entries.length} analyses` }
          : { type: "error", message: `Push failed: ${body.error}` },
      );
    } catch (error) {
      setStatus({ type: "error", message: `Push failed: ${String(error)}` });
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
        setStatus({ type: "error", message: `Pull failed: ${body.error}` });
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
      setStatus({ type: "success", message: `Library now has ${merged.length} analyses` });
    } catch (error) {
      setStatus({ type: "error", message: `Pull failed: ${String(error)}` });
    } finally {
      setBusy(null);
    }
  };

  const ready = settings.token.trim().length > 0 && settings.baseUrl.trim().length > 0;

  return (
    <div>
      <SectionHeader title="Cloud Sync" icon={Cloud} />

      <div className="mt-4 flex flex-col gap-3">
        <Input
          id="sync-url"
          label="Server URL"
          value={settings.baseUrl}
          onChange={(event) => persist({ ...settings, baseUrl: event.target.value })}
          placeholder="https://your-motionlens-app.vercel.app"
        />

        <div>
          <label htmlFor="sync-token" className="mb-1 block text-xs-meta font-medium text-text-secondary">
            Sync token
          </label>
          <div className="relative">
            <input
              id="sync-token"
              value={settings.token}
              onChange={(event) => persist({ ...settings, token: event.target.value })}
              placeholder="Paste from dashboard"
              type={showToken ? "text" : "password"}
              className="h-9 w-full rounded-lg border border-surface-border bg-surface-raised px-3 pr-9 text-xs text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-accent-violet-border"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            icon={busy === "push" ? undefined : Upload}
            loading={busy === "push"}
            disabled={!ready || busy !== null}
            onClick={() => void push()}
            className="flex-1"
          >
            {busy === "push" ? "Pushing..." : "Push"}
          </Button>
          <Button
            variant="secondary"
            icon={busy === "pull" ? undefined : Download}
            loading={busy === "pull"}
            disabled={!ready || busy !== null}
            onClick={() => void pull()}
            className="flex-1"
          >
            {busy === "pull" ? "Pulling..." : "Pull"}
          </Button>
        </div>

        {status && (
          <Card
            variant={status.type === "error" ? "error" : "default"}
            className={clsx(
              "animate-slide-up",
              status.type === "success" && "border-accent-emerald-border bg-accent-emerald-muted",
            )}
          >
            <p
              className={clsx(
                "text-xs",
                status.type === "success" ? "text-emerald-300" : "text-red-200",
              )}
            >
              {status.message}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
