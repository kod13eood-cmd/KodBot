import { describe, expect, it } from "vitest";

import { extractAutomationSummary } from "./automation-summary.ts";

describe("extractAutomationSummary", () => {
  it("takes the compact block and a real needs-you line", () => {
    const text = `I'll start by reading the baseline.

Full report is in the page.

SUMMARY:
- Two competitors shipped voice features.
- One price changed.
- Nothing needs a rollback.

NEEDS YOU: approve the price alert threshold.`;
    expect(extractAutomationSummary(text)).toEqual({
      summary: "- Two competitors shipped voice features.\n- One price changed.\n- Nothing needs a rollback.",
      needs: "approve the price alert threshold.",
    });
  });

  it("accepts bold markers and omits an empty needs-you", () => {
    expect(
      extractAutomationSummary("Work done.\n\n**SUMMARY:**\n- All clear.\n\n**NEEDS YOU:** nothing"),
    ).toEqual({ summary: "- All clear." });
  });

  it("returns null without a summary marker so the caller can fall back", () => {
    expect(extractAutomationSummary("Only a long report, no marker.")).toBeNull();
  });
});
