import { describe, expect, it } from "vitest";

import type { Message } from "./store.ts";
import { toolTrace } from "./tool-trace.ts";

function activity(id: string, name: string, ok?: boolean): Message {
  return { id, role: "bot", kind: "activity", tool: { name, ok }, at: 0 };
}

describe("toolTrace", () => {
  it("keeps the latest tool chips and drops screens and errors", () => {
    const messages: Message[] = [
      { id: "u", role: "user", kind: "text", text: "look", at: 0 },
      activity("a", "shell: ls"),
      { id: "s", role: "bot", kind: "screen", png: "xxxx", at: 0 },
      activity("b", "edit: src/app.ts", false),
      activity("c", "error: boom", false),
    ];
    expect(toolTrace(messages, "u")).toBe(
      ["[Recent tool activity, newest last:]", "ok shell: ls", "failed edit: src/app.ts"].join("\n"),
    );
  });

  it("is empty when the thread has no tool chips", () => {
    expect(toolTrace([{ id: "u", role: "user", kind: "text", text: "hi", at: 0 }])).toBe("");
  });
});
