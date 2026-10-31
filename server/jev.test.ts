import { describe, expect, it, vi } from "vitest";

import { askJev, JEV_PRESETS, jevConfigured, jevRequest } from "./jev.ts";

const cfg = { opencodeGo: { apiKey: "zen-test-key" } };

describe("jev request validation", () => {
  it("accepts a preset and fills the questions for the agent", () => {
    const request = jevRequest({ state: "The export broke again", preset: "bug" });
    expect(request.model).toBe("jev-1.13-free");
    expect(request.questions).toEqual(JEV_PRESETS.bug);
  });

  it("requires either preset or questions, not both", () => {
    expect(() =>
      jevRequest({
        state: "x",
        preset: "triage",
        questions: { is_bug: { type: "noul", instructions: "bug?" } },
      }),
    ).toThrow(/either preset or questions/);
  });

  it("rejects unknown types and empty states", () => {
    expect(() => jevRequest({ state: "x", questions: { q: { type: "essay", instructions: "?" } } })).toThrow(
      /noul, choice, or score/,
    );
    expect(() => jevRequest({ state: "   ", questions: { q: { type: "noul", instructions: "?" } } })).toThrow(
      /state must be non-empty/,
    );
  });

  it("only permits the two documented Jev models", () => {
    expect(jevRequest({ state: "x", preset: "triage", model: "jev-1.13" }).model).toBe("jev-1.13");
    expect(() => jevRequest({ state: "x", preset: "triage", model: "gpt-5" })).toThrow(/model must be one of/);
  });

  it("reports whether the app or CLI login supplies a Zen key", () => {
    expect(jevConfigured(cfg)).toBe(true);
  });
});

describe("askJev", () => {
  it("posts the typed question payload with the harness-owned key", async () => {
    const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
      new Response(
        JSON.stringify({
          model: "jev-1.13-free",
          answers: { is_urgent: { type: "noul", noul: 0.9 } },
          usage: { input_tokens: 12, output_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await askJev(
      cfg,
      "Everything is on fire",
      { is_urgent: { type: "noul", instructions: "Is this urgent?" } },
      "jev-1.13-free",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.answers).toEqual({ is_urgent: { type: "noul", noul: 0.9 } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://opencode.ai/zen/v1/systemone");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer zen-test-key",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "jev-1.13-free",
      state: "Everything is on fire",
      questions: { is_urgent: { type: "noul", instructions: "Is this urgent?" } },
    });
  });

  it("surfaces upstream failures without leaking the key", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    await expect(
      askJev(cfg, "x", { q: { type: "noul", instructions: "?" } }, "jev-1.13-free", fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/HTTP 502/);
    await expect(
      askJev(cfg, "x", { q: { type: "noul", instructions: "?" } }, "jev-1.13-free", fetchMock as unknown as typeof fetch),
    ).rejects.not.toThrow(/zen-test-key/);
  });
});
