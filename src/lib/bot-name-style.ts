// Naming style for newly created bots. This is a client preference because
// it follows the interface language of THIS window; the server receives the
// resolved language with the create request and never stores the preference.
import { useSyncExternalStore } from "react";

export type BotNameStyle = "auto" | "bulgarian" | "english";
export type BotNameLanguage = "bulgarian" | "english";

export const BOT_NAME_STYLE_OPTIONS: ReadonlyArray<{ id: BotNameStyle; label: string }> = [
  { id: "auto", label: "Match the app language" },
  { id: "bulgarian", label: "Bulgarian names" },
  { id: "english", label: "English names" },
];

const STORAGE_KEY = "kodbot.bot-name-style";
const listeners = new Set<() => void>();

function read(): BotNameStyle {
  if (!("window" in globalThis)) return "auto";
  try {
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);
    return raw === "bulgarian" || raw === "english" ? raw : "auto";
  } catch {
    return "auto";
  }
}

let choice = read();

/** The stored choice, outside React (the send path needs it once). */
export function botNameStyle(): BotNameStyle {
  return choice;
}

export function setBotNameStyle(next: BotNameStyle): void {
  choice = next;
  if ("window" in globalThis) {
    try {
      globalThis.window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing: the choice still applies for this session */
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBotNameStyle(): BotNameStyle {
  return useSyncExternalStore(subscribe, botNameStyle, () => "auto");
}

/** "auto" follows the interface language; the explicit choices never do. */
export function resolveBotNameLanguage(style: BotNameStyle, locale: string): BotNameLanguage {
  if (style === "bulgarian" || style === "english") return style;
  return locale.toLowerCase().startsWith("bg") ? "bulgarian" : "english";
}

/** What the current window should ask the server for. The i18n provider
 * mirrors its choice to `<html lang>`, so this stays correct outside React. */
export function requestedBotNameLanguage(): BotNameLanguage {
  const locale = "document" in globalThis ? globalThis.document.documentElement.lang : "";
  return resolveBotNameLanguage(choice, locale || "en");
}
