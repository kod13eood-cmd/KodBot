import { describe, expect, it } from "vitest";

import { pendingApprovals, pendingRequests } from "./approvals";
import type { Message } from "@/state/store";

function card(overrides: Record<string, unknown> = {}, message: Partial<Message> = {}): Message {
  return {
    id: "m1",
    role: "bot",
    kind: "options",
    at: 0,
    card: {
      title: "Approval needed",
      subtitle: "rm -rf build",
      options: ["Allow", "Deny"],
      requestId: "req-1",
      tool: "Bash",
      ...overrides,
    },
    ...message,
  } as Message;
}

describe("pending request cards", () => {
  it("treats a permission card as an approval", () => {
    expect(pendingApprovals([card()])).toHaveLength(1);
    expect(pendingRequests([card()])[0]?.tool).toBe("Bash");
  });

  it("counts a question as a request but never as an approval", () => {
    const question = card({ tool: undefined });
    expect(pendingApprovals([question])).toEqual([]);
    expect(pendingRequests([question])).toHaveLength(1);
    expect(pendingRequests([question])[0]?.tool).toBe("");
  });

  it("drops answered and dismissed cards", () => {
    expect(pendingRequests([card({ answered: "allow" })])).toEqual([]);
    expect(pendingRequests([card({ dismissed: true })])).toEqual([]);
    expect(pendingApprovals([card({ dismissed: true })])).toEqual([]);
  });

  it("ignores option cards without a request id", () => {
    expect(pendingRequests([card({ requestId: undefined })])).toEqual([]);
  });
});
