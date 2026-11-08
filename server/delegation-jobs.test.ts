import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DelegationJobStore } from "./delegation-jobs.ts";

const dirs: string[] = [];

function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "kodbot-delegation-jobs-"));
  dirs.push(dir);
  return join(dir, "jobs.json");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function input() {
  return {
    itemId: "item-1",
    sourceBotId: "bot-a",
    sourceBotName: "Atlas",
    sourceThreadId: "thread-a",
    sourceTaskTitle: "Launch review",
    targetBotId: "bot-b",
    targetBotName: "Scout",
    message: "Check the invoices",
    reason: "next step",
  };
}

describe("DelegationJobStore", () => {
  it("persists a queued handoff, then its running and completed states", () => {
    const file = tempFile();
    let now = 1_000;
    const emitted: any[] = [];
    const store = new DelegationJobStore({ file, now: () => now, emit: (payload) => emitted.push(payload) });

    const job = store.create(input());
    expect(job).toMatchObject({
      id: "delegation:item-1",
      kind: "delegation",
      status: "queued",
      sourceBotName: "Atlas",
      botName: "Scout",
      sourceTaskTitle: "Launch review",
    });

    now = 2_000;
    expect(store.started(job.id, "thread-b", "group-1")).toMatchObject({
      status: "running",
      threadId: "thread-b",
      channelId: "group-1",
    });

    now = 3_000;
    expect(store.finish(job.id, "completed", "All clear.", "")).toMatchObject({
      status: "completed",
      result: "All clear.",
      finishedAt: 3_000,
    });

    const reloaded = new DelegationJobStore({ file, now: () => now });
    expect(reloaded.list()[0]).toMatchObject({
      id: "delegation:item-1",
      status: "completed",
      result: "All clear.",
    });
    expect(emitted.map((frame) => frame.job.status)).toEqual(["queued", "running", "completed"]);
  });

  it("marks a handoff that was running when the process died as failed", () => {
    const file = tempFile();
    let now = 1_000;
    const store = new DelegationJobStore({ file, now: () => now });
    const job = store.create(input());
    store.started(job.id, "thread-b");

    now = 5_000;
    const reloaded = new DelegationJobStore({ file, now: () => now });
    expect(reloaded.list()[0]).toMatchObject({
      status: "failed",
      error: "KodBot restarted while this delegation was running",
      finishedAt: 5_000,
    });
  });

  it("keeps the same job when the queue is replayed", () => {
    const store = new DelegationJobStore({ file: tempFile(), now: () => 1_000 });
    const first = store.create(input());
    const second = store.create(input());
    expect(second).toEqual(first);
    expect(store.list()).toHaveLength(1);
  });
});
