import { MESSAGE_TYPES, type ExtensionMessage, type ExtensionResponse } from "~lib/messaging";

/**
 * Background service worker — routes messages between popup, side panel,
 * and content scripts. Phase 2 expands this into full activation routing.
 */

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    switch (message.type) {
      case MESSAGE_TYPES.PING:
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false });
    }
    return true;
  },
);

export {};
