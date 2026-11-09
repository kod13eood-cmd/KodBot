import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { isViewerPath, proxyViewerRequest, viewerPath } from "./local-vm-viewer.ts";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

function listen(server: Server): Promise<number> {
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

describe("Local VM viewer paths", () => {
  it("owns only the viewer prefix", () => {
    expect(isViewerPath("/api/local-computer/viewer")).toBe(true);
    expect(isViewerPath("/api/local-computer/viewer/vnc.html")).toBe(true);
    expect(isViewerPath("/api/local-computer/viewers")).toBe(false);
    expect(isViewerPath("/api/local-computer")).toBe(false);
  });

  it("strips the harness prefix and keeps the upstream path and query", () => {
    expect(viewerPath("/api/local-computer/viewer/vnc.html#x")).toBe("/vnc.html#x");
    expect(viewerPath("/api/local-computer/viewer/app/ui.js?x=1")).toBe("/app/ui.js?x=1");
    expect(viewerPath("/api/local-computer/viewer")).toBe("/");
  });
});

describe("Local VM viewer proxy", () => {
  it("forwards assets to the fixed noVNC server with the prefix removed", async () => {
    const target = createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`${req.method} ${req.url}`);
    });
    const targetPort = await listen(target);
    const proxy = createServer((req, res) => {
      if (!proxyViewerRequest(req, res, targetPort)) {
        res.writeHead(404);
        res.end("not a viewer request");
      }
    });
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/api/local-computer/viewer/app/ui.js?x=1`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("GET /app/ui.js?x=1");
  });

  it("reports an unreachable viewer as 502 instead of crashing the harness", async () => {
    const proxy = createServer((req, res) => {
      if (!proxyViewerRequest(req, res, 1)) {
        res.writeHead(404);
        res.end();
      }
    });
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/api/local-computer/viewer/vnc.html`);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "the Local VM viewer is not reachable" });
  });
});
