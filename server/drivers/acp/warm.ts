/** How long an ACP process stays up after a turn so the next message can
 * prompt the same session instead of spawning and loading again. */
export const ACP_WARM_MS = 10 * 60 * 1000;
/** The most parked processes one driver instance keeps; a busy fleet should
 * not turn a latency win into an unbounded memory bill. */
export const ACP_WARM_MAX = 4;

export interface WarmFingerprint {
  cwd: string;
  model: string;
  mcp: string;
  /** CLI and permission policy: a reload must not reuse the old process. */
  config: string;
}

type McpServer = {
  name: string;
  command: string;
  args: string[];
  env?: Array<{ name: string; value: string }>;
};

/** Identity of a parked process. A mismatch (folder, model, mounted tools or
 * their environment) means the next turn must start a fresh process. Env is
 * part of the identity because Composio/session tokens rotate. */
export function warmFingerprint(
  cwd: string,
  model: string | undefined,
  mcpServers: McpServer[],
  config = "",
): WarmFingerprint {
  return {
    cwd,
    model: model ?? "",
    mcp: mcpServers
      .map((server) => {
        const env = [...(server.env ?? [])]
          .map((entry) => `${entry.name}=${entry.value}`)
          .sort()
          .join("\u0001");
        return `${server.name}\u0000${server.command}\u0000${server.args.join("\u0000")}\u0000${env}`;
      })
      .join("\n"),
    config,
  };
}

export function sameWarmSession(a: WarmFingerprint, b: WarmFingerprint): boolean {
  return a.cwd === b.cwd && a.model === b.model && a.mcp === b.mcp && a.config === b.config;
}
