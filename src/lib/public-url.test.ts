import { afterEach, describe, expect, it } from "vitest";

import { publicBase, rewriteLocalPageLinks } from "./public-url";

const original = (globalThis as { window?: unknown }).window;

describe("public page addresses", () => {
  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  it("prefers the configured public address over the current origin", () => {
    (globalThis as { window?: unknown }).window = { location: { origin: "http://127.0.0.1:8799" } };
    expect(publicBase({ publicUrl: "http://paperclipi7.tail89d239.ts.net:8799/" })).toBe(
      "http://paperclipi7.tail89d239.ts.net:8799",
    );
    expect(publicBase({})).toBe("http://127.0.0.1:8799");
  });

  it("rewrites loopback page links and leaves other localhost mentions alone", () => {
    const base = "http://paperclipi7:8799";
    const page = "http://127.0.0.1:8799/api/bots/bot-1/pages/report.html";
    expect(rewriteLocalPageLinks(`See ${page}.`, base)).toBe(
      "See http://paperclipi7:8799/api/bots/bot-1/pages/report.html.",
    );
    expect(
      rewriteLocalPageLinks("The dev server runs at http://localhost:3000/api/health", base),
    ).toBe("The dev server runs at http://localhost:3000/api/health");
    expect(
      rewriteLocalPageLinks("[the report](http://localhost:8799/api/bots/b/pages/r.html)", base),
    ).toBe("[the report](http://paperclipi7:8799/api/bots/b/pages/r.html)");
  });
});
