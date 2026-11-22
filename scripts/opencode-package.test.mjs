import assert from "node:assert/strict";
import test from "node:test";

import { opencodeBinaryName, opencodePackageName } from "./opencode-package.mjs";

test("maps every desktop target to the official OpenCode package", () => {
  assert.equal(opencodePackageName("linux", "x64"), "opencode-linux-x64-baseline");
  assert.equal(opencodePackageName("linux", "arm64"), "opencode-linux-arm64");
  assert.equal(opencodePackageName("darwin", "x64"), "opencode-darwin-x64-baseline");
  assert.equal(opencodePackageName("darwin", "arm64"), "opencode-darwin-arm64");
  assert.equal(opencodePackageName("win32", "x64"), "opencode-windows-x64-baseline");
  assert.equal(opencodePackageName("win32", "arm64"), "opencode-windows-arm64");
});

test("uses the Windows executable suffix", () => {
  assert.equal(opencodeBinaryName("linux"), "opencode");
  assert.equal(opencodeBinaryName("darwin"), "opencode");
  assert.equal(opencodeBinaryName("win32"), "opencode.exe");
});

test("rejects unsupported targets instead of fetching the wrong binary", () => {
  assert.throws(() => opencodePackageName("freebsd", "x64"), /platform/);
  assert.throws(() => opencodePackageName("linux", "ia32"), /arch/);
});
