// Desktop notifications, driven by the harness's {kind:"notify"} frames.
// The server decides *whether* something is worth an interruption (it owns
// the per-bot toggle); this decides how to show it and whether the user is
// already looking at the answer.
//
// The desktop app prefers the main-process bridge. Its remote UI is served
// over plain HTTP, which is not a secure context, so the Web Notification API
// is denied there; Electron's native Notification has no such restriction.
import type { Notification } from "../../server/notify.ts";

export type NotifyFrame = Notification;

export interface NotifyContext {
  /** The thread currently on screen, if the window is focused. */
  activeThreadId?: string;
}

/** Ask while handling the settings click. Browsers may reject permission
 * requests that are triggered later by an incoming SSE frame. */
export function requestNotificationPermission(): Promise<NotificationPermission> | null {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return null;
  return Notification.requestPermission();
}

/** Skip only when the user is already looking at that exact conversation in a
 * focused window — the chat itself shows the card or the answer. A focused
 * window on a DIFFERENT bot must still interrupt: that is the miss this
 * guards against. */
export function shouldNotify(
  frame: NotifyFrame,
  context: NotifyContext,
  focused = document.hasFocus(),
): boolean {
  return !(focused && context.activeThreadId === frame.threadId);
}

/** Show one notification. `onOpen` is used by the browser fallback; the native
 * bridge reports clicks through `window.ogb.notifications.onOpen`. */
export function showNotification(frame: NotifyFrame, onOpen: () => void, context: NotifyContext = {}) {
  if (!shouldNotify(frame, context)) return;

  const bridge = window.ogb?.notifications;
  if (bridge) {
    void bridge.show({
      kind: frame.kind,
      botId: frame.botId,
      threadId: frame.threadId,
      title: frame.title,
      body: frame.body,
    });
    return;
  }

  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const notification = new Notification(frame.title, {
    body: frame.body,
    tag: `${frame.threadId}:${frame.kind}`,
    // Keep a blocked request on screen; a finished reply can fade.
    requireInteraction: frame.kind !== "done",
  });
  notification.onclick = () => {
    window.focus();
    onOpen();
  };
}
