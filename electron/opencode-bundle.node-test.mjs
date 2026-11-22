import assert from "node:assert/strict";
import test from "node:test";

import { resolveBundledOpenCode } from "./opencode-bundle.mjs";

test("finds the packaged engine under Resources/opencode", () => {
  const seen = [];
  const dir = resolveBundledOpenCode({
    isPackaged: true,
    resourcesPath: "/app/resources",
    appPath: "/app/resources/app.asar",
    exists: (path) => {
      seen.push(path);
      return true;
    },
  });
  assert.equal(dir, "/app/resources/opencode");
  assert.deepEqual(seen, ["/app/resources/opencode"]);
});

test("uses the source checkout's resources/opencode in development", () => {
  assert.equal(
    resolveBundledOpenCode({
      isPackaged: false,
      resourcesPath: "/electron/resources",
      appPath: "/repo",
      exists: () => true,
    }),
    "/repo/resources/opencode",
  );
});

test("returns null when this build did not stage an engine", () => {
  assert.equal(
    resolveBundledOpenCode({
      isPackaged: true,
      resourcesPath: "/app/resources",
      appPath: "/app/resources/app.asar",
      exists: () => false,
    }),
    null,
  );
});
