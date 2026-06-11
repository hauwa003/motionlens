import { CaptureRecorder, type RawCapture } from "@motionlens/analysis";
import type { PlasmoCSConfig } from "plasmo";

import {
  MESSAGE_TYPES,
  sendToBackground,
  type ExtensionMessage,
  type ExtensionResponse,
} from "~lib/messaging";
import { ElementPicker } from "~lib/picker/picker";
import { buildSelector } from "~lib/picker/selector";

/**
 * Content script — element picker overlay and capture recording.
 * MotionLens is strictly read-only: the only DOM addition is the picker's
 * inert overlay host, and page clicks are intercepted only while picking
 * (never while recording).
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

let recorder: CaptureRecorder | null = null;

function startRecording(): ExtensionResponse {
  const roots = picker.getSelectedElements();
  if (roots.length === 0) {
    return { ok: false, error: "Select at least one element before recording." };
  }
  if (recorder?.isRecording) {
    return { ok: false, error: "Already recording." };
  }

  recorder = new CaptureRecorder({
    roots,
    buildSelector,
    onAutoStop: (capture: RawCapture) => {
      picker.resume();
      void sendToBackground({ type: MESSAGE_TYPES.RECORDING_AUTO_STOPPED, capture });
    },
  });

  // Let the user interact with the page while recording.
  picker.pause();
  recorder.start();
  return { ok: true };
}

function stopRecording(): ExtensionResponse {
  if (!recorder?.isRecording) {
    return { ok: false, error: "Not recording." };
  }
  const capture = recorder.stop();
  recorder = null;
  picker.resume();
  return { ok: true, capture };
}

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
          if (recorder?.isRecording) recorder.stop();
          recorder = null;
          picker.disable();
        }
        sendResponse({ ok: true });
        break;

      case MESSAGE_TYPES.CLEAR_SELECTION:
        picker.clearSelection();
        sendResponse({ ok: true });
        break;

      case MESSAGE_TYPES.START_RECORDING:
        sendResponse(startRecording());
        break;

      case MESSAGE_TYPES.STOP_RECORDING:
        sendResponse(stopRecording());
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
