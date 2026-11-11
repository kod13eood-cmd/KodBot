import { describe, expect, it } from "vitest";

import { explainRequest, explainRequestDetails } from "./approval-explain.ts";

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

  it("treats OpenCode's generic 'other' tool as the shell command it carries", () => {
    const details = explainRequestDetails("other", "cd /srv/app && rm -rf ./dist", "permission");
    expect(details.summary).toContain("Permanently delete");
    expect(details.summary).toContain("./dist");
    expect(details.level).toBe("high");
  });
});

describe("explainRequestDetails", () => {
  it("names the risk and why approval is needed", () => {
    const destructive = explainRequestDetails("Bash", "rm -rf /tmp/work", "permission");
    expect(destructive.level).toBe("high");
    expect(destructive.risk).toContain("permanently delete");

    const read = explainRequestDetails("Read", "src/App.tsx", "permission");
    expect(read.level).toBe("low");
    expect(read.risk).toContain("read-only");

    const network = explainRequestDetails("Bash", "curl https://example.com/upload", "permission");
    expect(network.level).toBe("medium");
    expect(network.risk).toContain("send data");

    const cat = explainRequestDetails("Bash", "cat README.md", "permission");
    expect(cat.level).toBe("low");

    const service = explainRequestDetails("Bash", "systemctl restart nginx", "permission");
    expect(service.summary).toContain("system service");
    expect(service.level).toBe("high");

    const deploy = explainRequestDetails("Bash", "wrangler deploy", "permission");
    expect(deploy.level).toBe("high");
  });

  it("explains connected-app and desktop actions as external effects", () => {
    const mail = explainRequestDetails("mcp__composio__gmail_send_email", "Send the draft", "permission");
    expect(mail.level).toBe("high");
    expect(mail.risk).toContain("connected app");

    const desktop = explainRequestDetails("computer_click", "Click Submit", "permission");
    expect(desktop.level).toBe("medium");
    expect(desktop.risk).toContain("shared desktop");
  });

  it("does not pretend a question runs a command", () => {
    const question = explainRequestDetails("ask_user", "Which account?", "question");
    expect(question.summary).toContain("needs your answer");
    expect(question.level).toBe("low");
    expect(question.risk).toContain("No command runs");
  });
});
