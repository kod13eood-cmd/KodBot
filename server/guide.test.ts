import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GUIDE_FILE_NAME, ensureGuideCopy, guideSystemPrompt } from "./guide.ts";

let root = "";
let source = "";
let previous: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kodbot-guide-"));
  source = join(root, "source.md");
  writeFileSync(source, "# Guide\n\nUse **Bot settings → Connected apps**.\n");
  previous = process.env.OC_USER_GUIDE;
  process.env.OC_USER_GUIDE = source;
});

afterEach(() => {
  if (previous === undefined) delete process.env.OC_USER_GUIDE;
  else process.env.OC_USER_GUIDE = previous;
  rmSync(root, { recursive: true, force: true });
});

describe("bot user guide", () => {
  it("copies the guide into a workspace with owner-only permissions", () => {
    const workspace = join(root, "workspace");
    const target = ensureGuideCopy(workspace);
    expect(target).toBe(join(workspace, GUIDE_FILE_NAME));
    expect(readFileSync(target!, "utf8")).toContain("Bot settings → Connected apps");
    expect(statSync(target!).mode & 0o777).toBe(0o600);
  });

  it("refreshes an older copy without touching the source", () => {
    const workspace = join(root, "workspace");
    ensureGuideCopy(workspace);
    writeFileSync(source, "# Guide\n\nNew steps.\n");
    ensureGuideCopy(workspace);
    expect(readFileSync(join(workspace, GUIDE_FILE_NAME), "utf8")).toContain("New steps");
    expect(readFileSync(source, "utf8")).toContain("New steps");
  });

  it("tells a file-capable bot where the guide is and to read it", () => {
    const workspace = join(root, "workspace");
    const prompt = guideSystemPrompt(workspace);
    expect(prompt).toContain(join(workspace, GUIDE_FILE_NAME));
    expect(prompt).toContain("read that file");
    expect(prompt).toContain("Do not invent UI");
  });

  it("keeps a fallback for engines without a local workspace", () => {
    const prompt = guideSystemPrompt();
    expect(prompt).toContain("Help panel");
    expect(prompt).toContain("do not invent steps");
  });
});
