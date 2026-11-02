import { describe, expect, it } from "vitest";

import { modelCapabilities } from "./model-capabilities";

describe("model capabilities", () => {
  it("marks every model as text", () => {
    expect(modelCapabilities({ id: "unknown-model", label: "Unknown" })).toContain("text");
  });

  it("detects multimodal and media families", () => {
    expect(modelCapabilities({ id: "claude-opus-5", label: "Claude Opus 5" })).toEqual(["text", "vision"]);
    expect(modelCapabilities({ id: "gpt-4o-audio", label: "GPT-4o Audio" })).toContain("audio");
    expect(modelCapabilities({ id: "sora-video", label: "Sora Video" })).toContain("video");
    expect(modelCapabilities({ id: "flux-image", label: "Flux Image" })).toContain("image");
    expect(modelCapabilities({ id: "o3-mini", label: "o3 mini" })).toContain("reasoning");
  });
});
