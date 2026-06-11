import { useEffect, useState } from "react";

import {
  getActiveTab,
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
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

function IndexSidePanel() {
  const [active, setActive] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      setTabId(tab.id);
      const response = await sendToBackground({ type: MESSAGE_TYPES.GET_STATE, tabId: tab.id });
      setActive(response.state?.active ?? false);
    })();
  }, []);

  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.STATE_CHANGED && message.tabId === tabId) {
        setActive(message.state.active);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <StatusBadge active={active} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        {active ? (
          <>
            <h2 className="text-sm font-medium">Ready to capture</h2>
            <p className="max-w-xs text-xs text-zinc-400">
              Element selection arrives in the next phase. Captured motion analysis will appear
              here.
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
      </main>

      <footer className="border-t border-zinc-900 px-4 py-2 text-center text-[10px] text-zinc-600">
        See it. Decode it. Recreate it.
      </footer>
    </div>
  );
}

export default IndexSidePanel;
