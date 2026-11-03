import { describe, expect, it } from "vitest";

import { collectNeedsYou, type NeedsYouCandidate } from "./needs-you";
import type { Message } from "@/state/store";

function card(tool?: string, from?: { botId: string; name: string }): Message {
  return {
    id: `m-${tool ?? "question"}`,
    role: "bot",
    kind: "options",
    at: 0,
    ...(from ? { from: { ...from, color: "#fff" } } : {}),
    card: {
      title: "Approval needed",
      subtitle: "details",
      options: [],
      requestId: "req-1",
      ...(tool ? { tool } : {}),
    },
  } as Message;
}

function bot(name: string, messages: Message[] = [], activity = "idle", hidden = false): NeedsYouCandidate {
  return { kind: "bot", id: `bot-${name}`, name, messages, activity, hidden };
}

function group(name: string, messages: Message[]): NeedsYouCandidate {
  return { kind: "group", id: `group-${name}`, name, messages };
}

describe("needs-you collection", () => {
  it("lists a bot waiting on an approval with the tool's detail", () => {
    expect(collectNeedsYou([bot("Mochi", [card("Bash")])], [])).toEqual([
      { kind: "bot", id: "bot-Mochi", name: "Mochi", reason: "approval", detail: "details" },
    ]);
  });

  it("lists a question separately from an approval", () => {
    expect(collectNeedsYou([bot("Mochi", [card()])], [])[0]?.reason).toBe("question");
  });

  it("uses the waiting activity when the card is outside the loaded window", () => {
    expect(collectNeedsYou([bot("Mochi", [], "waiting-on-you")], [])).toEqual([
      { kind: "bot", id: "bot-Mochi", name: "Mochi", reason: "waiting" },
    ]);
  });

  it("never lists a hidden bot", () => {
    expect(collectNeedsYou([bot("Mochi", [card("Bash")], "waiting-on-you", true)], [])).toEqual([]);
  });

  it("names the room, not the member, when the request is in a room", () => {
    const items = collectNeedsYou(
      [bot("Mochi", [], "waiting-on-you")],
      [group("Mochi ⇄ Comet", [card("Bash", { botId: "bot-Mochi", name: "Mochi" })])],
    );
    expect(items).toEqual([
      { kind: "group", id: "group-Mochi ⇄ Comet", name: "Mochi ⇄ Comet", reason: "approval", detail: "details" },
    ]);
  });
});
