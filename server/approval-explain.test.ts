import { describe, expect, it } from "vitest";

import { explainRequest } from "./approval-explain.ts";

describe("explainRequest", () => {
  it("explains destructive shell commands in plain language", () => {
    expect(explainRequest("Bash", "rm -rf ./dist", "permission")).toContain("Permanently delete");
    expect(explainRequest("Bash", "rm -rf ./dist", "permission")).toContain("./dist");
    expect(explainRequest("Bash", "sudo systemctl restart nginx", "permission")).toContain("administrator");
  });

  it("names common developer actions", () => {
    expect(explainRequest("Bash", "pnpm install", "permission")).toContain("dependencies");
    expect(explainRequest("Bash", "git push origin main", "permission")).toContain("remote repository");
    expect(explainRequest("Bash", "curl https://example.com/data.json", "permission")).toContain("example.com");
  });

  it("explains file tools and questions", () => {
    expect(explainRequest("Edit", "src/App.tsx", "permission")).toContain("src/App.tsx");
    expect(explainRequest("Write", "reports/today.md", "permission")).toContain("Create or overwrite");
    expect(explainRequest("ask_user", "Which account?", "question")).toContain("needs your answer");
  });

  it("humanizes connected-app tool names", () => {
    expect(explainRequest("mcp__composio__gmail_send_email", "Send the draft", "permission")).toContain(
      "gmail send email",
    );
  });
});
