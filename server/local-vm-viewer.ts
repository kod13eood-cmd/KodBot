// Reverse proxy for the Local VM's noVNC viewer. The viewer itself is a
// loopback-only HTTP server inside the container host; this lets the desktop
// UI and a paired phone open it through the harness origin without publishing
// port 6080 to the network. It forwards only the fixed local target.

import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";

export const VIEWER_PREFIX = "/api/local-computer/viewer";
export const VIEWER_RECORDER_PATH = `${VIEWER_PREFIX}/recorder.js`;

/** Injected before noVNC's module script. RFB input messages are exact:
 * type 4 is KeyEvent, type 5 is PointerEvent. The parent page cannot observe
 * them after the WebSocket is created, so the wrapper has to exist first. */
export const VIEWER_RECORDER_SCRIPT = `(() => {
  const Native = window.WebSocket;
  if (!Native || window.__kodbotRecorderInstalled) return;
  window.__kodbotRecorderInstalled = true;
  const names = {
    0xff0d: "Enter", 0xff1b: "Escape", 0xff08: "Backspace", 0xff09: "Tab",
    0xff51: "ArrowLeft", 0xff52: "ArrowUp", 0xff53: "ArrowRight", 0xff54: "ArrowDown",
    0xffe1: "Shift", 0xffe2: "Shift", 0xffe3: "Control", 0xffe4: "Control",
    0xffe9: "Alt", 0xffea: "Alt", 0xffeb: "Meta", 0xffec: "Meta"
  };
  const post = (event) => {
    try {
      void fetch("/api/local-computer/recordings/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true
      }).catch(() => {});
    } catch {}
  };
  let lastMask = 0;
  function RecorderWebSocket(url, protocols) {
    const socket = new Native(url, protocols);
    const send = socket.send.bind(socket);
    socket.send = (data) => {
      try {
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : null;
        if (bytes && bytes[0] === 4 && bytes.length >= 8) {
          const keysym = ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) >>> 0;
          const key = keysym >= 0x20 && keysym <= 0x7e ? String.fromCharCode(keysym) : names[keysym];
          post({ type: "key", down: bytes[1] === 1, keysym, ...(key ? { key } : {}), at: Date.now() });
        } else if (bytes && bytes[0] === 5 && bytes.length >= 6) {
          const button = bytes[1];
          if (button !== lastMask) {
            post({ type: "pointer", x: (bytes[2] << 8) | bytes[3], y: (bytes[4] << 8) | bytes[5], button, at: Date.now() });
            lastMask = button;
          }
        }
      } catch {}
      return send(data);
    };
    return socket;
  }
  RecorderWebSocket.prototype = Native.prototype;
  Object.setPrototypeOf(RecorderWebSocket, Native);
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    Object.defineProperty(RecorderWebSocket, key, { value: Native[key] });
  }
  window.WebSocket = RecorderWebSocket;
})();`;
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
      const htmlPath = viewerPath(req.url ?? "/").split("?")[0];
      if (
        (htmlPath === "/vnc.html" || htmlPath === "/vnc_lite.html") &&
        !response.headers["content-encoding"]
      ) {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          let html = Buffer.concat(chunks).toString("utf8");
          if (!html.includes("recorder.js")) {
            const tag = `<script src="${VIEWER_RECORDER_PATH}"></script>`;
            const module = /<script[^>]*src="app\/ui\.js"[^>]*><\/script>/;
            html = module.test(html) ? html.replace(module, `${tag}$&`) : html.replace("</head>", `${tag}</head>`);
          }
          const bytes = Buffer.from(html);
          headers["content-length"] = String(bytes.length);
          res.writeHead(response.statusCode ?? 502, headers);
          res.end(bytes);
        });
        return;
      }
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
