import { describe, expect, it } from "vitest";

import {
  notificationTargetFromUrl,
  resolveNotificationTarget,
  withoutNotificationParams,
} from "./notification-target";

const bots = [
  { id: "bot-1", threadId: "thread-main", tasks: [{ threadId: "thread-task" }, { threadId: "thread-main" }] },
  { id: "bot-2", threadId: "thread-two" },
];
const groups = [{ id: "room-1", threadId: "thread-room" }];

describe("resolveNotificationTarget", () => {
  it("routes a room notification to the room", () => {
    expect(resolveNotificationTarget({ botId: "bot-1", threadId: "thread-room" }, bots, groups)).toEqual({
      kind: "group",
      id: "room-1",
    });
  });

  it("opens the exact task, not the bot's current task", () => {
    expect(resolveNotificationTarget({ botId: "bot-1", threadId: "thread-task" }, bots, groups)).toEqual({
      kind: "bot",
      id: "bot-1",
      taskThreadId: "thread-task",
    });
  });

  it("does not switch when the alert belongs to the main thread", () => {
    expect(resolveNotificationTarget({ botId: "bot-1", threadId: "thread-main" }, bots, groups)).toEqual({
      kind: "bot",
      id: "bot-1",
    });
  });

  it("falls back to the bot when a new task is not in the local fleet yet", () => {
    expect(resolveNotificationTarget({ botId: "bot-2", threadId: "thread-new" }, bots, groups)).toEqual({
      kind: "bot",
      id: "bot-2",
    });
  });

  it("ignores stale or blank ids", () => {
    expect(resolveNotificationTarget({ botId: "gone", threadId: "gone" }, bots, groups)).toBeNull();
    expect(resolveNotificationTarget({ botId: "  ", threadId: "  " }, bots, groups)).toBeNull();
  });
});

describe("notification deep links", () => {
  it("reads bot and thread from the URL", () => {
    expect(notificationTargetFromUrl("?bot=bot-1&thread=thread-task")).toEqual({
      botId: "bot-1",
      threadId: "thread-task",
    });
    expect(notificationTargetFromUrl("?bot=bot-1")).toEqual({ botId: "bot-1" });
    expect(notificationTargetFromUrl("?unrelated=1")).toBeNull();
  });

  it("removes only the deep-link keys", () => {
    expect(withoutNotificationParams("?bot=bot-1&thread=thread-task&login=1")).toBe("?login=1");
    expect(withoutNotificationParams("?bot=bot-1")).toBe("");
    expect(withoutNotificationParams("?login=1")).toBe("?login=1");
  });
});
