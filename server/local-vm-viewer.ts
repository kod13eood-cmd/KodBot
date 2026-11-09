// Reverse proxy for the Local VM's noVNC viewer. The viewer itself is a
// loopback-only HTTP server inside the container host; this lets the desktop
// UI and a paired phone open it through the harness origin without publishing
// port 6080 to the network. It forwards only the fixed local target.

import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";

export const VIEWER_PREFIX = "/api/local-computer/viewer";
export const VIEWER_HOST = "127.0.0.1";
export const VIEWER_PORT = 6080;

export function isViewerPath(path: string): boolean {
  return path === VIEWER_PREFIX || path.startsWith(`${VIEWER_PREFIX}/`);
}

/** Strip only the harness prefix. noVNC uses relative asset paths, so every
 * request under the prefix maps directly onto its own server root. */
export function viewerPath(path: string): string {
  const rest = path.slice(VIEWER_PREFIX.length);
  if (!rest) return "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

function targetHeaders(req: IncomingMessage, port: number): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || key === "host") continue;
    headers[key] = value;
  }
  headers.host = `${VIEWER_HOST}:${port}`;
  return headers;
}

/** Proxy one HTTP request to the fixed noVNC viewer. Returns false for a
 * path outside the viewer prefix so the caller can keep routing. */
export function proxyViewerRequest(
  req: IncomingMessage,
  res: ServerResponse,
  port = VIEWER_PORT,
): boolean {
  if (!isViewerPath(req.url ?? "")) return false;
  const upstream = httpRequest(
    {
      host: VIEWER_HOST,
      port,
      method: req.method,
      path: viewerPath(req.url ?? "/"),
      headers: targetHeaders(req, port),
    },
    (response) => {
      const headers = { ...response.headers };
      // Let Node frame the response after we pipe it.
      delete headers.connection;
      delete headers["keep-alive"];
      delete headers["transfer-encoding"];
      res.writeHead(response.statusCode ?? 502, headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "the Local VM viewer is not reachable" }));
  });
  req.pipe(upstream);
  return true;
}

/** Upgrade a WebSocket to the fixed noVNC viewer. noVNC defaults to the
 * relative `websockify` path, which is what the iframe requests. */
export function proxyViewerUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  port = VIEWER_PORT,
): boolean {
  if (!isViewerPath(req.url ?? "")) return false;

  const upstream = connect(port, VIEWER_HOST, () => {
    const lines = [`GET ${viewerPath(req.url ?? "/")} HTTP/1.1`];
    for (const [key, value] of Object.entries(targetHeaders(req, port))) {
      if (Array.isArray(value)) {
        for (const entry of value) lines.push(`${key}: ${entry}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  upstream.on("close", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
  return true;
}
