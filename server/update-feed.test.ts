import { describe, expect, it } from "vitest";

import { updateFileAllowed, updateFileType } from "./update-feed.ts";

describe("desktop update feed allowlist", () => {
  it("accepts the manifests and stable installer names", () => {
    for (const name of [
      "latest.yml",
      "latest-linux.yml",
      "KodBot-setup.exe",
      "KodBot.deb",
      "KodBot.AppImage",
    ]) {
      expect(updateFileAllowed(name), name).toBe(true);
    }
  });

  it("accepts versioned Linux and Windows artifacts", () => {
    for (const name of [
      "KodBot-0.1.40-setup.exe",
      "KodBot-0.1.40-setup.exe.blockmap",
      "KodBot-0.1.40-amd64.deb",
      "KodBot-0.1.40-x86_64.AppImage",
    ]) {
      expect(updateFileAllowed(name), name).toBe(true);
    }
  });

  it("rejects traversal, other extensions, and unrelated files", () => {
    for (const name of [
      "../secrets.json",
      "state.tgz",
      "KodBot-0.1.40.zip",
      "KodBot-0.1.40-x64.zip",
      "notes.txt",
      "",
    ]) {
      expect(updateFileAllowed(name), name).toBe(false);
    }
  });

  it("sets a useful content type", () => {
    expect(updateFileType("latest.yml")).toContain("yaml");
    expect(updateFileType("KodBot-0.1.40-setup.exe")).toContain("executable");
    expect(updateFileType("KodBot-0.1.40-amd64.deb")).toContain("debian");
  });
});
