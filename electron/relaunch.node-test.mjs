import assert from "node:assert/strict";
import { test } from "node:test";

import { relaunchCommand } from "./relaunch.mjs";

test("relaunches through the AppImage once the old extraction is gone", () => {
  assert.deepEqual(relaunchCommand({ platform: "linux", appImage: "/home/me/.local/opt/kodbot/KodBot.AppImage" }), {
    command: "/bin/sh",
    args: ["-c", 'sleep 1; exec "$1"', "sh", "/home/me/.local/opt/kodbot/KodBot.AppImage"],
  });
});

test("keeps Electron's default relaunch everywhere else", () => {
  assert.equal(relaunchCommand({ platform: "linux", appImage: undefined }), null);
  assert.equal(relaunchCommand({ platform: "darwin", appImage: "/Applications/KodBot.app" }), null);
  assert.equal(relaunchCommand({ platform: "win32", appImage: "C:\\KodBot.exe" }), null);
});
