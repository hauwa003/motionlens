import { useEffect, useState } from "react";

import {
  getActiveTab,
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
  type SelectedElementInfo,
} from "~lib/messaging";

import "~style.css";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-600"}`} />
      {active ? "Analyzing" : "Idle"}
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

function IndexSidePanel() {
  const [active, setActive] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [selection, setSelection] = useState<SelectedElementInfo[]>([]);

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      setTabId(tab.id);

      const [stateResponse, selectionResponse] = await Promise.all([
        sendToBackground({ type: MESSAGE_TYPES.GET_STATE, tabId: tab.id }),
        sendToBackground({ type: MESSAGE_TYPES.GET_SELECTION, tabId: tab.id }),
      ]);
      setActive(stateResponse.state?.active ?? false);
      setSelection(selectionResponse.selection ?? []);
    })();
  }, []);

  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.STATE_CHANGED && message.tabId === tabId) {
        setActive(message.state.active);
        if (!message.state.active) setSelection([]);
      }
      if (message.type === MESSAGE_TYPES.SELECTION_CHANGED && message.tabId === tabId) {
        setSelection(message.selection);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  const clearSelection = () => {
    if (tabId === null) return;
    void sendToBackground({ type: MESSAGE_TYPES.CLEAR_SELECTION, tabId });
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <StatusBadge active={active} />
      </header>

      <main className="flex flex-1 flex-col p-4">
        {selection.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium text-zinc-300">
                {selection.length} element{selection.length === 1 ? "" : "s"} selected
              </h2>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
              >
                Clear all
              </button>
            </div>
            <ul className="flex flex-col gap-2 overflow-y-auto">
              {selection.map((element) => (
                <ElementCard key={element.selector} element={element} />
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            {active ? (
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
