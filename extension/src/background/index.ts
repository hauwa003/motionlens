import {
  MESSAGE_TYPES,
  type ExtensionMessage,
  type ExtensionResponse,
  type SelectedElementInfo,
  type TabState,
} from "~lib/messaging";

/**
 * Background service worker — owns per-tab activation state and selection,
 * and routes messages between popup, side panel, and content scripts.
 *
 * State lives in chrome.storage.session so it survives service worker
 * suspension but resets when the browser closes.
 */

const stateKey = (tabId: number) => `tab-state:${tabId}`;
const selectionKey = (tabId: number) => `tab-selection:${tabId}`;

const INACTIVE: TabState = { active: false };

async function getTabState(tabId: number): Promise<TabState> {
  const key = stateKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as TabState | undefined) ?? INACTIVE;
}

async function getTabSelection(tabId: number): Promise<SelectedElementInfo[]> {
  const key = selectionKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as SelectedElementInfo[] | undefined) ?? [];
}

/** Notify extension surfaces and the affected tab. Either may be closed. */
function broadcast(notification: ExtensionMessage, tabId: number): void {
  chrome.runtime.sendMessage(notification).catch(() => undefined);
  chrome.tabs.sendMessage(tabId, notification).catch(() => undefined);
}

async function setTabState(tabId: number, state: TabState): Promise<void> {
  await chrome.storage.session.set({ [stateKey(tabId)]: state });
  broadcast({ type: MESSAGE_TYPES.STATE_CHANGED, tabId, state }, tabId);
}

async function setTabSelection(tabId: number, selection: SelectedElementInfo[]): Promise<void> {
  await chrome.storage.session.set({ [selectionKey(tabId)]: selection });
  // The content script originated this; only UI surfaces need the broadcast.
  chrome.runtime
    .sendMessage({ type: MESSAGE_TYPES.SELECTION_CHANGED, tabId, selection })
    .catch(() => undefined);
}

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  // Content scripts omit tabId; resolve it from the sender.
  const tabId = ("tabId" in message ? message.tabId : undefined) ?? sender.tab?.id;
  if (tabId === undefined) {
    return { ok: false, error: "No tab id on message or sender." };
  }

  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      return { ok: true, state: await getTabState(tabId) };

    case MESSAGE_TYPES.GET_SELECTION:
      return { ok: true, selection: await getTabSelection(tabId) };

    case MESSAGE_TYPES.ACTIVATE: {
      // Confirm the content script has DOM access before reporting active.
      const pong = await chrome.tabs
        .sendMessage<ExtensionMessage, ExtensionResponse>(tabId, { type: MESSAGE_TYPES.PING })
        .catch(() => undefined);

      if (!pong?.ok) {
        return {
          ok: false,
          error: "MotionLens can't access this page. Try reloading the tab.",
        };
      }

      const state: TabState = { active: true };
      await setTabState(tabId, state);
      return { ok: true, state, dom: pong.dom };
    }

    case MESSAGE_TYPES.DEACTIVATE: {
      const state: TabState = { active: false };
      await setTabSelection(tabId, []);
      await setTabState(tabId, state);
      return { ok: true, state };
    }

    case MESSAGE_TYPES.SELECTION_CHANGED:
      await setTabSelection(tabId, message.selection);
      return { ok: true };

    case MESSAGE_TYPES.CLEAR_SELECTION: {
      await setTabSelection(tabId, []);
      await chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.CLEAR_SELECTION, tabId })
        .catch(() => undefined);
      return { ok: true };
    }

    default:
      return { ok: false, error: "Unhandled message type." };
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (response: ExtensionResponse) => void) => {
    handleMessage(message, sender).then(sendResponse, (error: unknown) =>
      sendResponse({ ok: false, error: String(error) }),
    );
    // Keep the message channel open for the async response.
    return true;
  },
);

// Drop state for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([stateKey(tabId), selectionKey(tabId)]).catch(() => undefined);
});

export {};
