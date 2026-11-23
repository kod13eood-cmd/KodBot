import { describe, expect, it } from "vitest";

import { appendPathEntry, pathContains, registerWindowsUserPath } from "./windows-path.mjs";

function fakeRun(stdout, error = null) {
  const calls = [];
  const run = (executable, args, options, callback) => {
    calls.push({ executable, args, options });
    callback(error, stdout, "");
  };
  return { calls, run };
}

describe("Windows user PATH", () => {
  it("adds the OpenCode directory once, preserving the existing entries", () => {
    expect(appendPathEntry("C:\\Windows;C:\\Tools", "C:\\KodBot\\opencode")).toBe(
      "C:\\Windows;C:\\Tools;C:\\KodBot\\opencode",
    );
    expect(appendPathEntry("C:\\Windows;C:\\KodBot\\opencode;", "c:\\kodbot\\OPENCODE")).toBe(
      "C:\\Windows;C:\\KodBot\\opencode;",
    );
  });

  it("compares entries case-insensitively and ignores blanks", () => {
    expect(pathContains("C:\\Windows;; C:\\KodBot\\opencode ", "c:\\kodbot\\opencode")).toBe(true);
    expect(pathContains("", "C:\\KodBot\\opencode")).toBe(false);
  });

  it("skips non-Windows hosts", async () => {
    const result = await registerWindowsUserPath("/opt/kodbot/opencode", { platform: "linux" });
    expect(result).toEqual({ changed: false, reason: "not-applicable" });
  });

  it("runs PowerShell in the user context and updates this process PATH", async () => {
    const fake = fakeRun("added");
    const env = { PATH: "C:\\Windows" };
    const result = await registerWindowsUserPath("C:\\KodBot\\opencode", {
      platform: "win32",
      env,
      run: fake.run,
    });
    expect(result.changed).toBe(true);
    expect(fake.calls[0].executable).toBe("powershell.exe");
    expect(fake.calls[0].options.env.KODBOT_PATH_ENTRY).toBe("C:\\KodBot\\opencode");
    expect(env.PATH).toContain("C:\\KodBot\\opencode");
  });

  it("reports present without changing PATH again", async () => {
    const fake = fakeRun("present");
    const env = { PATH: "C:\\Windows;C:\\KodBot\\opencode" };
    const result = await registerWindowsUserPath("C:\\KodBot\\opencode", {
      platform: "win32",
      env,
      run: fake.run,
    });
    expect(result.changed).toBe(false);
    expect(env.PATH).toBe("C:\\Windows;C:\\KodBot\\opencode");
  });

  it("fails open when PowerShell cannot run", async () => {
    const fake = fakeRun("", new Error("powershell missing"));
    const result = await registerWindowsUserPath("C:\\KodBot\\opencode", {
      platform: "win32",
      env: { PATH: "" },
      run: fake.run,
    });
    expect(result.changed).toBe(false);
    expect(result.error).toContain("powershell missing");
  });
});
