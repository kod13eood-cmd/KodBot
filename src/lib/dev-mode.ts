// Developer details — token counts, API keys, working folders, the Inspector
// — are useful while building and noise while using the app. A client-side
// preference is enough: it changes what this window shows, not what the
// server stores. Default off so a fresh install starts clean.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "kodbot.developer-mode";
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let enabled = read();

/** The current value outside React (handlers that need it once). */
export function developerModeEnabled(): boolean {
  return enabled;
}

/** Flip it and tell every subscribed component in this window. */
export function setDeveloperMode(on: boolean): void {
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

export function useDeveloperMode(): boolean {
  return useSyncExternalStore(subscribe, developerModeEnabled, () => false);
}
