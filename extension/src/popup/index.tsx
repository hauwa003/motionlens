import { useEffect, useState } from "react";

import {
  getActiveTab,
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
} from "~lib/messaging";

import "~style.css";

type Status = "loading" | "idle" | "active" | "unavailable";

function IndexPopup() {
  const [status, setStatus] = useState<Status>("loading");
  const [tabId, setTabId] = useState<number | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (
        !tab?.id ||
        tab.url?.startsWith("chrome://") ||
        tab.url?.startsWith("chrome-extension://")
      ) {
        setStatus("unavailable");
        return;
      }
      setTabId(tab.id);
      if (tab.url) setHost(new URL(tab.url).hostname);

      const response = await sendToBackground({ type: MESSAGE_TYPES.GET_STATE, tabId: tab.id });
      setStatus(response.state?.active ? "active" : "idle");
    })();
  }, []);

  // Keep the toggle in sync if state changes elsewhere (e.g. side panel).
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.STATE_CHANGED && message.tabId === tabId) {
        setStatus(message.state.active ? "active" : "idle");
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  const toggle = async () => {
    if (tabId === null) return;
    setError(null);

    const response = await sendToBackground({
      type: status === "active" ? MESSAGE_TYPES.DEACTIVATE : MESSAGE_TYPES.ACTIVATE,
      tabId,
    });

    if (!response.ok) {
      setError(response.error ?? "Something went wrong.");
      return;
    }
    setStatus(response.state?.active ? "active" : "idle");
  };

  const openSidePanel = () => {
    if (tabId !== null) void chrome.sidePanel.open({ tabId });
  };

  const active = status === "active";

  return (
    <div className="flex w-72 flex-col gap-4 bg-zinc-950 p-4 text-zinc-100">
      <header className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-400">
          <span
            className={`h-2 w-2 rounded-full ${
              active ? "bg-emerald-400" : status === "unavailable" ? "bg-red-400" : "bg-zinc-600"
            }`}
          />
          {status === "loading" ? "…" : status}
        </span>
      </header>

      {host && <p className="truncate text-xs text-zinc-500">{host}</p>}

      {status === "unavailable" ? (
        <p className="text-xs text-zinc-400">
          MotionLens can't analyze this page. Open a regular website and try again.
        </p>
      ) : (
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => void toggle()}
          className={`rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            active
              ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              : "bg-zinc-100 text-zinc-950 hover:bg-white"
          }`}
        >
          {active ? "Stop analyzing" : "Analyze this page"}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={openSidePanel}
        className="text-left text-xs text-zinc-400 underline-offset-2 transition-colors hover:text-zinc-200 hover:underline"
      >
        Open side panel →
      </button>
    </div>
  );
}

export default IndexPopup;
