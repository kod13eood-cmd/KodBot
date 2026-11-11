import { describe, expect, it } from "vitest";

import { buildDelegationTerminalNote } from "./comms-visibility.ts";
import type { BotRecord, GroupRecord } from "./store.ts";

const target: Pick<BotRecord, "id" | "name" | "color"> = {
  id: "bot-scout",
  name: "Scout",
  color: "cyan",
};
const channel: Pick<GroupRecord, "id"> = { id: "group-1" };

describe("buildDelegationTerminalNote", () => {
  it("uses a bounded reply summary and links to the shared channel", () => {
    const note = buildDelegationTerminalNote(target, channel, true, "Three invoices are overdue.");

    expect(note.kind).toBe("activity");
    expect(note.tool?.name).toContain("Scout replied");
    expect(note.tool?.name).toContain("Three invoices are overdue.");
    expect(note.comm).toMatchObject({
      groupId: "group-1",
      withBotId: "bot-scout",
      withName: "Scout",
    });
  });

  it("distinguishes a failure and keeps the channel link", () => {
    const note = buildDelegationTerminalNote(target, channel, false, "", "the engine stopped");

    expect(note.kind).toBe("activity");
    expect(note.tool?.ok).toBe(false);
    expect(note.tool?.name).toContain("Delegated task failed");
    expect(note.tool?.name).toContain("the engine stopped");
    expect(note.comm?.groupId).toBe("group-1");
  });

  it("keeps the source card when there is no shared channel", () => {
    const note = buildDelegationTerminalNote(target, undefined, true, "Done.");

    expect(note.tool?.name).toContain("Scout replied");
    expect(note.comm).toBeUndefined();
  });
});
