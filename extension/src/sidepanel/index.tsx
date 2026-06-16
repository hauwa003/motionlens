import { buildMotionGraph, type FrameworkScore, type RawCapture } from "@motionlens/analysis";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Box,
  Check,
  Cloud,
  Crosshair,
  MousePointer,
  Plus,
  Radar,
  Save,
  Square,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Card,
  EmptyState,
  ErrorCard,
  IconButton,
  Kbd,
  LoadingSpinner,
  Pill,
  ProgressBar,
  SectionHeader,
  Skeleton,
} from "~components/ui";
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

/* ─── Tab types ─── */

type Tab = "capture" | "library" | "sync";

const TABS: { id: Tab; label: string; icon: typeof Crosshair }[] = [
  { id: "capture", label: "Capture", icon: Crosshair },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "sync", label: "Sync", icon: Cloud },
];

/* ─── Status Badge ─── */

function StatusBadge({ state }: { state: TabState }) {
  const label = state.recording ? "Recording" : state.active ? "Analyzing" : "Idle";
  const variant = state.recording ? "red" : state.active ? "emerald" : "default";

  return (
    <Pill variant={variant as "red" | "emerald" | "default"}>
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          state.recording
            ? "bg-accent-red animate-pulse-record"
            : state.active
              ? "bg-accent-emerald"
              : "bg-text-disabled",
        )}
      />
      {label}
    </Pill>
  );
}

/* ─── Element Card ─── */

function ElementCard({
  element,
  index,
  onRemove,
}: {
  element: SelectedElementInfo;
  index: number;
  onRemove: () => void;
}) {
  const label =
    element.tag +
    (element.id ? `#${element.id}` : "") +
    element.classes.map((c) => `.${c}`).join("");

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Card interactive className="group relative">
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent-emerald-muted">
            <Box size={14} className="text-accent-emerald" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm text-accent-emerald" title={label}>
              {label}
            </p>
            <div className="mt-1 flex gap-3 text-xs-meta text-text-tertiary">
              <span className="font-mono">
                {element.rect.width} × {element.rect.height}
              </span>
              <span className="font-mono">
                ({element.rect.x}, {element.rect.y})
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-xs-meta text-text-disabled" title={element.selector}>
              {element.selector}
            </p>
          </div>
          <IconButton
            icon={X}
            label="Remove element"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          />
        </div>
      </Card>
    </motion.li>
  );
}

/* ─── Recording Banner ─── */

function RecordingBanner({
  onStop,
  startTime,
}: {
  onStop: () => void;
  startTime: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.min(10, (Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden border-b border-accent-red-border bg-accent-red-muted"
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-accent-red animate-pulse-record" />
        <div className="flex-1">
          <ProgressBar value={elapsed} max={10} color="red" />
        </div>
        <span className="shrink-0 font-mono text-xs-meta text-red-200">
          {elapsed.toFixed(1)}s
        </span>
        <IconButton
          icon={Square}
          label="Stop recording"
          className="h-6 w-6 bg-accent-red/20 hover:bg-accent-red/30 text-accent-red"
          onClick={onStop}
        />
      </div>
    </motion.div>
  );
}

/* ─── Capture Report ─── */

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
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 border-t border-surface-border pt-4"
    >
      <SectionHeader
        title="Last capture"
        action={
          graph.nodes.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="ghost" icon={Save} onClick={onSaveToHistory} className="h-7 px-2 text-xs-meta">
                Save
              </Button>
              <Button variant="ghost" onClick={onSaveOriginal} className="h-7 px-2 text-xs-meta">
                Save as original
              </Button>
              <Button variant="ghost" onClick={exportJson} className="h-7 px-2 text-xs-meta">
                Export
              </Button>
            </div>
          ) : undefined
        }
      />

      {graph.nodes.length > 0 ? (
        <div className="mt-3">
          <MotionBreakdown graph={graph} frameworks={frameworks} />

          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs-meta font-medium uppercase tracking-wide text-text-tertiary hover:text-text-secondary transition-colors">
              Raw frames ({capture.frames.length}
              {capture.stopReason !== "manual" ? ` · stopped: ${capture.stopReason}` : ""})
            </summary>
            <ol className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-surface-border bg-surface-raised p-2 font-mono text-xs-meta leading-relaxed text-text-secondary">
              {capture.frames.map((frame, index) => (
                <li key={index} className="flex gap-2">
                  <span className="w-12 shrink-0 text-right text-text-disabled">
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
        <EmptyState
          icon={Crosshair}
          title="No motion detected"
          description="Nothing changed on those elements during recording. Try triggering a hover, click, or scroll while recording."
        />
      )}
    </motion.section>
  );
}

/* ─── Workflow Stepper ─── */

type WorkflowStep = 0 | 1 | 2 | 3;

function getWorkflowStep(active: boolean, hasSelection: boolean, hasCapture: boolean): WorkflowStep {
  if (!active) return 0;
  if (!hasSelection) return 1;
  if (!hasCapture) return 2;
  return 3;
}

const STEPS = [
  { label: "Activate MotionLens", description: "From the toolbar popup or", kbd: "Alt+Shift+M" },
  { label: "Select elements", description: "Hover to highlight, click to pick" },
  { label: "Record the motion", description: "Trigger the hover, click, or scroll" },
  { label: "Copy the prompt", description: "Paste into your AI tool of choice" },
];

function WorkflowStepper({
  currentStep,
}: {
  currentStep: WorkflowStep;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-raised">
        {currentStep === 0 ? (
          <Zap size={24} className="text-accent-violet" />
        ) : (
          <MousePointer size={24} className="text-accent-emerald" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">
          {currentStep === 0 ? "Ready to capture" : STEPS[currentStep].label}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {STEPS[currentStep].description}
          {STEPS[currentStep].kbd && (
            <>
              {" "}
              <Kbd>{STEPS[currentStep].kbd!}</Kbd>
            </>
          )}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-1.5">
        {STEPS.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div
              key={i}
              className={clsx(
                "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                done
                  ? "border-accent-emerald-border bg-accent-emerald-muted"
                  : active
                    ? "border-accent-violet-border bg-accent-violet-muted"
                    : "border-surface-border bg-surface-raised opacity-50",
              )}
            >
              <span
                className={clsx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs-meta font-semibold",
                  done
                    ? "bg-accent-emerald text-surface"
                    : active
                      ? "bg-accent-violet text-white"
                      : "bg-surface-border text-text-disabled",
                )}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span
                className={clsx(
                  "text-xs",
                  done ? "text-emerald-300" : active ? "text-text-primary" : "text-text-disabled",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Discovery Panel ─── */

function DiscoveryPanel({
  discovered,
  scanning,
  onScan,
  onSelect,
}: {
  discovered: DiscoveredInteraction[] | null;
  scanning: boolean;
  onScan: () => void;
  onSelect: (selector: string) => void;
}) {
  return (
    <section className="mt-4 border-t border-surface-border pt-4">
      <SectionHeader
        title="Discover interactions"
        icon={Radar}
        action={
          <Button
            variant="secondary"
            onClick={onScan}
            loading={scanning}
            className="h-7 px-2 text-xs-meta"
          >
            {discovered ? "Rescan" : "Scan"}
          </Button>
        }
      />

      {scanning && (
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {!scanning && discovered && discovered.length === 0 && (
        <p className="mt-3 text-xs text-text-disabled">
          No likely interactions found on this page.
        </p>
      )}

      {!scanning && discovered && discovered.length > 0 && (
        <ul className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {discovered.map((interaction) => (
            <li key={interaction.selector}>
              <Card className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm text-text-primary"
                    title={interaction.selector}
                  >
                    {interaction.selector}
                  </p>
                  <p className="mt-0.5 text-xs-meta text-text-tertiary">
                    {interaction.evidence.join(" · ")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => onSelect(interaction.selector)}
                  className="h-7 shrink-0 px-2 text-xs-meta"
                >
                  Add
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Main Side Panel ─── */

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
  const [activeTab, setActiveTab] = useState<Tab>("capture");
  const recordStartRef = useRef(Date.now());
  const scrollPositions = useRef<Record<Tab, number>>({ capture: 0, library: 0, sync: 0 });
  const mainRef = useRef<HTMLElement>(null);

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
        if (message.state.recording) recordStartRef.current = Date.now();
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

  const command = useCallback(
    async (type: ExtensionMessage["type"]) => {
      if (tabId === null) return;
      setError(null);
      if (type === MESSAGE_TYPES.START_RECORDING) recordStartRef.current = Date.now();
      const response = await sendToBackground({ type, tabId } as ExtensionMessage);
      if (!response.ok) setError(response.error ?? "Something went wrong.");
    },
    [tabId],
  );

  const scanPage = useCallback(async () => {
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
  }, [tabId]);

  const selectDiscovered = useCallback(
    async (selector: string) => {
      if (tabId === null) return;
      const response = await sendToBackground({
        type: MESSAGE_TYPES.SELECT_ELEMENT,
        tabId,
        selector,
      });
      if (!response.ok) setError(response.error ?? "Couldn't select that element.");
    },
    [tabId],
  );

  const removeElement = useCallback(
    async (selector: string) => {
      if (tabId === null) return;
      setError(null);
      const response = await sendToBackground({
        type: MESSAGE_TYPES.REMOVE_ELEMENT,
        tabId,
        selector,
      });
      if (!response.ok) setError(response.error ?? "Couldn't remove that element.");
    },
    [tabId],
  );

  // Save scroll position when switching tabs, restore on return
  const switchTab = useCallback(
    (next: Tab) => {
      if (next === activeTab) return;
      if (mainRef.current) {
        scrollPositions.current[activeTab] = mainRef.current.scrollTop;
      }
      setActiveTab(next);
      requestAnimationFrame(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = scrollPositions.current[next];
        }
      });
    },
    [activeTab],
  );

  // Keyboard shortcut for tab switching
  useEffect(() => {
    const tabs: Tab[] = ["capture", "library", "sync"];
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < tabs.length) switchTab(tabs[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [switchTab]);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-primary font-sans">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight">
          Motion<span className="text-accent-violet">Lens</span>
        </h1>
        <StatusBadge state={state} />
      </header>

      {/* Recording banner */}
      <AnimatePresence>
        {state.recording && (
          <RecordingBanner
            onStop={() => void command(MESSAGE_TYPES.STOP_RECORDING)}
            startTime={recordStartRef.current}
          />
        )}
      </AnimatePresence>

      {/* Tab navigation */}
      <nav
        role="tablist"
        className="flex border-b border-surface-border px-4"
        aria-label="Main navigation"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => switchTab(tab.id)}
              className={clsx(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                active ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {active && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent-violet"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      <main ref={mainRef} className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "capture" && (
            <motion.div
              key="capture"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col p-4"
              role="tabpanel"
              aria-label="Capture"
            >
              {viewing ? (
                <div className="animate-fade-in">
                  <Button
                    variant="ghost"
                    icon={ArrowLeft}
                    onClick={() => setViewing(null)}
                    className="mb-3 h-7 px-2 text-xs-meta"
                  >
                    Back
                  </Button>
                  <p className="mb-2 truncate text-xs text-text-secondary" title={viewing.sourceUrl}>
                    {viewing.sourceUrl}
                  </p>
                  <MotionBreakdown graph={viewing.graph} frameworks={viewing.frameworks} />
                  <PromptPanel graph={viewing.graph} />
                </div>
              ) : selection.length > 0 || capture ? (
                <>
                  {selection.length > 0 && (
                    <>
                      <SectionHeader
                        title={`${selection.length} element${selection.length === 1 ? "" : "s"} selected`}
                        action={
                          <Button
                            variant="ghost"
                            onClick={() => void command(MESSAGE_TYPES.CLEAR_SELECTION)}
                            className="h-7 px-2 text-xs-meta"
                          >
                            Clear all
                          </Button>
                        }
                        className="mb-3"
                      />

                      <ul className="flex flex-col gap-2">
                        <AnimatePresence>
                          {selection.map((element, i) => (
                            <ElementCard
                              key={element.selector}
                              element={element}
                              index={i}
                              onRemove={() => removeElement(element.selector)}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>

                      {/* Record button */}
                      {!state.recording && (
                        <Button
                          variant={state.recording ? "danger" : "primary"}
                          icon={Crosshair}
                          onClick={() => void command(MESSAGE_TYPES.START_RECORDING)}
                          className="mt-4 h-11 w-full"
                        >
                          <span className="flex-1 text-left">Record</span>
                          <span className="text-xs-meta opacity-60">10s max</span>
                        </Button>
                      )}

                      {state.recording && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 rounded-lg border border-accent-red-border bg-accent-red-muted p-3 text-center"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-accent-red animate-pulse-record" />
                            <span className="text-xs font-medium text-red-200">Recording in progress</span>
                          </div>
                          <p className="mt-1 text-xs text-red-200/70">
                            Go to the page and trigger the motion — hover, click, or scroll.
                          </p>
                        </motion.div>
                      )}
                    </>
                  )}

                  {error && (
                    <ErrorCard
                      message={error}
                      onRetry={() => setError(null)}
                      onDismiss={() => setError(null)}
                    />
                  )}

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
                <WorkflowStepper
                  currentStep={getWorkflowStep(state.active, selection.length > 0, capture !== null)}
                />
              )}

              {/* Discovery — visible when active */}
              {!viewing && state.active && (
                <DiscoveryPanel
                  discovered={discovered}
                  scanning={scanning}
                  onScan={() => void scanPage()}
                  onSelect={(selector) => void selectDiscovered(selector)}
                />
              )}
            </motion.div>
          )}

          {activeTab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col p-4"
              role="tabpanel"
              aria-label="Library"
            >
              <HistoryList
                entries={history}
                onOpen={(entry) => {
                  setViewing(entry);
                  switchTab("capture");
                }}
                onDelete={(entry) => void deleteAnalysis(entry.id).then(setHistory)}
                onUpdateTags={(entry, tags) =>
                  void updateAnalysisTags(entry.id, tags).then(setHistory)
                }
              />
            </motion.div>
          )}

          {activeTab === "sync" && (
            <motion.div
              key="sync"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col p-4"
              role="tabpanel"
              aria-label="Sync"
            >
              <SyncPanel onHistoryChanged={setHistory} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default IndexSidePanel;
