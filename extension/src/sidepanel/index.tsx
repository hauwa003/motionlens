import { buildMotionGraph, type FrameworkScore, type RawCapture } from "@motionlens/analysis";
import { useEffect, useMemo, useState } from "react";

import {
  deleteAnalysis,
  listAnalyses,
  saveAnalysis,
  updateAnalysisTags,
  type SavedAnalysis,
} from "~lib/history";
import type { DiscoveredInteraction } from "~lib/scanner";

import { MotionBreakdown } from "./breakdown";
import { HistoryList } from "./history";
import { PromptPanel } from "./prompts";
import { SyncPanel } from "./sync";
import {
  clearOriginal,
  loadOriginal,
  saveOriginal,
  ValidationPanel,
  type SavedOriginal,
} from "./validation";

import {
  getActiveTab,
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
  type SelectedElementInfo,
  type TabState,
} from "~lib/messaging";

import "~style.css";

function StatusBadge({ state }: { state: TabState }) {
  const label = state.recording ? "Recording" : state.active ? "Analyzing" : "Idle";
  const dot = state.recording
    ? "bg-red-400 animate-pulse"
    : state.active
      ? "bg-emerald-400"
      : "bg-zinc-600";

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ElementCard({ element }: { element: SelectedElementInfo }) {
  const label =
    element.tag +
    (element.id ? `#${element.id}` : "") +
    element.classes.map((c) => `.${c}`).join("");

  return (
    <li className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-left">
      <p className="truncate font-mono text-xs text-emerald-300">{label}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        <div className="flex justify-between">
          <dt>Size</dt>
          <dd className="font-mono text-zinc-300">
            {element.rect.width} × {element.rect.height}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Position</dt>
          <dd className="font-mono text-zinc-300">
            {element.rect.x}, {element.rect.y}
          </dd>
        </div>
      </dl>
      <p className="mt-2 truncate font-mono text-[10px] text-zinc-600" title={element.selector}>
        {element.selector}
      </p>
    </li>
  );
}

function CaptureReport({
  capture,
  frameworks,
  onSaveOriginal,
  onSaveToHistory,
}: {
  capture: RawCapture;
  frameworks: FrameworkScore[];
  onSaveOriginal: () => void;
  onSaveToHistory: () => void;
}) {
  const graph = useMemo(() => buildMotionGraph(capture), [capture]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(capture, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `motionlens-capture-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-4 border-t border-zinc-900 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-300">Last capture</h2>
        <div className="flex gap-3">
          {graph.nodes.length > 0 && (
            <>
              <button
                type="button"
                onClick={onSaveToHistory}
                className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
                title="Save this analysis to history"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onSaveOriginal}
                className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
                title="Save this capture as the original to validate a recreation against"
              >
                Save as original
              </button>
            </>
          )}
          <button
            type="button"
            onClick={exportJson}
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Export JSON
          </button>
        </div>
      </div>

      {graph.nodes.length > 0 ? (
        <div className="mt-3">
          <MotionBreakdown graph={graph} frameworks={frameworks} />

          <details className="mt-4">
            <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
              Raw frames ({capture.frames.length}
              {capture.stopReason !== "manual" ? ` · stopped: ${capture.stopReason}` : ""})
            </summary>
            <ol className="mt-2 max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-2 font-mono text-[10px] leading-relaxed text-zinc-400">
              {capture.frames.map((frame, index) => (
                <li key={index} className="flex gap-2">
                  <span className="w-12 shrink-0 text-right text-zinc-600">
                    {frame.timestamp}ms
                  </span>
                  <span
                    className="truncate"
                    title={`${frame.selector} ${JSON.stringify(frame.styles)}`}
                  >
                    {Object.entries(frame.styles)
                      .map(([property, value]) => `${property}: ${value}`)
                      .join("  ")}
                  </span>
                </li>
              ))}
            </ol>
          </details>

          <PromptPanel graph={graph} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          No style changes captured. Trigger the interaction while recording.
        </p>
      )}
    </section>
  );
}

function IndexSidePanel() {
  const [state, setState] = useState<TabState>({ active: false, recording: false });
  const [tabId, setTabId] = useState<number | null>(null);
  const [selection, setSelection] = useState<SelectedElementInfo[]>([]);
  const [capture, setCapture] = useState<RawCapture | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkScore[]>([]);
  const [original, setOriginal] = useState<SavedOriginal | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [viewing, setViewing] = useState<SavedAnalysis | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredInteraction[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recreationGraph = useMemo(() => (capture ? buildMotionGraph(capture) : null), [capture]);

  useEffect(() => {
    void loadOriginal().then(setOriginal);
    void listAnalyses().then(setHistory);
  }, []);

  const handleSaveToHistory = () => {
    if (!recreationGraph || recreationGraph.nodes.length === 0) return;
    void saveAnalysis(recreationGraph, frameworks).then(setHistory);
  };

  const handleSaveOriginal = () => {
    if (!recreationGraph) return;
    void saveOriginal(recreationGraph).then(setOriginal);
  };

  const handleClearOriginal = () => {
    void clearOriginal().then(() => setOriginal(null));
  };

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      setTabId(tab.id);

      const [stateResponse, selectionResponse, captureResponse, frameworksResponse] =
        await Promise.all([
          sendToBackground({ type: MESSAGE_TYPES.GET_STATE, tabId: tab.id }),
          sendToBackground({ type: MESSAGE_TYPES.GET_SELECTION, tabId: tab.id }),
          sendToBackground({ type: MESSAGE_TYPES.GET_CAPTURE, tabId: tab.id }),
          sendToBackground({ type: MESSAGE_TYPES.GET_FRAMEWORKS, tabId: tab.id }),
        ]);
      if (stateResponse.state) setState(stateResponse.state);
      setSelection(selectionResponse.selection ?? []);
      setCapture(captureResponse.capture ?? null);
      setFrameworks(frameworksResponse.frameworks ?? []);
    })();
  }, []);

  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.STATE_CHANGED && message.tabId === tabId) {
        setState(message.state);
        if (!message.state.active) setSelection([]);
      }
      if (message.type === MESSAGE_TYPES.SELECTION_CHANGED && message.tabId === tabId) {
        setSelection(message.selection);
      }
      if (message.type === MESSAGE_TYPES.CAPTURE_CHANGED && message.tabId === tabId) {
        setCapture(message.capture);
      }
      if (message.type === MESSAGE_TYPES.FRAMEWORKS_CHANGED && message.tabId === tabId) {
        setFrameworks(message.frameworks);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  const command = async (type: ExtensionMessage["type"]) => {
    if (tabId === null) return;
    setError(null);
    const response = await sendToBackground({ type, tabId } as ExtensionMessage);
    if (!response.ok) setError(response.error ?? "Something went wrong.");
  };

  const scanPage = async () => {
    if (tabId === null) return;
    setScanning(true);
    setError(null);
    const response = await sendToBackground({ type: MESSAGE_TYPES.SCAN_INTERACTIONS, tabId });
    setScanning(false);
    if (!response.ok) {
      setError(response.error ?? "Scan failed.");
      return;
    }
    setDiscovered(response.interactions ?? []);
  };

  const selectDiscovered = async (selector: string) => {
    if (tabId === null) return;
    const response = await sendToBackground({
      type: MESSAGE_TYPES.SELECT_ELEMENT,
      tabId,
      selector,
    });
    if (!response.ok) setError(response.error ?? "Couldn't select that element.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <StatusBadge state={state} />
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto p-4">
        {viewing ? (
          <div>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="mb-3 text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
            >
              ← Back
            </button>
            <p className="mb-2 truncate text-xs text-zinc-400" title={viewing.sourceUrl}>
              {viewing.sourceUrl}
            </p>
            <MotionBreakdown graph={viewing.graph} frameworks={viewing.frameworks} />
            <PromptPanel graph={viewing.graph} />
          </div>
        ) : selection.length > 0 || capture ? (
          <>
            {selection.length > 0 && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-medium text-zinc-300">
                    {selection.length} element{selection.length === 1 ? "" : "s"} selected
                  </h2>
                  <button
                    type="button"
                    onClick={() => void command(MESSAGE_TYPES.CLEAR_SELECTION)}
                    className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="flex flex-col gap-2">
                  {selection.map((element) => (
                    <ElementCard key={element.selector} element={element} />
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    void command(
                      state.recording
                        ? MESSAGE_TYPES.STOP_RECORDING
                        : MESSAGE_TYPES.START_RECORDING,
                    )
                  }
                  className={`mt-4 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    state.recording
                      ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                      : "bg-zinc-100 text-zinc-950 hover:bg-white"
                  }`}
                >
                  {state.recording ? "■ Stop recording" : "● Record interaction (max 10s)"}
                </button>

                {state.recording && (
                  <p className="mt-2 text-center text-[11px] text-zinc-500">
                    Trigger the interaction on the page — hover, click, or scroll.
                  </p>
                )}
              </>
            )}

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            {capture && (
              <CaptureReport
                capture={capture}
                frameworks={frameworks}
                onSaveOriginal={handleSaveOriginal}
                onSaveToHistory={handleSaveToHistory}
              />
            )}

            {original && recreationGraph && recreationGraph.nodes.length > 0 && (
              <ValidationPanel
                original={original}
                recreation={recreationGraph}
                onClearOriginal={handleClearOriginal}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            {state.active ? (
              <>
                <h2 className="text-sm font-medium">Pick an element</h2>
                <p className="max-w-xs text-xs text-zinc-400">
                  Hover the page to highlight elements, click to select them. Press Escape to clear
                  the selection, or again to stop.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-medium">No analysis yet</h2>
                <p className="max-w-xs text-xs text-zinc-400">
                  Activate MotionLens from the toolbar popup, then select an element to capture its
                  motion.
                </p>
                <ol className="mt-3 max-w-xs list-inside list-decimal space-y-1 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-left text-[11px] text-zinc-500">
                  <li>
                    Activate with the toolbar popup or{" "}
                    <kbd className="rounded bg-zinc-800 px-1 font-mono text-[10px]">
                      Alt+Shift+M
                    </kbd>
                  </li>
                  <li>Hover and click to select the animated element(s)</li>
                  <li>Record, then trigger the interaction on the page</li>
                  <li>Copy the generated prompt into your AI tool</li>
                </ol>
              </>
            )}
          </div>
        )}

        {!viewing && state.active && (
          <section className="mt-4 border-t border-zinc-900 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-zinc-300">Discover</h2>
              <button
                type="button"
                disabled={scanning}
                onClick={() => void scanPage()}
                className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-50"
              >
                {scanning ? "Scanning…" : discovered ? "Rescan" : "Scan this page"}
              </button>
            </div>
            {discovered && discovered.length === 0 && (
              <p className="mt-2 text-[11px] text-zinc-600">
                No likely interactions found on this page.
              </p>
            )}
            {discovered && discovered.length > 0 && (
              <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {discovered.map((interaction) => (
                  <li
                    key={interaction.selector}
                    className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-mono text-[10px] text-zinc-300"
                        title={interaction.selector}
                      >
                        {interaction.selector}
                      </p>
                      <p className="text-[9px] text-zinc-600">{interaction.evidence.join(" · ")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void selectDiscovered(interaction.selector)}
                      className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700"
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!viewing && (
          <>
            <HistoryList
              entries={history}
              onOpen={setViewing}
              onDelete={(entry) => void deleteAnalysis(entry.id).then(setHistory)}
              onUpdateTags={(entry, tags) =>
                void updateAnalysisTags(entry.id, tags).then(setHistory)
              }
            />
            <SyncPanel onHistoryChanged={setHistory} />
          </>
        )}
      </main>

      <footer className="border-t border-zinc-900 px-4 py-2 text-center text-[10px] text-zinc-600">
        See it. Decode it. Recreate it.
      </footer>
    </div>
  );
}

export default IndexSidePanel;
