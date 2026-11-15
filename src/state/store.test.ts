import { describe, expect, it } from "vitest";

import { initialState, reducer, type Bot, type Message } from "./store";

describe("cross-client bot creation", () => {
  it("adds an announced bot before its greeting frames arrive", () => {
    const announced = {
      id: "phone-bot",
      threadId: "phone-thread",
      name: "Scout",
      title: "",
      description: "",
      notifications: true,
      color: "green",
      unread: false,
      modelSelection: { instanceId: "codex", model: "default" },
    } satisfies Omit<Bot, "messages">;

    const added = reducer(initialState, { type: "botPatched", bot: announced });

    expect(added.bots).toEqual([{ ...announced, messages: [] }]);

    const greeting = {
      id: "greeting",
      role: "bot",
      kind: "text",
      text: "Hey — I'm Scout. Nice to meet you.",
      at: 2,
    } satisfies Message;
    const greeted = reducer(added, {
      type: "messageAdded",
      threadId: announced.threadId,
      message: greeting,
    });

    expect(greeted.bots[0]?.messages).toEqual([greeting]);
  });
});

describe("opening a bot", () => {
  it("clears the report dot on the task it shows, leaving other tasks alone", () => {
    const bot = {
      id: "watcher",
      threadId: "main",
      name: "Watcher",
      title: "",
      description: "",
      notifications: true,
      color: "green",
      unread: false,
      modelSelection: { instanceId: "opencode", model: "m" },
      messages: [],
      tasks: [
        { title: "Главен чат", threadId: "main", createdAt: 1, unread: true },
        { title: "Reports", threadId: "reports", createdAt: 2, unread: true },
      ],
    } satisfies Bot;
    const next = reducer({ ...initialState, bots: [bot] }, { type: "select", id: "watcher" });

    expect(next.bots[0]?.tasks?.find((task) => task.threadId === "main")?.unread).toBeFalsy();
    expect(next.bots[0]?.tasks?.find((task) => task.threadId === "reports")?.unread).toBe(true);
  });
});
