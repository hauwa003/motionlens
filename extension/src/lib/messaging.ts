/**
 * Message contracts shared between popup, side panel, background service
 * worker, and content scripts.
 */

export const MESSAGE_TYPES = {
  PING: "motionlens/ping",
  ACTIVATE: "motionlens/activate",
  DEACTIVATE: "motionlens/deactivate",
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export interface ExtensionMessage {
  type: MessageType;
}

export interface ExtensionResponse {
  ok: boolean;
}
