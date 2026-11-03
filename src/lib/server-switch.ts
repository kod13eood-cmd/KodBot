/** Whether "Connect to remote server" can do anything right now.
 *
 * The main process owns the real connection state; this only decides if the
 * button is worth pressing. The bug worth guarding against: while the window
 * is already on a healthy remote server, the button used to stay disabled no
 * matter what address the user typed — so there was no way to move from one
 * server to another.
 */

/** The address as the main process will store it: trimmed, no trailing
 * slash. Raw-string comparison would treat "http://host:8799/" and
 * "http://host:8799" as different servers. */
export function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export interface ServerConnectionView {
  mode?: "local" | "remote";
  url?: string;
  active?: "local" | "remote";
  /** saved remote address did not answer; the window fell back to local */
  fallback?: boolean;
}

export function remoteSwitchAvailable(input: string, connection: ServerConnectionView | null): boolean {
  const target = normalizeServerUrl(input);
  if (!target) return false;
  if (connection?.mode !== "remote" || connection.fallback) return true;
  return target !== normalizeServerUrl(connection.url ?? "");
}
