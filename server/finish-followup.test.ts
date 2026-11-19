import { describe, expect, it } from "vitest";

import { FINISH_RETRY_PROMPT, finishFollowUp, looksOpenList } from "./finish-followup.ts";

describe("finishFollowUp", () => {
  it("treats an unchecked list as unfinished and a plain summary as done", () => {
    expect(looksOpenList("Done.\n- [ ] export the totals")).toBe(true);
    expect(looksOpenList("Next steps:\n1. Send the file")).toBe(true);
    expect(looksOpenList("Done.\n1. Exported the totals")).toBe(false);
  });

  it("retries once when the bot works alone, then asks a person", () => {
    const first = finishFollowUp({
      workAlone: true,
      cancelled: false,
      denied: true,
      openList: false,
      alreadyRetried: false,
    });
    expect(first).toEqual({ kind: "retry", prompt: FINISH_RETRY_PROMPT });
    const second = finishFollowUp({
      workAlone: true,
      cancelled: false,
      denied: false,
      openList: true,
      alreadyRetried: true,
    });
    expect(second.kind).toBe("ask");
  });

  it("does not retry a cancelled turn, a finished turn, or a bot that is not working alone", () => {
    expect(finishFollowUp({ workAlone: true, cancelled: true, denied: true, openList: true, alreadyRetried: false }).kind).toBe("none");
    expect(finishFollowUp({ workAlone: true, cancelled: false, denied: false, openList: false, alreadyRetried: false }).kind).toBe("none");
    expect(finishFollowUp({ workAlone: false, cancelled: false, denied: true, openList: true, alreadyRetried: false }).kind).toBe("none");
  });
});
