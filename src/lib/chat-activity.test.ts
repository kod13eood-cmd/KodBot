import { describe, expect, it } from "vitest";

import type { Message } from "@/state/store";
import {
  isUserFacingActivity,
  latestProgress,
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

  it("labels with the narration, a handoff, or nothing for raw tools", () => {
    expect(progressLabel({ ...activity("read"), tool: { name: "read", spoken: "reading a file" } })).toBe(
      "reading a file",
    );
    expect(progressLabel(activity("Delegated to @Scout: research"))).toBe("Delegated to @Scout: research");
    expect(progressLabel(activity("edit"))).toBeUndefined();
    expect(progressLabel(undefined)).toBeUndefined();
  });
});
