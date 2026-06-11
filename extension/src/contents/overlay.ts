import type { PlasmoCSConfig } from "plasmo";

import {
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
  type ExtensionResponse,
} from "~lib/messaging";
import { ElementPicker } from "~lib/picker/picker";

/**
 * Content script — element picker overlay and DOM access confirmation.
 * MotionLens is strictly read-only: the only DOM addition is the picker's
 * inert overlay host, and page clicks are intercepted only while picking.
 */

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
};

const picker = new ElementPicker({
  onSelectionChange: (selection) => {
    void sendToBackground({ type: MESSAGE_TYPES.SELECTION_CHANGED, selection });
  },
  onCancel: () => {
    void sendToBackground({ type: MESSAGE_TYPES.DEACTIVATE });
  },
});

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
        if (message.state.active) {
          picker.enable();
        } else {
          picker.disable();
        }
        sendResponse({ ok: true });
        break;

      case MESSAGE_TYPES.CLEAR_SELECTION:
        picker.clearSelection();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false });
    }
    return false;
  },
);

// If the page loaded (or reloaded) while this tab is already active,
// re-enable the picker.
void sendToBackground({ type: MESSAGE_TYPES.GET_STATE }).then((response) => {
  if (response.state?.active) picker.enable();
});
