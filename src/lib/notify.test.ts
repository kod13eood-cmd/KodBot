import { afterEach, describe, expect, it, vi } from "vitest";

import { requestNotificationPermission, shouldNotify, showNotification, type NotifyFrame } from "./notify";

const frame: NotifyFrame = {
  kind: "approval",
  botId: "bot-1",
  botName: "Mochi",
  threadId: "thread-1",
  title: "Mochi needs approval",
  body: "rm -rf build",
};

function installNotification(permission: NotificationPermission) {
  const notices: Array<{ title: string; options?: NotificationOptions; onclick: (() => void) | null }> = [];
  const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
  class FakeNotification {
    static permission = permission;
    static requestPermission = requestPermission;
    onclick: (() => void) | null = null;
    constructor(
      public title: string,
      public options?: NotificationOptions,
    ) {
      notices.push(this);
    }
  }
  vi.stubGlobal("Notification", FakeNotification);
  vi.stubGlobal("document", { hasFocus: () => false });
  vi.stubGlobal("window", { focus: vi.fn() });
  return { notices, requestPermission };
}

afterEach(() => vi.unstubAllGlobals());

describe("notification policy", () => {
  it("skips the bot the user is already looking at", () => {
    expect(shouldNotify(frame, { activeThreadId: "thread-1" }, true)).toBe(false);
  });

  it("interrupts while the user is in another chat", () => {
    expect(shouldNotify(frame, { activeThreadId: "thread-2" }, true)).toBe(true);
  });

  it("interrupts when the window does not have focus", () => {
    expect(shouldNotify(frame, { activeThreadId: "thread-1" }, false)).toBe(true);
  });

  it("treats an unknown active thread as another chat", () => {
    expect(shouldNotify(frame, {}, true)).toBe(true);
  });
});

describe("desktop notifications", () => {
  it("does not request permission from a background notification frame", () => {
    const { notices, requestPermission } = installNotification("default");
    showNotification(frame, vi.fn());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(notices).toHaveLength(0);
  });

  it("requests permission through the explicit settings action", async () => {
    const { requestPermission } = installNotification("default");
    await requestNotificationPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("shows a browser notification after permission is granted", () => {
    const { notices } = installNotification("granted");
    showNotification(frame, vi.fn());
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      title: frame.title,
      options: { body: frame.body, tag: `${frame.threadId}:${frame.kind}`, requireInteraction: true },
    });
  });

  it("uses the native bridge in the desktop app, where HTTP has no notification permission", () => {
    const show = vi.fn(async () => ({ shown: true }));
    vi.stubGlobal("document", { hasFocus: () => false });
    vi.stubGlobal("window", { ogb: { notifications: { show } }, focus: vi.fn() });

    showNotification(frame, vi.fn());
    expect(show).toHaveBeenCalledWith({
      kind: "approval",
      botId: "bot-1",
      threadId: "thread-1",
      title: frame.title,
      body: frame.body,
    });
  });

  it("stays quiet when the user is already in that chat", () => {
    const show = vi.fn();
    vi.stubGlobal("document", { hasFocus: () => true });
    vi.stubGlobal("window", { ogb: { notifications: { show } } });

    showNotification(frame, vi.fn(), { activeThreadId: "thread-1" });
    expect(show).not.toHaveBeenCalled();
  });
});
