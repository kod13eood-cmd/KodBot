import { describe, expect, it, vi } from "vitest";

import { createPromptQueue, parseQueueKey, queueKeyForBot, queueKeyForGroup } from "./send-queue";

const key = queueKeyForBot("bot-1");

describe("prompt queue", () => {
  it("holds prompts and hands them out oldest first", () => {
    const queue = createPromptQueue();
    queue.enqueue(key, "first");
    queue.enqueue(key, "second");
    expect(queue.prompts(key).map((prompt) => prompt.text)).toEqual(["first", "second"]);
    expect(queue.next(key, false)?.text).toBe("first");
    expect(queue.prompts(key).map((prompt) => prompt.text)).toEqual(["second"]);
  });

  it("sends one per idle transition, never a burst", () => {
    const queue = createPromptQueue();
    queue.enqueue(key, "first");
    queue.enqueue(key, "second");

    expect(queue.next(key, false)?.text).toBe("first");
    // the first turn has not started yet — the second prompt must wait
    expect(queue.next(key, false)).toBeNull();
    // the turn ran and finished: the next prompt may go
    expect(queue.next(key, true)).toBeNull();
    expect(queue.next(key, false)?.text).toBe("second");
  });

  it("never consumes a prompt while the target is busy", () => {
    const queue = createPromptQueue();
    queue.enqueue(key, "first");
    expect(queue.next(key, true)).toBeNull();
    expect(queue.prompts(key)).toHaveLength(1);
  });

  it("keeps bots and rooms apart and drops a discarded prompt", () => {
    const queue = createPromptQueue();
    const room = queueKeyForGroup("room-1");
    queue.enqueue(key, "to bot");
    queue.enqueue(room, "to room");
    expect(queue.keys().sort()).toEqual([key, room].sort());

    const [held] = queue.prompts(room);
    queue.drop(room, held!.id);
    expect(queue.prompts(room)).toEqual([]);
    expect(queue.keys()).toEqual([key]);
  });

  it("ignores blank text and tells subscribers about every change", () => {
    const queue = createPromptQueue();
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.enqueue(key, "   ");
    expect(listener).not.toHaveBeenCalled();
    queue.enqueue(key, "hello");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("maps queue keys back to their target", () => {
    expect(parseQueueKey(queueKeyForBot("b"))).toEqual({ botId: "b" });
    expect(parseQueueKey(queueKeyForGroup("g"))).toEqual({ groupId: "g" });
    expect(parseQueueKey("?")).toEqual({});
  });
});
