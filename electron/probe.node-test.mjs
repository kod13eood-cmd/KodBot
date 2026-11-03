import assert from "node:assert/strict";
import { test } from "node:test";

import { probeErrorMessage, probeHarness } from "./probe.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeFetch(routes) {
  return async (url) => {
    for (const [suffix, response] of Object.entries(routes)) {
      if (url.endsWith(suffix)) {
        if (response instanceof Error) throw response;
        return response;
      }
    }
    throw new Error(`unexpected url ${url}`);
  };
}

const harnessRoutes = {
  "/api/health": () => json({ app: "kodbot", static: true }),
  "/api/bots?messages=0": () => json({ bots: [] }),
};

test("accepts a real harness", async () => {
  const routes = {
    "/api/health": harnessRoutes["/api/health"](),
    "/api/bots?messages=0": harnessRoutes["/api/bots?messages=0"](),
  };
  assert.deepEqual(await probeHarness("http://host:8799", { fetchImpl: fakeFetch(routes) }), { ok: true });
});

test("rejects the companion, which proxies health but not the API", async () => {
  const routes = {
    "/api/health": json({ app: "kodbot", static: true }),
    "/api/bots?messages=0": json({ error: "pair this device" }, 401),
  };
  const probe = await probeHarness("http://host:8810", { fetchImpl: fakeFetch(routes) });
  assert.deepEqual(probe, { ok: false, reason: "companion" });
  assert.match(probeErrorMessage("http://host:8810", probe), /phone companion.*8799/);
});

test("rejects something else on the port", async () => {
  const probe = await probeHarness(
    "http://host:9000",
    { fetchImpl: fakeFetch({ "/api/health": json({ app: "not-kodbot" }) }) },
  );
  assert.deepEqual(probe, { ok: false, reason: "not-kodbot" });
});

test("reports an unreachable address instead of a wrong identity", async () => {
  const probe = await probeHarness(
    "http://host:9999",
    { fetchImpl: fakeFetch({ "/api/health": new Error("ECONNREFUSED") }) },
  );
  assert.deepEqual(probe, { ok: false, reason: "unreachable" });
  assert.match(probeErrorMessage("http://host:9999", probe), /Could not reach/);
});

test("does not trust a 200 that is not the harness API", async () => {
  const routes = {
    "/api/health": json({ app: "kodbot", static: true }),
    "/api/bots?messages=0": new Response("<html>hello</html>", { status: 200 }),
  };
  assert.deepEqual(await probeHarness("http://host:8080", { fetchImpl: fakeFetch(routes) }), {
    ok: false,
    reason: "not-kodbot",
  });
});
