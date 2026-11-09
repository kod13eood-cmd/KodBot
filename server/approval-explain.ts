/** Turn the provider's terse permission summary into one sentence a person
 * can decide on. This is deliberately deterministic: an approval must never
 * wait on a model call, and the same request must read the same way twice. */
export function explainRequest(
  tool: string,
  summary: string,
  requestType: "permission" | "question",
): string {
  if (requestType === "question") return "The bot needs your answer before it can continue.";
  const rawTool = String(tool ?? "").trim();
  const t = rawTool.toLowerCase();
  const text = String(summary ?? "").trim();

  if (t === "bash" || t === "shell" || t === "execute" || t.includes("command")) {
    return explainShell(text);
  }
  if (t === "edit" || t === "multiedit") return `Modify ${fileLabel(text)}.`;
  if (t === "write" || t === "create") return `Create or overwrite ${fileLabel(text)}.`;
  if (t === "read") return `Read ${fileLabel(text)}.`;
  if (t === "webfetch" || t.includes("fetch")) return `Download or read ${urlLabel(text)} from the internet.`;
  if (t === "websearch" || t.includes("search")) return "Search the web for information.";
  if (t.includes("computer") || t.includes("cua")) {
    return "Control the bot's computer to perform the requested step.";
  }
  if (t.startsWith("mcp__") || t.includes("composio")) {
    return `Use the connected app tool “${humanize(rawTool)}” to do this.`;
  }
  return `Use the “${humanize(rawTool || "tool")}” tool to do this.`;
}

function explainShell(command: string): string {
  const oneLine = command.split(/\r?\n/).find((line) => line.trim())?.trim() ?? command;
  const lower = oneLine.toLowerCase();
  if (/\brm\s+(-[^\s]+\s+)*-?rf?\b|\brm\s+-r\b/.test(lower)) {
    return `Permanently delete files or folders${pathHint(oneLine)}. This cannot be undone.`;
  }
  if (/^sudo\b/.test(lower)) return "Run a command with administrator privileges.";
  if (/\bgit\s+push\b/.test(lower)) return "Send local Git commits to a remote repository.";
  if (/\bgit\s+reset\s+--hard\b/.test(lower)) return "Discard local commits and working-tree changes.";
  if (/\bgit\s+(commit|merge|rebase|checkout|switch)\b/.test(lower)) {
    return "Change the local Git history or working tree.";
  }
  if (/\bgit\b/.test(lower)) return "Run a Git command in the project.";
  if (/\b(npm|pnpm|yarn|bun)\s+(install|add|ci)\b/.test(lower)) {
    return "Install or update project dependencies.";
  }
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(build|test|lint)\b/.test(lower)) {
    return "Build, test, or lint the project.";
  }
  if (/\b(curl|wget)\b/.test(lower)) return `Download content from ${urlLabel(oneLine)}.`;
  if (/\b(chmod|chown)\b/.test(lower)) return "Change file permissions or ownership.";
  if (/\b(mv|cp|mkdir|rmdir|touch)\b/.test(lower)) return "Move, copy, or create files and folders.";
  if (/\b(find|grep|rg|fd)\b/.test(lower)) return "Search files or text on this computer.";
  if (/\b(cat|head|tail|less|more)\b/.test(lower)) return "Read files from this computer.";
  if (/\b(python|python3|node|tsx|deno|ruby|php)\b/.test(lower)) {
    return "Run a script or program on this computer.";
  }
  if (/\b(docker|podman|kubectl)\b/.test(lower)) return "Manage containers or a container cluster.";
  if (/\b(ssh|scp|rsync)\b/.test(lower)) return "Connect to, or copy files to, another computer.";
  if (/\b(kill|pkill|killall)\b/.test(lower)) return "Stop a running process.";
  if (/\b(open|xdg-open|start)\b/.test(lower)) return "Open an app, file, or URL.";
  return "Run a shell command on this computer.";
}

function fileLabel(text: string): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value ? `“${value.slice(0, 120)}”` : "a file";
}

function pathHint(command: string): string {
  const match = command.match(/(?:^|\s)([.~]?\/[^\s'"]+)/);
  return match ? ` at “${match[1].slice(0, 100)}”` : "";
}

function urlLabel(text: string): string {
  const match = text.match(/https?:\/\/[^\s'"`]+/);
  return match ? `“${match[0].slice(0, 120)}”` : "a URL";
}

function humanize(tool: string): string {
  return tool
    .replace(/^mcp__[^_]+__/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "tool";
}
