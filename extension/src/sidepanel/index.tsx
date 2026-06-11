import { detectTrigger, diffCapture, type RawCapture } from "@motionlens/analysis";
import { useEffect, useMemo, useState } from "react";

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

function CaptureReport({ capture }: { capture: RawCapture }) {
  const changes = useMemo(() => diffCapture(capture), [capture]);
  const trigger = useMemo(() => detectTrigger(capture), [capture]);

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
        <button
          type="button"
          onClick={exportJson}
          className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          Export JSON
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[11px] text-zinc-400">
        <div className="flex justify-between">
          <dt>Trigger</dt>
          <dd className="font-mono text-violet-300">{trigger}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Duration</dt>
          <dd className="font-mono text-zinc-300">{capture.durationMs} ms</dd>
        </div>
        <div className="flex justify-between">
          <dt>Frames</dt>
          <dd className="font-mono text-zinc-300">{capture.frames.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Elements</dt>
          <dd className="font-mono text-zinc-300">{capture.observedElementCount}</dd>
        </div>
        {capture.stopReason !== "manual" && (
          <div className="col-span-2 flex justify-between">
            <dt>Stopped</dt>
            <dd className="font-mono text-amber-300">{capture.stopReason}</dd>
          </div>
        )}
      </dl>

      {changes.length > 0 ? (
        <>
          <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Property changes
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {changes.map((change) => (
              <li
                key={`${change.selector}-${change.property}`}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-emerald-300">{change.property}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {change.startMs}–{change.endMs} ms
                  </span>
                </div>
                <p
                  className="mt-1 truncate font-mono text-[10px] text-zinc-600"
                  title={change.selector}
                >
                  {change.selector}
                </p>
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[10px]">
                  <span className="truncate text-zinc-400" title={change.from}>
                    {change.from}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className="truncate text-right text-zinc-200" title={change.to}>
                    {change.to}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Timeline
          </h3>
          <ol className="mt-2 max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-2 font-mono text-[10px] leading-relaxed text-zinc-400">
            {capture.frames.map((frame, index) => (
              <li key={index} className="flex gap-2">
                <span className="w-12 shrink-0 text-right text-zinc-600">{frame.timestamp}ms</span>
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
        </>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      setTabId(tab.id);

      const [stateResponse, selectionResponse, captureResponse] = await Promise.all([
        sendToBackground({ type: MESSAGE_TYPES.GET_STATE, tabId: tab.id }),
        sendToBackground({ type: MESSAGE_TYPES.GET_SELECTION, tabId: tab.id }),
        sendToBackground({ type: MESSAGE_TYPES.GET_CAPTURE, tabId: tab.id }),
      ]);
      if (stateResponse.state) setState(stateResponse.state);
      setSelection(selectionResponse.selection ?? []);
      setCapture(captureResponse.capture ?? null);
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <StatusBadge state={state} />
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto p-4">
        {selection.length > 0 || capture ? (
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

            {capture && <CaptureReport capture={capture} />}
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
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 px-4 py-2 text-center text-[10px] text-zinc-600">
        See it. Decode it. Recreate it.
      </footer>
    </div>
  );
}

export default IndexSidePanel;
