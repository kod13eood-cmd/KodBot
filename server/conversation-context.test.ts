// The transcript is what an API-backed driver remembers. A page the bot wrote
// is a file on disk, so the transcript has to carry its text or a later turn
// has no idea what the page said.
import { describe, expect, it } from "vitest";

import { roomContext, transcriptTurns } from "./conversation-context.ts";
import type { Message } from "./store.ts";

function message(partial: Partial<Message> & Pick<Message, "id" | "role" | "kind">): Message {
  return { at: 0, ...partial };
}

const page = message({
  id: "m-page",
  role: "bot",
  kind: "page",
  text: 'Created page "Open orders" at /w/pages/orders.html.\n\nOrders Two open',
  page: { botId: "b", name: "orders.html", title: "Open orders", bytes: 120, updatedAt: 5 },
});

describe("conversation context", () => {
  it("replays a page announcement as the assistant's own turn", () => {
    expect(transcriptTurns([page])).toEqual([
      { role: "assistant", text: 'Created page "Open orders" at /w/pages/orders.html.\n\nOrders Two open' },
    ]);
  });

  it("skips cards, activity, screen frames and textless page messages", () => {
    const turns = transcriptTurns([
      message({ id: "m-card", role: "bot", kind: "options", text: "pick one" }),
      message({ id: "m-activity", role: "bot", kind: "activity", text: "read a file" }),
      message({ id: "m-screen", role: "bot", kind: "screen" }),
      message({ id: "m-old-page", role: "bot", kind: "page" }),
      message({ id: "m-user", role: "user", kind: "text", text: "hello" }),
    ]);
    expect(turns).toEqual([{ role: "user", text: "hello" }]);
  });

  it("leaves out the message that is travelling as the turn text", () => {
    const turns = transcriptTurns([page, message({ id: "new", role: "user", kind: "text", text: "and now?" })], "new");
    expect(turns.map((turn) => turn.text)).toEqual([page.text]);
  });

  it("keeps the newest turns when it has to cap the history", () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      message({ id: `m${i}`, role: "user", kind: "text", text: `turn ${i}` }),
    );
    expect(transcriptTurns(many, undefined, 2).map((turn) => turn.text)).toEqual(["turn 3", "turn 4"]);
  });

  it("replays an earlier reply with the quote it answered", () => {
    const reply = message({
      id: "m-reply",
      role: "user",
      kind: "text",
      text: "which ones?",
      replyTo: { id: "m-page", role: "bot", text: "Orders Two open" },
    });
    const turns = transcriptTurns([page, reply]);
    const turn = turns[1]!;
    expect(turn.text).toContain('Replying to the assistant\'s earlier message: "Orders Two open"');
    expect(turn.text).toContain("which ones?");
  });

  it("attributes room lines to the member that spoke, pages included", () => {
    const context = roomContext(
      [
        message({ id: "u1", role: "user", kind: "text", text: "build the report" }),
        { ...page, from: { botId: "b1", name: "Scout", color: "#fff" } },
      ],
      "Deso",
    );
    expect(context.split("\n")[0]).toBe("Deso: build the report");
    expect(context).toContain('Scout: Created page "Open orders"');
  });
});
