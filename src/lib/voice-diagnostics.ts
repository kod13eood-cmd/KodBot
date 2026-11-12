// Voice capture is only available in a secure context (HTTPS or localhost)
// and only when the browser exposes MediaRecorder + getUserMedia. Keeping the
// decision here means the composer and the settings test explain the same
// reason instead of one hiding the button and the other failing silently.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type MicrophoneIssue = "insecure" | "unsupported" | null;

export function microphoneIssue(input: {
  secureContext: boolean;
  hostname: string;
  hasMediaDevices: boolean;
  hasMediaRecorder: boolean;
}): MicrophoneIssue {
  if (!input.secureContext && !LOCAL_HOSTS.has(input.hostname)) return "insecure";
  if (!input.hasMediaDevices || !input.hasMediaRecorder) return "unsupported";
  return null;
}

/** The HTTPS address a person can open when they are on a plain-HTTP origin.
 * The live server serves HTTP on 8799 and HTTPS on 443, so a port that only
 * belonged to the HTTP listener must not be carried over. */
export function httpsVoiceUrl(protocol: string, hostname: string, port: string): string {
  const keepPort = protocol === "https:" && port && port !== "443";
  return `https://${hostname}${keepPort ? `:${port}` : ""}`;
}
