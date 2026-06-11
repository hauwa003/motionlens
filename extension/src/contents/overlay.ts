import type { PlasmoCSConfig } from "plasmo";

import { MESSAGE_TYPES, type ExtensionMessage, type ExtensionResponse } from "~lib/messaging";

/**
 * Content script — confirms DOM access and reacts to activation state.
 * Phase 3 replaces the activation handling with the element picker overlay.
 * MotionLens is strictly read-only: it must never modify the target website.
 */

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
};

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    switch (message.type) {
      case MESSAGE_TYPES.PING:
        sendResponse({
          ok: true,
          dom: {
            title: document.title,
            elementCount: document.querySelectorAll("*").length,
          },
        });
        break;

      case MESSAGE_TYPES.STATE_CHANGED:
        console.debug(
          `[MotionLens] ${message.state.active ? "activated" : "deactivated"} on`,
          window.location.href,
        );
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false });
    }
    return false;
  },
);
