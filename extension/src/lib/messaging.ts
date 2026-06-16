import type { FrameworkScore, FrameworkSignals, RawCapture } from "@motionlens/analysis";

import type { DiscoveredInteraction } from "~lib/scanner";

/**
 * Message contracts shared between popup, side panel, background service
 * worker, and content scripts.
 *
 * All routing goes through the background service worker: UI surfaces send
 * commands, the background owns per-tab state and notifies everyone of
 * changes (including the content script in the affected tab).
 *
 * `tabId` is optional on commands: content scripts omit it (the background
 * resolves it from the message sender), UI surfaces must provide it.
 */

export const MESSAGE_TYPES = {
  /** UI/content → background: read the activation state for a tab. */
  GET_STATE: "motionlens/get-state",
  /** UI → background: start analyzing a tab. */
  ACTIVATE: "motionlens/activate",
  /** UI/content → background: stop analyzing a tab. */
  DEACTIVATE: "motionlens/deactivate",
  /** Background → UI surfaces + content script: a tab's state changed. */
  STATE_CHANGED: "motionlens/state-changed",
  /** Background → content script: confirm DOM access. */
  PING: "motionlens/ping",
  /** Content → background → UI surfaces: the selected elements changed. */
  SELECTION_CHANGED: "motionlens/selection-changed",
  /** UI → background: read the current selection for a tab. */
  GET_SELECTION: "motionlens/get-selection",
  /** UI → background → content script: clear the selection. */
  CLEAR_SELECTION: "motionlens/clear-selection",
  /** UI → background → content script: start recording the selection. */
  START_RECORDING: "motionlens/start-recording",
  /** UI → background → content script: stop recording, returns the capture. */
  STOP_RECORDING: "motionlens/stop-recording",
  /** Content → background: recorder stopped itself (timeout/limit). */
  RECORDING_AUTO_STOPPED: "motionlens/recording-auto-stopped",
  /** UI → background: read the last capture for a tab. */
  GET_CAPTURE: "motionlens/get-capture",
  /** Background → UI surfaces: a new capture is available for a tab. */
  CAPTURE_CHANGED: "motionlens/capture-changed",
  /** Content → background: framework signals collected on the page. */
  FRAMEWORK_SIGNALS: "motionlens/framework-signals",
  /** UI → background: read detected frameworks for a tab. */
  GET_FRAMEWORKS: "motionlens/get-frameworks",
  /** Background → UI surfaces: framework detection updated for a tab. */
  FRAMEWORKS_CHANGED: "motionlens/frameworks-changed",
  /** UI → background → content: scan the page for likely interactions. */
  SCAN_INTERACTIONS: "motionlens/scan-interactions",
  /** UI → background → content: add an element to the selection by selector. */
  SELECT_ELEMENT: "motionlens/select-element",
  /** UI → background → content: remove a single element from the selection by selector. */
  REMOVE_ELEMENT: "motionlens/remove-element",
} as const;

export interface TabState {
  active: boolean;
  recording: boolean;
}

/** Snapshot of a selected element, safe to send across the extension. */
export interface SelectedElementInfo {
  /** CSS selector locating the element at selection time. */
  selector: string;
  tag: string;
  id: string | null;
  classes: string[];
  /** Viewport-relative bounding box at selection time. */
  rect: { x: number; y: number; width: number; height: number };
}

export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE; tabId?: number }
  | { type: typeof MESSAGE_TYPES.ACTIVATE; tabId?: number }
  | { type: typeof MESSAGE_TYPES.DEACTIVATE; tabId?: number }
  | { type: typeof MESSAGE_TYPES.STATE_CHANGED; tabId: number; state: TabState }
  | { type: typeof MESSAGE_TYPES.PING }
  | {
      type: typeof MESSAGE_TYPES.SELECTION_CHANGED;
      tabId?: number;
      selection: SelectedElementInfo[];
    }
  | { type: typeof MESSAGE_TYPES.GET_SELECTION; tabId?: number }
  | { type: typeof MESSAGE_TYPES.CLEAR_SELECTION; tabId?: number }
  | { type: typeof MESSAGE_TYPES.START_RECORDING; tabId?: number }
  | { type: typeof MESSAGE_TYPES.STOP_RECORDING; tabId?: number }
  | { type: typeof MESSAGE_TYPES.RECORDING_AUTO_STOPPED; tabId?: number; capture: RawCapture }
  | { type: typeof MESSAGE_TYPES.GET_CAPTURE; tabId?: number }
  | { type: typeof MESSAGE_TYPES.CAPTURE_CHANGED; tabId: number; capture: RawCapture }
  | { type: typeof MESSAGE_TYPES.FRAMEWORK_SIGNALS; tabId?: number; signals: FrameworkSignals }
  | { type: typeof MESSAGE_TYPES.GET_FRAMEWORKS; tabId?: number }
  | { type: typeof MESSAGE_TYPES.FRAMEWORKS_CHANGED; tabId: number; frameworks: FrameworkScore[] }
  | { type: typeof MESSAGE_TYPES.SCAN_INTERACTIONS; tabId?: number }
  | { type: typeof MESSAGE_TYPES.SELECT_ELEMENT; tabId?: number; selector: string }
  | { type: typeof MESSAGE_TYPES.REMOVE_ELEMENT; tabId?: number; selector: string };

export interface ExtensionResponse {
  ok: boolean;
  state?: TabState;
  selection?: SelectedElementInfo[];
  capture?: RawCapture;
  frameworks?: FrameworkScore[];
  interactions?: DiscoveredInteraction[];
  /** Set by the content script's PING response to confirm DOM access. */
  dom?: { title: string; elementCount: number };
  error?: string;
}

export function sendToBackground(message: ExtensionMessage): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message);
}

/** Get the tab the user is currently looking at. */
export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
