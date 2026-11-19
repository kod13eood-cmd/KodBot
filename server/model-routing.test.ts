import { describe, expect, it } from "vitest";

import { chooseAutoModel, routeAutoModel } from "./model-routing.ts";

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

  it("keeps a short request on the strongest model", () => {
    expect(chooseAutoModel("fix the login", options)).toEqual({ instanceId: "strong", model: "opus-5" });
    expect(chooseAutoModel("what time is it?", options)).toEqual({ instanceId: "strong", model: "opus-5" });
  });

  it("keeps code on a strong model even in economy mode", () => {
    expect(chooseAutoModel("fix the login", options, undefined, { economy: true })).toEqual({
      instanceId: "strong",
      model: "opus-5",
    });
  });

  it("sends a screen to a model that can see", () => {
    const seen = chooseAutoModel("open the page and click the orders table", [
      { instanceId: "strong", model: "opus-5", label: "Opus 5" },
      { instanceId: "eyes", model: "screen-vl", label: "Screen", vision: true },
    ]);
    expect(seen).toEqual({ instanceId: "eyes", model: "screen-vl" });
    expect(routeAutoModel("open the page and click the orders table", [
      { instanceId: "strong", model: "opus-5", label: "Opus 5" },
      { instanceId: "eyes", model: "screen-vl", label: "Screen", vision: true },
    ])?.skill).toBe("screen");
  });

  it("sends a short translation to a cheap model only in economy mode", () => {
    expect(chooseAutoModel("translate hello to French", options)).toEqual({
      instanceId: "strong",
      model: "opus-5",
    });
    expect(chooseAutoModel("translate hello to French", options, undefined, { economy: true })).toEqual({
      instanceId: "fast",
      model: "mini-free",
    });
  });

  it("sends short simple requests to the cheapest fast model only in economy mode", () => {
    expect(chooseAutoModel("what time is it?", options, undefined, { economy: true })).toEqual({
      instanceId: "fast",
      model: "mini-free",
    });
  });

  it("keeps the current selection as a fallback and never returns an empty choice", () => {
    expect(chooseAutoModel("hello", [], { instanceId: "current", model: "model-a" })).toEqual({
      instanceId: "current",
      model: "model-a",
    });
    expect(chooseAutoModel("hello", [])).toBeNull();
  });
});
