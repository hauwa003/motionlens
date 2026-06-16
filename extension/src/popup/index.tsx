import clsx from "clsx";
import { AlertCircle, AlertTriangle, ChevronRight, Globe, PanelRight, Square, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, EmptyState, ErrorCard, LoadingSpinner, Pill } from "~components/ui";
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
    const isActive = response.state?.active ?? false;
    setStatus(isActive ? "active" : "idle");
    // Auto-open the side panel when activating so users land right in the workflow
    if (isActive && tabId !== null) {
      void chrome.sidePanel.open({ tabId });
    }
  };

  const openSidePanel = () => {
    if (tabId !== null) void chrome.sidePanel.open({ tabId });
  };

  const active = status === "active";

  return (
    <div className="flex w-80 flex-col gap-3 bg-surface p-4 text-text-primary font-sans">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">
          Motion<span className="text-accent-violet">Lens</span>
        </h1>
        <Pill
          variant={active ? "emerald" : status === "unavailable" ? "red" : "default"}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-accent-emerald animate-pulse" : status === "unavailable" ? "bg-accent-red" : "bg-text-disabled",
            )}
          />
          {status === "loading" ? "..." : status}
        </Pill>
      </header>

      {/* Host */}
      {host && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <Globe size={12} className="shrink-0 text-text-tertiary" />
          <span className="truncate">{host}</span>
        </div>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      )}

      {/* Unavailable */}
      {status === "unavailable" && (
        <EmptyState
          icon={AlertCircle}
          title="Can't access this page"
          description="MotionLens works on standard web pages. Chrome internal pages and extensions are not supported."
        />
      )}

      {/* Toggle button */}
      {(status === "idle" || status === "active") && (
        <Button
          variant={active ? "danger" : "primary"}
          icon={active ? Square : Zap}
          onClick={() => void toggle()}
          className="h-11 w-full text-sm"
        >
          {active ? "Stop analyzing" : "Analyze this page"}
        </Button>
      )}

      {/* Error */}
      {error && (
        <ErrorCard
          message={error}
          onDismiss={() => setError(null)}
          onRetry={() => void toggle()}
        />
      )}

      {/* Side panel link */}
      <button
        type="button"
        onClick={openSidePanel}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 text-xs text-text-secondary transition-colors hover:border-accent-violet-border hover:text-text-primary"
      >
        <PanelRight size={14} className="text-text-tertiary" />
        <span className="flex-1 text-left">Open side panel</span>
        <ChevronRight size={14} className="text-text-disabled" />
      </button>
    </div>
  );
}

export default IndexPopup;
