/** Turn the provider's terse permission summary into text a person can decide
 * on. Deliberately deterministic: an approval must never wait on a model call,
 * and the same request must read the same way twice. `summary` says what will
 * happen; `risk` says why the bot is asking and what could go wrong. */
export type ApprovalRiskLevel = "low" | "medium" | "high";

export interface ApprovalExplanation {
  summary: string;
  risk: string;
  level: ApprovalRiskLevel;
}

export function explainRequest(
  tool: string,
  summary: string,
  requestType: "permission" | "question",
): string {
  return explainRequestDetails(tool, summary, requestType).summary;
}

export function explainRequestDetails(
  tool: string,
  summary: string,
  requestType: "permission" | "question",
): ApprovalExplanation {
  if (requestType === "question") {
    return {
      summary: "The bot needs your answer before it can continue.",
      risk: "No command runs from this answer; the bot uses your decision to continue its task.",
      level: "low",
    };
  }
  const rawTool = String(tool ?? "").trim();
  const t = rawTool.toLowerCase();
  const text = String(summary ?? "").trim();
  const commandLike =
    t === "bash" ||
    t === "shell" ||
    t === "execute" ||
    t === "exec" ||
    t === "terminal" ||
    t === "command" ||
    t === "other" ||
    t === "unknown" ||
    t === "tool" ||
    t === "" ||
    t.includes("command");
  return {
    summary: describeAction(rawTool, t, text, commandLike),
    ...riskFor(t, text, commandLike),
  };
}

function describeAction(rawTool: string, tool: string, text: string, commandLike: boolean): string {
  if (commandLike) return explainShell(text);
  if (tool === "edit" || tool === "multiedit") return `Modify ${fileLabel(text)}.`;
  if (tool === "write" || tool === "create") return `Create or overwrite ${fileLabel(text)}.`;
  if (tool === "read") return `Read ${fileLabel(text)}.`;
  if (tool === "glob" || tool === "grep" || tool === "search") {
    return "Search files or text on this computer.";
  }
  if (tool === "webfetch" || tool.includes("fetch")) {
    return `Download or read ${urlLabel(text)} from the internet.`;
  }
  if (tool === "websearch" || tool.includes("search")) return "Search the web for information.";
  if (tool.includes("computer") || tool.includes("cua")) {
    return "Control the bot's computer to perform the requested step.";
  }
  if (tool.startsWith("mcp__") || tool.includes("composio")) {
    return `Use the connected app tool “${humanize(rawTool)}” to do this.`;
  }
  return `Use the “${humanize(rawTool || "tool")}” tool to do this.`;
}

function riskFor(
  tool: string,
  text: string,
  commandLike: boolean,
): Omit<ApprovalExplanation, "summary"> {
  const lower = `${tool} ${text}`.toLowerCase();
  if (commandLike && destructiveCommand(lower)) {
    return {
      level: "high",
      risk:
        "This can permanently delete files, discard work, change system settings, or run with administrator rights. Check the exact command and target before allowing.",
    };
  }
  if (tool.startsWith("mcp__") || tool.includes("composio")) {
    return {
      level: "high",
      risk:
        "This can act in a connected app and change external data, send something, or spend money on your behalf. Review the tool and its arguments.",
    };
  }
  if (tool.includes("computer") || tool.includes("cua")) {
    return {
      level: "medium",
      risk:
        "This can click, type, and change the shared desktop, including signed-in websites. Watch the screen if you are unsure.",
    };
  }
  if (commandLike && externalCommand(lower)) {
    return {
      level: "medium",
      risk:
        "This can send data to another computer, change a remote service, or run downloaded code. Review the destination and payload before allowing.",
    };
  }
  if (
    commandLike &&
    /\b(mv|cp|mkdir|rmdir|touch|chmod|chown|truncate|tee)\b|\s>\s?[^\s]/.test(lower)
  ) {
    return {
      level: "medium",
      risk:
        "This can create, move, or change files on this computer. Check the exact paths before allowing.",
    };
  }
  if (tool === "edit" || tool === "multiedit" || tool === "write" || tool === "create") {
    return {
      level: "medium",
      risk: "This can change files on this computer. Review the path and content before allowing.",
    };
  }
  if (tool === "read" || tool === "glob" || tool === "grep" || tool === "search") {
    return {
      level: "low",
      risk: "This is a read-only action. The current permission mode still asks before allowing it.",
    };
  }
  if (tool === "webfetch" || tool === "websearch" || tool.includes("fetch") || tool.includes("search")) {
    return {
      level: "medium",
      risk: "This contacts the internet and may reveal which page you are reading. Review the URL or query.",
    };
  }
  if (commandLike && readOnlyCommand(lower)) {
    return {
      level: "low",
      risk: "This is a read-only action. The current permission mode still asks before allowing it.",
    };
  }
  return {
    level: "medium",
    risk:
      "This runs a tool that can change things on this computer. Review the request before allowing it.",
  };
}

function destructiveCommand(lower: string): boolean {
  return (
    /(^|[\s;&|])rm\s+/.test(lower) ||
    /(^|[\s;&|])sudo\b/.test(lower) ||
    /\bmkfs\b|\bdd\s+if=|\btruncate\b/.test(lower) ||
    /\bgit\s+reset\s+--hard\b|\bgit\s+push\b[^\n]*(--force|\s-f\b)/.test(lower) ||
    /\bgit\s+clean\s+-[a-z]*f/.test(lower) ||
    /\bchmod\s+-R\b|\bchown\s+-R\b/.test(lower) ||
    /\bsystemctl\s+(restart|stop|disable|mask)\b/.test(lower) ||
    /\bshutdown\b|\breboot\b|\bkill\s+-9\b|\bpkill\b|\bkillall\b/.test(lower) ||
    /\bdocker\s+(rm|system\s+prune)\b/.test(lower) ||
    /\biptables\b|\bdrop\s+(table|database)\b/.test(lower) ||
    /\b(curl|wget)\b[^\n|]*\|\s*(ba)?sh\b/.test(lower) ||
    /\b(wrangler|gh|heroku|flyctl|vercel)\s+(deploy|publish|release)\b/.test(lower) ||
    /\b(npm|pnpm|yarn|bun)\s+publish\b/.test(lower) ||
    /\b(apt|apt-get|dnf|yum|apk)\s+(install|remove|upgrade|dist-upgrade)\b/.test(lower)
  );
}

function readOnlyCommand(lower: string): boolean {
  return /(^|[\s;&|])(cat|head|tail|less|more|grep|rg|find|fd|ls|pwd|wc|stat|file|du|df|ps|whoami|id|date|git\s+(status|diff|log|show|branch|remote|rev-parse|ls-files))\b/.test(
    lower,
  );
}

function externalCommand(lower: string): boolean {
  return (
    /\b(curl|wget)\b/.test(lower) ||
    /\b(ssh|scp|rsync)\b/.test(lower) ||
    /\bgit\s+push\b/.test(lower) ||
    /\b(npm|pnpm|yarn|bun)\s+publish\b/.test(lower) ||
    /\b(wrangler|gh|heroku|flyctl)\s+(deploy|publish|release)\b/.test(lower) ||
    /\b(sendmail|mail|mailx)\b/.test(lower)
  );
}

function explainShell(command: string): string {
  const oneLine = command.split(/\r?\n/).find((line) => line.trim())?.trim() ?? command;
  const lower = oneLine.toLowerCase();
  if (/\brm\s+(-[^\s]+\s+)*-?rf?\b|\brm\s+-r\b/.test(lower)) {
    const target = oneLine.match(/\brm\s+(?:-[^\s]+\s+)*([^\s;&|]+)/i)?.[1];
    return `Permanently delete files or folders${target ? ` at “${target.slice(0, 100)}”` : ""}. This cannot be undone.`;
  }
  if (/^sudo\b/.test(lower)) return "Run a command with administrator privileges.";
  if (/\bgit\s+push\b/.test(lower)) return "Send local Git commits to a remote repository.";
  if (/\bgit\s+reset\s+--hard\b/.test(lower)) return "Discard local commits and working-tree changes.";
  if (/\bgit\s+(commit|merge|rebase|checkout|switch)\b/.test(lower)) {
    return "Change the local Git history or working tree.";
  }
  if (/\bgit\b/.test(lower)) return "Run a Git command in the project.";
  if (/\b(systemctl|service)\s+(restart|stop|start|disable|enable)\b/.test(lower)) {
    return "Start, stop, or restart a system service.";
  }
  if (/\b(apt|apt-get|dnf|yum|apk)\s+(install|remove|upgrade|dist-upgrade)\b/.test(lower)) {
    return "Install, remove, or upgrade system packages.";
  }
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
