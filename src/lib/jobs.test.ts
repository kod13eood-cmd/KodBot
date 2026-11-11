import { describe, expect, it } from "vitest";

import { activeGroupTurnJobs, activeTurnJobs, jobGroup, routineRunToJob } from "./jobs";
import type { RoutineRun } from "./routines";

function run(overrides: Partial<RoutineRun> = {}): RoutineRun {
  return {
    id: "run-1",
    routineId: "routine-1",
    routineName: "Morning report",
    prompt: "Write the report",
    botId: "bot-1",
    runOn: "crew",
    scheduledFor: 1_000,
    status: "completed",
    manual: false,
    createdAt: 900,
    ...overrides,
  };
}

describe("routineRunToJob", () => {
  it("projects a scheduled run with the bot name and result", () => {
    expect(routineRunToJob(run({ output: "Done." }), [{ id: "bot-1", name: "Atlas" }])).toMatchObject({
      id: "routine:run-1",
      kind: "routine",
      title: "Morning report",
      botId: "bot-1",
      botName: "Atlas",
      routineId: "routine-1",
      status: "completed",
      result: "Done.",
      createdAt: 900,
      scheduledFor: 1_000,
    });
  });

  it("calls a webhook-triggered run a webhook job", () => {
    expect(
      routineRunToJob(run({ webhookId: "hook-1", status: "failed", error: "boom" }), [
        { id: "bot-1", name: "Atlas" },
      ]),
    ).toMatchObject({ kind: "webhook", status: "failed", error: "boom" });
  });

  it("falls back when the bot is gone", () => {
    expect(routineRunToJob(run(), []).botName).toBe("Unknown bot");
  });
});

describe("activeTurnJobs", () => {
  it("shows only busy bots and uses their visible task title", () => {
    expect(
      activeTurnJobs([
        {
          id: "bot-1",
          name: "Atlas",
          busy: true,
          threadId: "thread-1",
          tasks: [{ threadId: "thread-1", title: "Launch review", createdAt: 500 }],
        },
        { id: "bot-2", name: "Idle", busy: false, threadId: "thread-2" },
      ]),
    ).toMatchObject([
      {
        id: "turn:bot-1:thread-1",
        kind: "turn",
        title: "Launch review",
        botName: "Atlas",
        status: "running",
      },
    ]);
  });
});

describe("activeGroupTurnJobs", () => {
  it("links a busy room to the room thread, not the bot's 1:1 chat", () => {
    expect(
      activeGroupTurnJobs(
        [{ id: "room-1", name: "Launch", threadId: "room-thread", busyBotId: "bot-1", createdAt: 700 }],
        [{ id: "bot-1", name: "Atlas" }],
      ),
    ).toMatchObject([
      {
        id: "turn:group:room-1:bot-1",
        title: "Launch",
        botName: "Atlas",
        threadId: "room-thread",
        status: "running",
      },
    ]);
  });
});

describe("jobGroup", () => {
  it("groups failures and waits separately from work in flight and done work", () => {
    expect(jobGroup("failed")).toBe("attention");
    expect(jobGroup("missed")).toBe("attention");
    expect(jobGroup("waiting")).toBe("attention");
    expect(jobGroup("queued")).toBe("running");
    expect(jobGroup("running")).toBe("running");
    expect(jobGroup("completed")).toBe("done");
    expect(jobGroup("cancelled")).toBe("done");
  });
});
