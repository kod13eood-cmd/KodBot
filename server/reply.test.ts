import { describe, expect, it } from "vitest";

import { replyContext, replyExcerpt } from "./reply.ts";

describe("reply quotes", () => {
  it("flattens whitespace and bounds the excerpt", () => {
    expect(replyExcerpt("  line one\n\nline two  ")).toBe("line one line two");
    expect(replyExcerpt("x".repeat(700))).toHaveLength(600);
    expect(replyExcerpt("x".repeat(700)).endsWith("…")).toBe(true);
  });

  it("names the assistant and the member that wrote the quoted message", () => {
    expect(replyContext({ id: "m1", role: "bot", text: "Orders are open" })).toBe(
      '[Replying to the assistant\'s earlier message: "Orders are open"]',
    );
    expect(replyContext({ id: "m2", role: "bot", text: "Done", fromName: "Mochi" })).toContain(
      "assistant's earlier message (Mochi)",
    );
    expect(replyContext({ id: "m3", role: "user", text: "Run it" })).toContain("user's earlier message");
  });

  it("never produces an empty quote", () => {
    expect(replyContext({ id: "m4", role: "bot", text: "" })).toContain("(no text)");
  });
});
