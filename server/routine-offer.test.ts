import { describe, expect, it } from "vitest";

import { routineOffer, suggestedOnceAt } from "./routine-offer.ts";

const base = {
  ok: true,
  toolSteps: 2,
  prompt: "Export the open orders\nInclude the totals.",
  botId: "bot-1",
  now: new Date(2026, 10, 17, 15, 0).getTime(),
  unfinished: false,
  automated: false,
};

describe("routineOffer", () => {
  it("offers a paused routine after a finished multi-step turn", () => {
    const offer = routineOffer(base);
    expect(offer?.draft).toMatchObject({
      name: "Export the open orders",
      botId: "bot-1",
      enabled: false,
      runOn: "crew",
      schedule: { type: "once", at: suggestedOnceAt(base.now) },
    });
    expect(offer?.draft.prompt).toContain("Include the totals.");
    expect(offer?.draft.enabled).toBe(false);
  });

  it("stays quiet for a short turn, a failure, unfinished work, and a scheduled run", () => {
    expect(routineOffer({ ...base, toolSteps: 1 })).toBeNull();
    expect(routineOffer({ ...base, ok: false })).toBeNull();
    expect(routineOffer({ ...base, unfinished: true })).toBeNull();
    expect(routineOffer({ ...base, automated: true })).toBeNull();
    expect(routineOffer({ ...base, prompt: "   " })).toBeNull();
  });
});
