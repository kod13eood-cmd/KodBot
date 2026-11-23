import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** electron-builder takes the Windows "Publisher" and the executable's
 * CompanyName from package.json author.name. Keep that legal name stable and
 * never add win.publisherName while the installer is unsigned: an update
 * carrying a publisherName is rejected by electron-updater. */
describe("release metadata", () => {
  // SAFETY: package.json is repository-owned build metadata; the assertions
  // below pin the fields electron-builder reads. A malformed file still fails
  // the test loudly at parse time.
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    author?: { name?: string; email?: string };
  };
  const builder = readFileSync("electron-builder.yml", "utf8");
  const installer = readFileSync("build/installer.nsh", "utf8");

  it("publishes installers under Kod 13 Ltd, not a personal name", () => {
    expect(pkg.author?.name).toBe("Kod 13 Ltd");
  });

  it("keeps the unsigned Windows build free of publisherName", () => {
    expect(builder).not.toMatch(/^\s*publisherName:/m);
  });

  it("uses the same legal name for the Linux deb maintainer", () => {
    expect(builder).toMatch(/^\s*maintainer: Kod 13 Ltd\b/m);
  });

  it("uses the Linux mint-K icon for the Windows executable", () => {
    const win = builder.slice(builder.indexOf("\nwin:"), builder.indexOf("\nnsis:"));
    expect(win).toContain("icon: build/icon.ico");
  });

  it("resets only the first-run routing on a real uninstall", () => {
    expect(installer).toMatch(/!macro customUnInstall/);
    expect(installer).toMatch(/ifNot} \$\{isUpdated\}/);
    expect(installer).toMatch(/server-connection\.json/);
    expect(installer).not.toMatch(/RMDir|Delete.*(?:\.kodbot|bots|config\.json)/);
  });
});
