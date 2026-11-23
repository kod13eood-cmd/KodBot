import { describe, expect, it } from "vitest";

import type { Message } from "@/state/store";
import {
  isUserFacingActivity,
  latestProgress,
  latestUserPrompt,
  progressAction,
  progressLabel,
  shouldShowActivity,
} from "./chat-activity";

const activity = (name: string, extra: Partial<Message> = {}): Message => ({
  id: name,
  role: "bot",
  kind: "activity",
  at: 1_000,
  tool: { name },
  ...extra,
});

describe("chat activity visibility", () => {
  it("hides raw tool chips in the calm view and shows them in developer mode", () => {
    const raw = activity("edit");
    expect(shouldShowActivity(raw, false)).toBe(false);
    expect(shouldShowActivity(raw, true)).toBe(true);
  });

  it("keeps handoffs, replies, and delegation summaries in the calm view", () => {
    expect(shouldShowActivity(activity("Delegated to @Scout: research"), false)).toBe(true);
    expect(shouldShowActivity(activity("Messaged @Scout"), false)).toBe(true);
    expect(shouldShowActivity(activity("Message from @Scout"), false)).toBe(true);
    expect(shouldShowActivity(activity("@Scout replied: done"), false)).toBe(true);
    expect(shouldShowActivity(activity("Delegated work finished — collecting 2 replies"), false)).toBe(true);
  });

  it("marks a comm chip user-facing even when its name is unexpected", () => {
    const chip = activity("anything", {
      comm: { groupId: "g", withBotId: "b", withName: "Scout", withColor: "blue" },
    });
    expect(isUserFacingActivity(chip)).toBe(true);
  });

  it("picks the newest activity after the turn started", () => {
    const messages = [
      activity("old", { at: 100 }),
      { ...activity("read", { at: 200 }), tool: { name: "read", spoken: "reading a file" } },
      { ...activity("error: nope", { at: 300 }), tool: { name: "error: nope" } },
    ];
    expect(latestProgress(messages, 150)?.id).toBe("read");
    expect(latestProgress(messages, 400)).toBeUndefined();
  });

  it("ignores queued prompts when finding the current turn's start", () => {
    const messages: Message[] = [
      { id: "u1", role: "user", kind: "text", text: "first", at: 100 },
      { id: "u2", role: "user", kind: "text", text: "queued", at: 200, queued: true },
    ];
    expect(latestUserPrompt(messages)?.id).toBe("u1");
    expect(latestUserPrompt([{ id: "q", role: "user", kind: "text", at: 1, queued: true }])).toBeUndefined();
  });

  it("labels with the narration, a handoff, or nothing for raw tools", () => {
    expect(progressLabel({ ...activity("read"), tool: { name: "read", spoken: "reading a file" } })).toBe(
      "reading a file",
    );
    expect(progressLabel(activity("Delegated to @Scout: research"))).toBe("Delegated to @Scout: research");
    expect(progressLabel(activity("edit"))).toBeUndefined();
    expect(progressLabel(undefined)).toBeUndefined();
  });
});

describe("progressAction", () => {
  it.each([
    ["read", "reading"],
    ["read_file", "reading"],
    ["grep", "searching"],
    ["web_search", "searching"],
    ["write", "writing"],
    ["create_file", "writing"],
    ["edit", "editing"],
    ["apply_patch", "editing"],
    ["bash", "running"],
    ["computer_exec", "running"],
    ["ask_bot", "asking"],
    ["delegate_bot", "asking"],
    ["screenshot", "computer"],
    ["computer_batch", "computer"],
    ["browser_click", "computer"],
  ] as const)("maps %s to %s", (name, action) => {
    expect(progressAction(activity(name))).toBe(action);
  });

  it("strips the MCP server prefix before classifying", () => {
    expect(progressAction(activity("mcp__ogb__computer_batch"))).toBe("computer");
    expect(progressAction(activity("mcp__fs__read_file"))).toBe("reading");
  });

  it("uses the server's spoken narration when the raw name is unfamiliar", () => {
    expect(progressAction(activity("custom", { tool: { name: "custom", spoken: "searching the web" } }))).toBe(
      "searching",
    );
    expect(progressAction(activity("custom", { tool: { name: "custom", spoken: "asking a teammate" } }))).toBe(
      "asking",
    );
  });

  it("treats comm chips and delegation summaries as conversation, not tools", () => {
    expect(progressAction(activity("Delegated to @Scout: research"))).toBe("asking");
    expect(
      progressAction(
        activity("anything", {
          comm: { groupId: "g", withBotId: "b", withName: "Scout", withColor: "blue" },
        }),
      ),
    ).toBe("asking");
  });

  it("shows writing while text streams, then the action when it pauses", () => {
    const read = { ...activity("read", { at: 200 }), tool: { name: "read", spoken: "reading a file" } };
    expect(progressAction(read, { writing: true })).toBe("reading");
    expect(progressAction(undefined, { writing: true })).toBe("writing-text");
    expect(progressAction(undefined, { reasoning: true })).toBe("thinking");
    expect(progressAction(undefined)).toBe("thinking");
    expect(progressAction(activity("mystery-tool"))).toBe("working");
  });
});
