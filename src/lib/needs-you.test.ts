import { describe, expect, it } from "vitest";

import { collectNeedsYou, collectRoutineFailures, type NeedsYouCandidate } from "./needs-you";
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

describe("routine failure collection", () => {
  const crews = [
    { id: "bot-Atlas", name: "Atlas" },
    { id: "bot-Hidden", name: "Hidden", hidden: true },
  ];

  it("lists an unseen failed run with the routine name and error", () => {
    expect(
      collectRoutineFailures(
        [{ id: "run-1", botId: "bot-Atlas", routineName: "Morning report", status: "failed", error: "engine missing" }],
        crews,
      ),
    ).toEqual([
      {
        kind: "routine",
        id: "run-1",
        name: "Atlas",
        reason: "routine-failed",
        detail: "Morning report — engine missing",
      },
    ]);
  });

  it("distinguishes a missed run and skips seen or hidden runs", () => {
    const runs = [
      { id: "run-1", botId: "bot-Atlas", routineName: "Daily brief", status: "missed" as const, error: "offline" },
      { id: "run-2", botId: "bot-Atlas", routineName: "Seen", status: "failed" as const, seenAt: 10 },
      { id: "run-3", botId: "bot-Hidden", routineName: "Hidden", status: "failed" as const },
    ];
    expect(collectRoutineFailures(runs, crews)).toEqual([
      {
        kind: "routine",
        id: "run-1",
        name: "Atlas",
        reason: "routine-missed",
        detail: "Daily brief — offline",
      },
    ]);
  });
});
