/**
 * Message contracts shared between popup, side panel, background service
 * worker, and content scripts.
 *
 * All routing goes through the background service worker: UI surfaces send
 * commands, the background owns per-tab state and notifies everyone of
 * changes (including the content script in the affected tab).
 */

export const MESSAGE_TYPES = {
  /** UI → background: read the activation state for a tab. */
  GET_STATE: "motionlens/get-state",
  /** UI → background: start analyzing a tab. */
  ACTIVATE: "motionlens/activate",
  /** UI → background: stop analyzing a tab. */
  DEACTIVATE: "motionlens/deactivate",
  /** Background → UI surfaces + content script: a tab's state changed. */
  STATE_CHANGED: "motionlens/state-changed",
  /** Background → content script: confirm DOM access. */
  PING: "motionlens/ping",
} as const;

export interface TabState {
  active: boolean;
}

export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE; tabId: number }
  | { type: typeof MESSAGE_TYPES.ACTIVATE; tabId: number }
  | { type: typeof MESSAGE_TYPES.DEACTIVATE; tabId: number }
  | { type: typeof MESSAGE_TYPES.STATE_CHANGED; tabId: number; state: TabState }
  | { type: typeof MESSAGE_TYPES.PING };

export interface ExtensionResponse {
  ok: boolean;
  state?: TabState;
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
