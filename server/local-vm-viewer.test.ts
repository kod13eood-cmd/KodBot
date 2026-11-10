import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import {
  isViewerPath,
  proxyViewerRequest,
  viewerPath,
  VIEWER_RECORDER_PATH,
  VIEWER_RECORDER_SCRIPT,
} from "./local-vm-viewer.ts";

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

  it("injects the RFB recorder before noVNC's module script", async () => {
    const target = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end('<html><head><script type="module" src="app/ui.js"></script></head><body></body></html>');
    });
    const targetPort = await listen(target);
    const proxy = createServer((req, res) => {
      if (!proxyViewerRequest(req, res, targetPort)) {
        res.writeHead(404);
        res.end();
      }
    });
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/api/local-computer/viewer/vnc.html`);
    const html = await response.text();
    expect(html.indexOf(VIEWER_RECORDER_PATH)).toBeGreaterThan(-1);
    expect(html.indexOf(VIEWER_RECORDER_PATH)).toBeLessThan(html.indexOf("app/ui.js"));
    expect(VIEWER_RECORDER_SCRIPT).toContain("recordings/event");
    expect(VIEWER_RECORDER_SCRIPT).toContain("function RecorderWebSocket");
  });

  it("records the RFB pointer and key messages noVNC sends", () => {
    const events: Array<Record<string, unknown>> = [];
    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      sent: unknown[] = [];
      constructor(_url: string, _protocols?: string[]) {}
      send(data: unknown) {
        this.sent.push(data);
      }
    }
    const window = { WebSocket: FakeWebSocket } as {
      WebSocket: typeof FakeWebSocket;
      __kodbotRecorderInstalled?: boolean;
    };
    const fakeFetch = (_url: string, init: { body: string }) => {
      events.push(JSON.parse(init.body) as Record<string, unknown>);
      return Promise.resolve({ ok: true });
    };
    new Function("window", "fetch", VIEWER_RECORDER_SCRIPT)(window, fakeFetch);
    const socket = new window.WebSocket("ws://viewer/websockify");
    socket.send(new Uint8Array([4, 1, 0, 0, 0, 0, 0, 75]).buffer);
    socket.send(new Uint8Array([5, 1, 2, 128, 1, 144]).buffer);
    // QEMU extended key event (type 255): what a real noVNC connection sends
    // when the VNC server advertises the extended-key-event pseudo-encoding.
    socket.send(new Uint8Array([255, 0, 0, 1, 0, 0, 0, 75, 0, 0, 0, 30]).buffer);
    socket.send(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 75, 0, 0, 0, 30]).buffer);

    expect(events[0]).toMatchObject({ type: "key", down: true, keysym: 75, key: "K" });
    expect(events[1]).toMatchObject({ type: "pointer", x: 640, y: 400, button: 1 });
    expect(events[2]).toMatchObject({ type: "key", down: true, keysym: 75, key: "K" });
    expect(events[3]).toMatchObject({ type: "key", down: false, keysym: 75, key: "K" });
    expect(socket.sent).toHaveLength(4);
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
