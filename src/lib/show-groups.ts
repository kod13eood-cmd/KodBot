// Whether the sidebar lists rooms and team conversations. A client-side
// preference: it changes this window's navigation, not what the server stores.
// Default on so existing conversations do not disappear after an update.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "kodbot.show-group-chats";
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

let enabled = read();

export function showGroupChatsEnabled(): boolean {
  return enabled;
}

export function setShowGroupChats(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* private mode / storage disabled: the value still lives for this session */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShowGroupChats(): boolean {
  return useSyncExternalStore(subscribe, showGroupChatsEnabled, () => true);
}
