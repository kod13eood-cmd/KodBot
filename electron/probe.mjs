/** Tell a KodBot harness apart from the phone companion.
 *
 * Both answer `GET /api/health` with `{"app":"kodbot"}` — the companion
 * proxies that route without a device token, which is useful for reachability
 * checks but makes health alone a bad identity test. Pointing the desktop app
 * at the companion's port (8810) therefore "worked" and then every real API
 * call came back 401, leaving a blank window.
 *
 * The harness's own `/api/bots` is the discriminator: the companion refuses it
 * without a paired device token.
 */

const isKodbotApp = (value) => {
  const app = value?.app;
  return app === "kodbot" || app === "opencrew";
};

/** @returns {Promise<
 *   | { ok: true; kind: "harness" | "gateway" }
 *   | { ok: false; reason: "unreachable" | "not-kodbot" | "companion" }
 * >} */
export async function probeHarness(url, options = {}) {
  const request = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4_000;
  const signal = () => AbortSignal.timeout(timeoutMs);

  let health;
  try {
    health = await request(`${url}/api/health`, { signal: signal() });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!health.ok) return { ok: false, reason: "unreachable" };
  const identity = await health.json().catch(() => null);
  if (identity?.app === "kodbot-gateway") {
    // A gateway is a valid remote entry point: its health is public, the app
    // itself sits behind a login page. Point the window at it and let the
    // normal cookie session carry the user through.
    let login;
    let me;
    try {
      [login, me] = await Promise.all([
        request(`${url}/login`, { signal: signal() }),
        request(`${url}/api/auth/me`, { signal: signal() }),
      ]);
    } catch {
      return { ok: false, reason: "unreachable" };
    }
    if (!login.ok) return { ok: false, reason: "not-kodbot" };
    if (me.status !== 200 && me.status !== 401) return { ok: false, reason: "not-kodbot" };
    return { ok: true, kind: "gateway" };
  }
  if (!isKodbotApp(identity)) return { ok: false, reason: "not-kodbot" };

  let api;
  try {
    api = await request(`${url}/api/bots?messages=0`, { signal: signal() });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  // The companion proxies health, then demands a paired device token for
  // everything else. That 401 is the signature of the wrong port.
  if (api.status === 401 || api.status === 403) return { ok: false, reason: "companion" };
  if (!api.ok) return { ok: false, reason: "not-kodbot" };
  const body = await api.json().catch(() => null);
  if (!Array.isArray(body?.bots)) return { ok: false, reason: "not-kodbot" };
  return { ok: true, kind: "harness" };
}

/** The sentence the settings panel shows for a failed probe. */
export function probeErrorMessage(url, probe) {
  if (probe.ok) return "";
  if (probe.reason === "companion") {
    return `${url} is the phone companion, not the KodBot server. Use the harness port (usually 8799).`;
  }
  if (probe.reason === "unreachable") return `Could not reach ${url}.`;
  return `No KodBot server answered at ${url}.`;
}
