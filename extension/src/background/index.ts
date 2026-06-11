import {
  MESSAGE_TYPES,
  type ExtensionMessage,
  type ExtensionResponse,
  type TabState,
} from "~lib/messaging";

/**
 * Background service worker — owns per-tab activation state and routes
 * messages between popup, side panel, and content scripts.
 *
 * State lives in chrome.storage.session so it survives service worker
 * suspension but resets when the browser closes.
 */

const stateKey = (tabId: number) => `tab-state:${tabId}`;

const INACTIVE: TabState = { active: false };

async function getTabState(tabId: number): Promise<TabState> {
  const key = stateKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as TabState | undefined) ?? INACTIVE;
}

async function setTabState(tabId: number, state: TabState): Promise<void> {
  await chrome.storage.session.set({ [stateKey(tabId)]: state });

  const notification: ExtensionMessage = {
    type: MESSAGE_TYPES.STATE_CHANGED,
    tabId,
    state,
  };

  // Notify extension surfaces (popup, side panel). They may be closed,
  // in which case sendMessage rejects — that's fine.
  chrome.runtime.sendMessage(notification).catch(() => undefined);
  // Notify the content script in the affected tab.
  chrome.tabs.sendMessage(tabId, notification).catch(() => undefined);
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      return { ok: true, state: await getTabState(message.tabId) };

    case MESSAGE_TYPES.ACTIVATE: {
      // Confirm the content script has DOM access before reporting active.
      const pong = await chrome.tabs
        .sendMessage<ExtensionMessage, ExtensionResponse>(message.tabId, {
          type: MESSAGE_TYPES.PING,
        })
        .catch(() => undefined);

      if (!pong?.ok) {
        return {
          ok: false,
          error: "MotionLens can't access this page. Try reloading the tab.",
        };
      }

      const state: TabState = { active: true };
      await setTabState(message.tabId, state);
      return { ok: true, state, dom: pong.dom };
    }

    case MESSAGE_TYPES.DEACTIVATE: {
      const state: TabState = { active: false };
      await setTabState(message.tabId, state);
      return { ok: true, state };
    }

    default:
      return { ok: false, error: `Unhandled message type: ${message.type}` };
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    handleMessage(message).then(sendResponse, (error: unknown) =>
      sendResponse({ ok: false, error: String(error) }),
    );
    // Keep the message channel open for the async response.
    return true;
  },
);

// Drop state for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(stateKey(tabId)).catch(() => undefined);
});

export {};
