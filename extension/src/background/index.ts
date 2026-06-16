import {
  scoreFrameworks,
  type AmbientBurst,
  type FrameworkScore,
  type RawCapture,
} from "@motionlens/analysis";

import {
  MESSAGE_TYPES,
  type ExtensionMessage,
  type ExtensionResponse,
  type SelectedElementInfo,
  type TabState,
} from "~lib/messaging";

/**
 * Background service worker — owns per-tab activation/recording state,
 * selection, and the latest capture; routes messages between popup, side
 * panel, and content scripts.
 *
 * State lives in chrome.storage.session so it survives service worker
 * suspension but resets when the browser closes.
 */

const stateKey = (tabId: number) => `tab-state:${tabId}`;
const selectionKey = (tabId: number) => `tab-selection:${tabId}`;
const captureKey = (tabId: number) => `tab-capture:${tabId}`;
const frameworksKey = (tabId: number) => `tab-frameworks:${tabId}`;
const burstsKey = (tabId: number) => `tab-bursts:${tabId}`;

const MAX_BURSTS = 50;

const INACTIVE: TabState = { active: false, recording: false, ambient: false };

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

async function getTabCapture(tabId: number): Promise<RawCapture | undefined> {
  const key = captureKey(tabId);
  const result = await chrome.storage.session.get(key);
  return result[key] as RawCapture | undefined;
}

async function getTabBursts(tabId: number): Promise<AmbientBurst[]> {
  const key = burstsKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as AmbientBurst[] | undefined) ?? [];
}

async function addTabBurst(tabId: number, burst: AmbientBurst): Promise<AmbientBurst[]> {
  const existing = await getTabBursts(tabId);
  const updated = [burst, ...existing].slice(0, MAX_BURSTS);
  await chrome.storage.session.set({ [burstsKey(tabId)]: updated });
  return updated;
}

async function clearTabBursts(tabId: number): Promise<void> {
  await chrome.storage.session.remove(burstsKey(tabId));
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

async function setTabCapture(tabId: number, capture: RawCapture): Promise<void> {
  await chrome.storage.session.set({ [captureKey(tabId)]: capture });
  chrome.runtime
    .sendMessage({ type: MESSAGE_TYPES.CAPTURE_CHANGED, tabId, capture })
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

    case MESSAGE_TYPES.GET_CAPTURE:
      return { ok: true, capture: await getTabCapture(tabId) };

    case MESSAGE_TYPES.GET_FRAMEWORKS: {
      const key = frameworksKey(tabId);
      const result = await chrome.storage.session.get(key);
      return { ok: true, frameworks: (result[key] as FrameworkScore[] | undefined) ?? [] };
    }

    case MESSAGE_TYPES.FRAMEWORK_SIGNALS: {
      const frameworks = scoreFrameworks(message.signals);
      await chrome.storage.session.set({ [frameworksKey(tabId)]: frameworks });
      chrome.runtime
        .sendMessage({ type: MESSAGE_TYPES.FRAMEWORKS_CHANGED, tabId, frameworks })
        .catch(() => undefined);
      return { ok: true, frameworks };
    }

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

      // Start ambient observation automatically on activation
      chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.START_AMBIENT, tabId })
        .catch(() => undefined);

      const state: TabState = { active: true, recording: false, ambient: true };
      await setTabState(tabId, state);
      return { ok: true, state, dom: pong.dom };
    }

    case MESSAGE_TYPES.DEACTIVATE: {
      chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.STOP_AMBIENT, tabId })
        .catch(() => undefined);
      const state: TabState = { active: false, recording: false, ambient: false };
      await setTabSelection(tabId, []);
      await clearTabBursts(tabId);
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

    case MESSAGE_TYPES.SCAN_INTERACTIONS:
    case MESSAGE_TYPES.SELECT_ELEMENT:
    case MESSAGE_TYPES.REMOVE_ELEMENT:
      // Pass-through commands handled by the content script in the tab.
      return chrome.tabs
        .sendMessage<ExtensionMessage, ExtensionResponse>(tabId, { ...message, tabId })
        .catch(() => ({ ok: false, error: "Couldn't reach the page." }) as ExtensionResponse);

    case MESSAGE_TYPES.START_RECORDING: {
      const response = await chrome.tabs
        .sendMessage<ExtensionMessage, ExtensionResponse>(tabId, {
          type: MESSAGE_TYPES.START_RECORDING,
          tabId,
        })
        .catch(() => ({ ok: false, error: "Couldn't reach the page." }) as ExtensionResponse);

      if (!response.ok) return response;

      await setTabState(tabId, { active: true, recording: true, ambient: false });
      return response;
    }

    case MESSAGE_TYPES.STOP_RECORDING: {
      const response = await chrome.tabs
        .sendMessage<ExtensionMessage, ExtensionResponse>(tabId, {
          type: MESSAGE_TYPES.STOP_RECORDING,
          tabId,
        })
        .catch(() => ({ ok: false, error: "Couldn't reach the page." }) as ExtensionResponse);

      await setTabState(tabId, { active: true, recording: false, ambient: true });
      if (response.ok && response.capture) {
        await setTabCapture(tabId, response.capture);
      }
      return response;
    }

    case MESSAGE_TYPES.RECORDING_AUTO_STOPPED: {
      await setTabState(tabId, { active: true, recording: false, ambient: true });
      await setTabCapture(tabId, message.capture);
      return { ok: true };
    }

    case MESSAGE_TYPES.START_AMBIENT:
      chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.START_AMBIENT, tabId })
        .catch(() => undefined);
      return { ok: true };

    case MESSAGE_TYPES.STOP_AMBIENT:
      chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.STOP_AMBIENT, tabId })
        .catch(() => undefined);
      return { ok: true };

    case MESSAGE_TYPES.AMBIENT_BURST: {
      await addTabBurst(tabId, message.burst);
      // Notify UI surfaces about the new burst
      chrome.runtime
        .sendMessage({ type: MESSAGE_TYPES.AMBIENT_BURST_CHANGED, tabId, burst: message.burst })
        .catch(() => undefined);
      return { ok: true };
    }

    case MESSAGE_TYPES.GET_AMBIENT_BURSTS:
      return { ok: true, bursts: await getTabBursts(tabId) };

    case MESSAGE_TYPES.CLEAR_AMBIENT_BURSTS:
      await clearTabBursts(tabId);
      return { ok: true };

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

// Keyboard shortcut: toggle analysis on the focused tab (Alt+Shift+M).
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-analysis") return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const state = await getTabState(tab.id);
    await handleMessage(
      { type: state.active ? MESSAGE_TYPES.DEACTIVATE : MESSAGE_TYPES.ACTIVATE, tabId: tab.id },
      {},
    );
  })();
});

// Drop state for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session
    .remove([
      stateKey(tabId),
      selectionKey(tabId),
      captureKey(tabId),
      frameworksKey(tabId),
      burstsKey(tabId),
    ])
    .catch(() => undefined);
});

export {};
