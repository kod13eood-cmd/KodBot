import { describe, expect, it } from "vitest";

import { chooseAutoModel } from "./model-routing.ts";

const options = [
  { instanceId: "fast", model: "mini-free", label: "Mini Free", free: true },
  { instanceId: "strong", model: "opus-5", label: "Opus 5" },
];

describe("auto model routing", () => {
  it("sends complex work to the strongest available model", () => {
    expect(chooseAutoModel("Refactor the authentication architecture and debug the migration", options)).toEqual({
      instanceId: "strong",
      model: "opus-5",
    });
  });

  it("sends short simple requests to the cheapest fast model", () => {
    expect(chooseAutoModel("what time is it?", options)).toEqual({ instanceId: "fast", model: "mini-free" });
  });

  it("keeps the current selection as a fallback and never returns an empty choice", () => {
    expect(chooseAutoModel("hello", [], { instanceId: "current", model: "model-a" })).toEqual({
      instanceId: "current",
      model: "model-a",
    });
    expect(chooseAutoModel("hello", [])).toBeNull();
  });
});
