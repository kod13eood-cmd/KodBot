import { app, BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, Menu, MenuItem, nativeImage, Notification, safeStorage, session, shell, systemPreferences, Tray, utilityProcess } from "electron";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startCua, stopCua, registerCuaIpc } from "./cua.mjs";
import { finishSpeech, startSpeech, stopSpeech } from "./speech.mjs";
import { openBlankTerminal } from "./terminal-launch.mjs";
import { startUpdater, registerUpdaterIpc } from "./updater.mjs";
import { relaunchCommand } from "./relaunch.mjs";
import { probeErrorMessage, probeHarness } from "./probe.mjs";
import capabilitiesModule from "./capabilities.cjs";

const { desktopCapabilities } = capabilitiesModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 127.0.0.1 explicitly — vite binds IPv4; a bare "localhost" here can
// resolve to ::1 and paint a black window
const DEV_URL = process.env.ELECTRON_START_URL ?? "http://127.0.0.1:5199";
const DEFAULT_COMPOSIO_BROKER_URL = "https://openmausbot-composio.milindsoni201.workers.dev";
let SERVER_PORT = 8799;
const APP_ICON = path.join(__dirname, "resources/app-icon.png");

// GNOME groups the window with its installed desktop entry only when both
// identities match. This must run before Electron becomes ready.
if (process.platform === "linux") app.setDesktopName("com.kodbot.app.desktop");

// Display name for menus and the per-app data dir.
app.setName("KodBot");

// Migrate Electron's per-app data dir from the pre-rename names so existing
// installs keep their window state and the secure credential store.
try {
  const currentUserData = app.getPath("userData");
  const parent = path.dirname(currentUserData);
  for (const legacyName of ["opencrew", "OpenCrew", "openmausbot"]) {
    const legacyUserData = path.join(parent, legacyName);
    if (!fs.existsSync(currentUserData) && fs.existsSync(legacyUserData)) {
      fs.renameSync(legacyUserData, currentUserData);
      break;
    }
  }
} catch {
  /* best-effort: a failed migration just means a fresh per-app dir */
}

// ── local vs remote harness ────────────────────────────────────────────
// The desktop window is a client. By default it owns a local harness, but a
// user who keeps a machine on 24/7 can point the window at that harness
// instead. The setting lives in the desktop user-data dir, not in the remote
// server, because it is a property of this window.
const SERVER_CONNECTION_FILE = path.join(app.getPath("userData"), "server-connection.json");
const HEADLESS = process.argv.includes("--headless") || process.env.OC_HEADLESS === "1";

// A remote harness is commonly reached over plain HTTP on a LAN/Tailscale.
// Chromium hides getUserMedia in an insecure context, which would silently
// remove the microphone button. Treat only the exact user-configured KodBot
// origin as secure; no other HTTP origin gets the exception.
const initialConnection = readServerConnection();
if (!HEADLESS && initialConnection.mode === "remote" && initialConnection.url.startsWith("http://")) {
  app.commandLine.appendSwitch("unsafely-treat-insecure-origin-as-secure", initialConnection.url);
}

function normalizeRemoteUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) throw new Error("Enter the remote server address.");
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Enter an address like http://192.168.1.50:8799.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https addresses are supported.");
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("Use only the server address and optional port.");
  }
  if (!url.hostname) throw new Error("The server address needs a host.");
  url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

function readServerConnection() {
  try {
    const raw = JSON.parse(fs.readFileSync(SERVER_CONNECTION_FILE, "utf8"));
    if (raw?.mode === "remote") {
      return { mode: "remote", url: normalizeRemoteUrl(raw.url) };
    }
  } catch {
    /* missing or malformed: local is the safe default */
  }
  return { mode: "local" };
}

/** True when the user or an earlier launch saved a valid local/remote choice.
 * First-run setup uses this so a fresh install gets the wizard once, while an
 * existing install is not asked again after it updates. */
function serverConnectionChoiceSaved() {
  try {
    const raw = JSON.parse(fs.readFileSync(SERVER_CONNECTION_FILE, "utf8"));
    return raw?.mode === "local" || raw?.mode === "remote";
  } catch {
    return false;
  }
}

function writeServerConnection(connection) {
  fs.mkdirSync(path.dirname(SERVER_CONNECTION_FILE), { recursive: true });
  const temporary = `${SERVER_CONNECTION_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(connection, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, SERVER_CONNECTION_FILE);
}

/** Restart the app after a connection change.
 *
 * On Linux the AppImage may run in extract-and-run mode (FUSE unavailable),
 * where process.execPath points into a temp directory the AppImage runtime
 * deletes on exit. Electron's own relaunch would race that cleanup; start the
 * real AppImage (KODBOT_APPIMAGE) on a short delay instead. */
function relaunchApp() {
  const command = relaunchCommand({ platform: process.platform, appImage: process.env.KODBOT_APPIMAGE });
  if (!command) {
    app.relaunch();
    app.exit(0);
    return;
  }
  // Detached and stdio-free so the child outlives this process; the env is
  // inherited so the AppImage keeps APPIMAGE_EXTRACT_AND_RUN and the session.
  spawn(command.command, command.args, { detached: true, stdio: "ignore", env: process.env }).unref();
  app.exit(0);
}

let remoteConnection = { mode: "local" };
let remoteMode = false;

// Packaged: the harness server ships in Resources (compiled JS, zero deps)
// and runs on Electron's own Node via utilityProcess. It serves the built
// UI too, so the window talks to one origin and there is no dev proxy.
// A stray server on the default port must not brick the app — fall back to
// alternate ports until one binds AND identifies as ours (the probe checks
// our API shape, not just a 200).
let serverProc = null;
let serverReady = true;
let secureCredentials = {};

const CREDENTIALS_FILE = path.join(app.getPath("userData"), "credentials.bin");

async function loadSecureCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE) || !(await safeStorage.isAsyncEncryptionAvailable())) return {};
    const decrypted = await safeStorage.decryptStringAsync(fs.readFileSync(CREDENTIALS_FILE));
    return JSON.parse(decrypted.result);
  } catch (error) {
    slog(`credential load failed: ${error?.message ?? error}`);
    return {};
  }
}

async function saveSecureCredentials(credentials) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("The operating-system credential store is unavailable");
  }
  fs.mkdirSync(path.dirname(CREDENTIALS_FILE), { recursive: true });
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(credentials));
  const temporary = `${CREDENTIALS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
  fs.renameSync(temporary, CREDENTIALS_FILE);
}

async function secureComposioConfig() {
  const dataDir = process.env.OC_DATA_DIR || path.join(app.getPath("home"), ".kodbot");
  const configPath = path.join(dataDir, "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config?.composio || typeof config.composio !== "object") return;
    let changed = false;
    const apiKey = config?.composio?.apiKey;
    if (typeof apiKey === "string" && apiKey.trim().startsWith("ak_")) {
      if (!secureCredentials.composioApiKey) {
        secureCredentials.composioApiKey = apiKey.trim();
        await saveSecureCredentials(secureCredentials);
      }
      config.composio.apiKey = "";
      changed = true;
    } else if (typeof apiKey === "string" && apiKey.trim()) {
      config.composio.apiKey = "";
      changed = true;
    }
    // These were the old Connect credential and endpoint. They are no longer
    // read; remove them during the upgrade so an unused secret is not left in
    // plaintext indefinitely.
    for (const field of ["key", "url"]) {
      if (Object.hasOwn(config.composio, field)) {
        delete config.composio[field];
        changed = true;
      }
    }
    if (!changed) return;
    const temporary = `${configPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, configPath);
  } catch (error) {
    if (error?.code !== "ENOENT") slog(`credential migration failed: ${error?.message ?? error}`);
  }
}

function composioBrokerUrl() {
  const configured = process.env.OC_COMPOSIO_BROKER_URL?.trim();
  return configured || (app.isPackaged ? DEFAULT_COMPOSIO_BROKER_URL : "");
}

async function ensureManagedComposioCredentials() {
  const brokerUrl = composioBrokerUrl();
  if (!brokerUrl) return;
  if (/^[0-9a-f]{64}$/.test(secureCredentials.composioBrokerToken ?? "")) {
    try {
      const check = await fetch(`${brokerUrl}/v1/me`, {
        headers: { authorization: `Bearer ${secureCredentials.composioBrokerToken}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (check.ok) return;
      // Only a definitive auth failure rotates the credential. A transient
      // outage keeps the existing identity so reconnecting cannot strand
      // the user's already-authorized accounts under a new installation.
      if (check.status !== 401) return;
      delete secureCredentials.composioBrokerToken;
      delete secureCredentials.composioInstallationId;
    } catch {
      return;
    }
  }
  try {
    const response = await fetch(`${brokerUrl}/v1/installations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
    if (!/^[0-9a-f]{64}$/.test(body?.token ?? "") || typeof body?.installationId !== "string") {
      throw new Error("the connected-apps service returned invalid credentials");
    }
    secureCredentials.composioBrokerToken = body.token;
    secureCredentials.composioInstallationId = body.installationId;
    await saveSecureCredentials(secureCredentials);
    slog("connected-apps installation registered");
  } catch (error) {
    // Never block app startup on a hosted integration. A user running their
    // own Composio project key still has the local fallback below.
    slog(`connected-apps registration failed: ${error?.message ?? error}`);
  }
}

// The packaged app has no terminal: everything about the server child's life
// goes to server.log in the OS log dir (~/Library/Logs/KodBot on macOS,
// Console.app-visible; %APPDATA%\KodBot\logs on Windows), which is also
// why stdio is piped, not inherited — under a Finder/Explorer launch the
// parent's stdio leads nowhere and a failed boot is otherwise undiagnosable.
const LOG_DIR = app.getPath("logs");
let logStream = null;
import {
  companionEnabledAtRest,
  companionPairing,
  companionCloudDesktopAccess,
  companionRevoke,
  companionState,
  rememberCompanionEnabled,
  startCompanion,
  stopCompanion,
} from "./companion.mjs";

function slog(line) {
  try {
    if (!logStream) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      logStream = fs.createWriteStream(path.join(LOG_DIR, "server.log"), { flags: "a" });
    }
    logStream.write(`[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* logging must never break startup */
  }
}

async function startServerOn(port) {
  const entry = path.join(process.resourcesPath, "server", "index.js");
  slog(`fork ${entry} port=${port}`);
  const proc = utilityProcess.fork(entry, [], {
    env: {
      ...process.env,
      OC_STATIC_DIR: path.join(process.resourcesPath, "ui"),
      OC_PORT: String(port),
      OC_USER_DATA: app.getPath("userData"),
      ...(secureCredentials.composioApiKey
        ? { COMPOSIO_API_KEY: secureCredentials.composioApiKey }
        : {}),
      ...(composioBrokerUrl() && secureCredentials.composioBrokerToken
        ? {
            OC_COMPOSIO_BROKER_URL: composioBrokerUrl(),
            OC_COMPOSIO_BROKER_TOKEN: secureCredentials.composioBrokerToken,
          }
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.on("data", (d) => slog(`[out] ${String(d).trimEnd()}`));
  proc.stderr?.on("data", (d) => slog(`[err] ${String(d).trimEnd()}`));
  proc.once("spawn", () => slog(`spawned pid=${proc.pid}`));
  let exited = false;
  proc.once("exit", (code) => {
    exited = true;
    slog(`exited code=${code}`);
  });
  // wait for the port to answer (fresh machine: first boot writes data dirs).
  // Identity check is by PID: a dev harness server has the same API shape,
  // so only the child we actually forked (matching pid + static serving)
  // counts as ours.
  for (let i = 0; i < 40; i++) {
    if (exited) return null;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.app === "kodbot" && body.pid === proc.pid && body.static) return proc;
        break; // someone else owns this port — try the next one
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    proc.kill();
  } catch {}
  return null;
}

async function startServerPackaged() {
  // two passes: a quit-and-reopen relaunch can race the dying instance's
  // server during teardown — one settle-and-retry covers it
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const port of [8799, 18799, 28799]) {
      const proc = await startServerOn(port);
      if (proc) {
        serverProc = proc;
        SERVER_PORT = port;
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

const ERROR_PAGE =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#070707;color:#fcfcfc;font:15px -apple-system,system-ui"><div style="text-align:center;max-width:360px"><div style="font-size:40px">🐭</div><h2 style="font-weight:600;margin:12px 0 6px">Couldn't start the bot server</h2><p style="color:#fcfcfc99;line-height:1.5">Something else is using its ports. Quit and reopen KodBot — if it keeps happening, restart your computer.</p></div></body>`,
  );

let cuaReady = Promise.resolve({ mode: "unavailable", reason: "not-started" });

/** The same Chromium right-click surface OpenCode uses: spellcheck
 * corrections in editable fields, standard edit actions, and Copy/Select All
 * for a selection in a bot answer. */
function installContextMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    const menu = new Menu();
    const editable = params.isEditable;
    const selection = params.selectionText.trim();

    if (editable && params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 6);
      if (suggestions.length) {
        for (const suggestion of suggestions) {
          menu.append(
            new MenuItem({
              label: suggestion,
              click: () => win.webContents.replaceMisspelling(suggestion),
            }),
          );
        }
      } else {
        menu.append(new MenuItem({ label: "No spelling suggestions", enabled: false }));
      }
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: `Add “${params.misspelledWord}” to dictionary`,
          click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        }),
      );
      menu.append(new MenuItem({ type: "separator" }));
    }

    if (editable) {
      menu.append(new MenuItem({ role: "undo", enabled: params.editFlags.canUndo }));
      menu.append(new MenuItem({ role: "redo", enabled: params.editFlags.canRedo }));
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(new MenuItem({ role: "cut", enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ role: "copy", enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ role: "paste", enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ role: "selectAll" }));
    } else if (selection) {
      menu.append(new MenuItem({ role: "copy" }));
      menu.append(new MenuItem({ role: "selectAll" }));
    } else {
      menu.append(new MenuItem({ role: "selectAll" }));
    }

    if (params.linkURL) {
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: "Copy Link",
          click: () => clipboard.writeText(params.linkURL),
        }),
      );
      menu.append(
        new MenuItem({
          label: "Open Link",
          click: () => void shell.openExternal(params.linkURL),
        }),
      );
    }

    if (!app.isPackaged) {
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: "Inspect Element",
          click: () => win.webContents.inspectElement(params.x, params.y),
        }),
      );
    }

    menu.popup({ window: win });
  });
}

// ── system tray ────────────────────────────────────────────────────────
// Linux shows this through StatusNotifier/AppIndicator (the Ubuntu GNOME
// extension is enabled), Windows in the notification area, macOS in the menu
// bar. One icon for the app, not one per bot: the window already lists them.
let tray = null;

function createTray() {
  if (tray) return tray;
  const icon = nativeImage.createFromPath(APP_ICON);
  const size = process.platform === "darwin" ? 18 : 22;
  tray = new Tray(icon.isEmpty() ? APP_ICON : icon.resize({ width: size, height: size }));
  tray.setToolTip(`KodBot ${app.getVersion()}`);

  const showWindow = () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      createWindow(remoteMode ? remoteConnection.url : null);
      return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open KodBot", click: showWindow },
      { type: "separator" },
      { label: "Quit KodBot", click: () => app.quit() },
    ]),
  );
  // Windows and some Linux desktops deliver a plain click; AppIndicator
  // opens the context menu instead, so both paths lead to the same window.
  tray.on("click", showWindow);
  return tray;
}

function createWindow(remoteUrl = null) {
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    icon: APP_ICON,
    backgroundColor: "#070707",
    autoHideMenuBar: process.platform !== "darwin",
    // macOS keeps inset traffic lights, Windows keeps its custom overlay, and
    // Linux is frameless: the window controls are drawn by the app at the
    // top-right (components/WindowControls) instead of a system title bar.
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 16 } }
      : process.platform === "win32"
        ? {
            titleBarStyle: "hidden",
            // height MUST match the ChatView/GroupView header strip (px-5 py-3
            // around a 36px control row = 60). Windows draws the caption buttons
            // to fill the overlay, so anything shorter leaves a dead band under
            // them and anything taller overhangs the header.
            titleBarOverlay: { color: "#070707", symbolColor: "#b5b5b5", height: 60 },
          }
        : isLinux
          ? { frame: false }
          : {}),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      spellcheck: true,
    },
  });

  installContextMenu(win);

  // The application menu is gone on Linux and Windows, which also removed
  // its built-in accelerators. Keep the three people actually use: reload,
  // force reload, and the devtools toggle.
  if (process.platform !== "darwin") {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
      const key = input.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        if (input.shift) win.webContents.reloadIgnoringCache();
        else win.webContents.reload();
      } else if (key === "i" && input.shift) {
        event.preventDefault();
        win.webContents.toggleDevTools();
      }
    });
  }

  // The frameless Linux window draws its own controls; the renderer needs to
  // know when a maximize turns into a restore.
  win.on("maximize", () => win.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win.webContents.send("window:maximized", false));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Packaged CI smoke hook. It validates the real renderer/preload bridge and
  // same-origin embedded server, then follows the normal window-close path.
  // No debugging port or sandbox override is needed.
  if (process.env.OC_SMOKE_TEST === "1") {
    win.webContents.once("did-finish-load", async () => {
      try {
        const result = await win.webContents.executeJavaScript(`
          (async () => {
            if (!window.ogb?.getCapabilities) throw new Error("desktop preload bridge is unavailable");
            const [capabilities, healthResponse] = await Promise.all([
              window.ogb.getCapabilities(),
              fetch("/api/health"),
            ]);
            if (!healthResponse.ok) {
              throw new Error(\`health request failed: \${healthResponse.status} \${healthResponse.statusText}\`);
            }
            const health = await healthResponse.json();
            return { capabilities, health, location: window.location.href, title: document.title };
          })()
        `);
        const expectedLocation = `http://127.0.0.1:${SERVER_PORT}/`;
        if (result.location !== expectedLocation) {
          throw new Error(
            `unexpected packaged renderer URL: ${result.location} (expected ${expectedLocation})`,
          );
        }
        console.log(`[smoke] renderer-ready ${JSON.stringify(result)}`);
      } catch (error) {
        console.error(`[smoke] renderer-failed ${error?.stack ?? error}`);
      } finally {
        win.close();
      }
    });
  }

  if (remoteUrl) {
    win.loadURL(remoteUrl);
  } else if (app.isPackaged) {
    win.loadURL(serverReady ? `http://127.0.0.1:${SERVER_PORT}` : ERROR_PAGE);
  } else {
    win.loadURL(DEV_URL);
  }
  return win;
}

// "This Mac" screen preview — served from the main process so the Screen
// Recording permission prompt attributes to the app, never the server
ipcMain.handle("screen:frame", async () => {
  if (process.platform !== "darwin") return null;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1280, height: 800 },
  });
  return sources[0]?.thumbnail.toDataURL() ?? null;
});

// Onboarding permission checks. Status reads are free; the mic request
// pops the real TCC prompt attributed to the app.
//
// Screen Recording deliberately has NO request path here. On macOS 15+
// every pre-grant mechanism is broken: getMediaAccessStatus("screen")
// wraps CGPreflightScreenCaptureAccess, which caches per-process (stays
// "denied" for the whole session after the user grants); a helper child
// binary gets TCC-attributed to ITSELF on macOS 26, not the app, and
// plain executables no longer appear in the Settings pane at all; and
// Sequoia+ re-prompts periodically regardless, so a pre-grant expires.
// The one reliable path is the first real in-process capture
// (screen:frame above / getDisplayMedia via the handler below) — macOS
// prompts then, attributed correctly, at the moment of actual use. The
// perm:open-settings deep link stays as the repair path for denials.
// Copy the engine command, then open a blank terminal. Renderer-controlled
// text must never become a process argument: the user reviews and pastes it.
// Returns false when the renderer should show the clipboard fallback.
ipcMain.handle("engine:open-terminal", async (_event, command) => {
  if (typeof command !== "string" || !command.trim()) return false;
  clipboard.writeText(command);
  return openBlankTerminal();
});

// OAuth/connect links are returned asynchronously, after Chromium's direct
// click gesture has ended. Opening them through window.open can therefore be
// rejected as a popup before setWindowOpenHandler ever sees the URL. Keep the
// renderer sandboxed and let the main process open only ordinary web links.
// A bot's working folder: the native picker, so the path is real and the
// user never types one. Returns null when they cancel.
ipcMain.handle("desktop:pick-folder", async (event, current) => {
  const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const result = await dialog.showOpenDialog(win, {
    title: "Choose a working folder",
    properties: ["openDirectory", "createDirectory"],
    ...(typeof current === "string" && current ? { defaultPath: current } : {}),
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("desktop:open-external", async (_event, rawUrl) => {
  if (typeof rawUrl !== "string") throw new Error("A web address is required");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That web address is invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only web links can be opened");
  }
  await shell.openExternal(url.toString());
  return true;
});

ipcMain.handle("perm:status", () => ({
  mic:
    process.platform === "darwin"
      ? systemPreferences.getMediaAccessStatus?.("microphone") ?? "unknown"
      : "unsupported",
}));
ipcMain.handle("perm:request-mic", async () => {
  if (process.platform !== "darwin") return false;
  try {
    return await systemPreferences.askForMediaAccess("microphone");
  } catch {
    return false;
  }
});

// macOS never re-prompts a denied permission — the only path is System
// Settings; deep-link straight to the right privacy pane.
ipcMain.handle("perm:open-settings", (_event, pane) => {
  if (process.platform !== "darwin") return false;
  const panes = {
    mic: "Privacy_Microphone",
    screen: "Privacy_ScreenCapture",
    speech: "Privacy_SpeechRecognition",
  };
  // own-property lookup only — a renderer-supplied "__proto__"/"constructor"
  // would otherwise resolve up the prototype chain to a truthy object
  const anchor = Object.hasOwn(panes, pane) ? panes[pane] : "Privacy";
  return shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`);
});

ipcMain.handle("speech:start", (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (process.platform !== "darwin") {
    win.webContents.send("speech:end", { code: 2, reason: "unsupported-platform" });
    return;
  }
  startSpeech(win, options);
});
ipcMain.handle("speech:stop", () => {
  if (process.platform === "darwin") stopSpeech();
});
ipcMain.handle("speech:finish", () => {
  if (process.platform === "darwin") finishSpeech();
});

// ── companion sidecar ──────────────────────────────────────────────────
// The renderer gets these five and nothing else: it can turn the companion
// on and off, look at it, open or cancel a pairing window, and remove a
// device. It cannot reach the sidecar's control port itself.
async function remoteCompanion(pathname, method = "GET") {
  const response = await fetch(`${remoteConnection.url}/api/companion${pathname}`, {
    method,
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Companion request failed (HTTP ${response.status})`);
  return body;
}

ipcMain.handle("server:get-connection", () => ({
  ...remoteConnection,
  configured: serverConnectionChoiceSaved(),
  active: remoteMode ? "remote" : "local",
  fallback: remoteConnection.mode === "remote" && !remoteMode,
}));
ipcMain.handle("server:set-connection", async (_event, value) => {
  if (!value || (value.mode !== "local" && value.mode !== "remote")) {
    throw new Error("Choose this computer or a remote server.");
  }
  if (value.mode === "remote") {
    const url = normalizeRemoteUrl(value.url);
    const probe = await probeHarness(url);
    // Refuse before writing: a saved port that only answers /api/health (the
    // phone companion) would relaunch into a window where every call is 401.
    if (!probe.ok) throw new Error(probeErrorMessage(url, probe));
    writeServerConnection({ mode: "remote", url });
  } else {
    writeServerConnection({ mode: "local" });
  }
  // Relaunch so every window, server child, and companion decision starts
  // from the new mode rather than half-applying it to a live process.
  setTimeout(relaunchApp, 150);
  return { ok: true };
});
// Frameless Linux window: the renderer's floating controls call these.
const windowFrom = (event) => BrowserWindow.fromWebContents(event.sender);
ipcMain.handle("window:minimize", (event) => windowFrom(event)?.minimize());
ipcMain.handle("window:toggle-maximize", (event) => {
  const win = windowFrom(event);
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});
ipcMain.handle("window:close", (event) => windowFrom(event)?.close());
ipcMain.handle("window:is-maximized", (event) => windowFrom(event)?.isMaximized() ?? false);

// Clipboard writes go through the main process in the desktop app: the
// remote UI is plain HTTP, where the renderer's navigator.clipboard is
// unavailable, and the legacy execCommand fallback is not reliable there.
ipcMain.handle("clipboard:write", (_event, text) => {
  if (typeof text !== "string") return false;
  clipboard.writeText(text.slice(0, 5_000_000));
  return true;
});

// Native notifications. The remote UI is served over plain HTTP, which is not
// a secure context, so the renderer's Web Notification permission is denied;
// Electron's main-process Notification works regardless and uses the desktop
// notification daemon (including its sound).
const liveNotifications = new Set();
ipcMain.handle("notify:show", (event, payload) => {
  if (!Notification.isSupported()) return { shown: false };
  const title = typeof payload?.title === "string" ? payload.title.slice(0, 160) : "";
  const body = typeof payload?.body === "string" ? payload.body.slice(0, 500) : "";
  if (!title) return { shown: false };
  const kind = typeof payload?.kind === "string" ? payload.kind : "done";
  const botId = typeof payload?.botId === "string" ? payload.botId : "";
  const threadId = typeof payload?.threadId === "string" ? payload.threadId : "";
  const win = BrowserWindow.fromWebContents(event.sender);
  const note = new Notification({
    title,
    body,
    icon: APP_ICON,
    // A blocked turn is worth keeping on screen; a finished reply is not.
    urgency: kind === "done" ? "normal" : "critical",
    timeoutType: kind === "done" ? "default" : "never",
  });
  liveNotifications.add(note);
  note.on("close", () => liveNotifications.delete(note));
  note.on("click", () => {
    const target = win ?? BrowserWindow.getAllWindows()[0];
    if (!target) return;
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
    target.webContents.send("notify:open", { botId, threadId });
  });
  note.show();
  return { shown: true };
});

ipcMain.handle("companion:state", () =>
  remoteMode ? remoteCompanion("/state") : companionState(),
);ipcMain.handle("companion:start", async () => {
  if (remoteMode) return remoteCompanion("/start", "POST");
  const state = await startCompanion({
    resourcesPath: process.resourcesPath,
    harnessPort: SERVER_PORT,
    log: slog,
  });
  // Remember only a start that worked: persisting the intent behind a failed
  // one would greet every launch with the same error for a toggle the panel
  // showed as off.
  if (state.enabled && !state.error) rememberCompanionEnabled(true);
  return state;
});
ipcMain.handle("companion:stop", () => {
  if (remoteMode) return remoteCompanion("/stop", "POST");
  rememberCompanionEnabled(false);
  return stopCompanion();
});
ipcMain.handle("companion:pairing", (_event, open) => {
  if (remoteMode) return remoteCompanion("/pairing", open ? "POST" : "DELETE");
  return companionPairing(Boolean(open));
});
ipcMain.handle("companion:cloud-desktop", (_event, deviceId, allowed) => {
  if (remoteMode) {
    return remoteCompanion(`/devices/${encodeURIComponent(deviceId)}/cloud-desktop`, allowed ? "POST" : "DELETE");
  }
  return companionCloudDesktopAccess(deviceId, Boolean(allowed));
});
ipcMain.handle("companion:revoke", (_event, deviceId) => {
  if (remoteMode) return remoteCompanion(`/devices/${encodeURIComponent(deviceId)}`, "DELETE");
  return companionRevoke(deviceId);
});

ipcMain.handle("desktop:capabilities", async () => {
  const capabilities = await desktopCapabilities({
    platform: process.platform,
    env: process.env,
    packaged: app.isPackaged,
    localConnection: await cuaReady,
  });
  return { ...capabilities, remoteMode };
});

ipcMain.handle("credential:set", async (_event, name, value) => {
  if (name !== "composioApiKey" || typeof value !== "string") {
    throw new Error("Unsupported credential");
  }
  if (remoteMode) {
    throw new Error("Credentials are managed by the remote server. Configure them on that computer.");
  }
  if (app.isPackaged && !(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("The operating-system credential store is unavailable");
  }
  // In development the server is a separately launched process, so it cannot
  // receive credentials from Electron at boot. Keep its established local
  // config path there; production always uses the encrypted external store.
  const secretStorage = app.isPackaged ? "?secretStorage=external" : "";
  const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/config${secretStorage}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ composio: { apiKey: value.trim() } }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Could not save credential (HTTP ${response.status})`);
  if (app.isPackaged) {
    if (value.trim()) secureCredentials.composioApiKey = value.trim();
    else delete secureCredentials.composioApiKey;
    await saveSecureCredentials(secureCredentials);
  }
  return body;
});

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock.setIcon(APP_ICON);
  // No application menu on Linux/Windows: Alt must not drop a File/Edit/View
  // bar over the custom title strip. macOS keeps its menu — Cmd+Q and the
  // standard edit commands live there.
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  remoteConnection = readServerConnection();
  if (remoteConnection.mode === "remote") {
    const probe = await probeHarness(remoteConnection.url);
    remoteMode = probe.ok;
    if (!remoteMode) {
      console.error(`[remote] ${probeErrorMessage(remoteConnection.url, probe)} Starting the local server instead.`);
    }
  }
  // A headless process is the server, not a client: never let a saved remote
  // address turn it into a windowless client that serves nothing.
  if (HEADLESS) {
    remoteMode = false;
    remoteConnection = { mode: "local" };
  }
  if (app.isPackaged) {
    secureCredentials = await loadSecureCredentials();
    await secureComposioConfig();
    await ensureManagedComposioCredentials();
  }
  // getDisplayMedia in the renderer → this handler → ScreenCaptureKit, all
  // inside the app's own processes — the one capture path macOS reliably
  // attributes to the app (registers it in the Screen Recording pane and
  // prompts). Used by the onboarding "Enable screen preview" button.
  if (process.platform === "darwin") {
    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer
          .getSources({ types: ["screen"] })
          .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
          .catch(() => callback({}));
      },
      { useSystemPicker: false },
    );
  }
  registerCuaIpc();
  registerUpdaterIpc();
  // Native spellcheck lives in Chromium: the same Hunspell path OpenCode's
  // context menu uses. Include both interface languages so composer
  // suggestions work in English and Bulgarian.
  try {
    const available = session.defaultSession.availableSpellCheckerLanguages ?? [];
    const preferred = ["en-US", "en-GB", "bg-BG"].filter((language) => available.includes(language));
    if (preferred.length) session.defaultSession.setSpellCheckerLanguages(preferred);
    session.defaultSession.setSpellCheckerEnabled(true);
  } catch {
    /* spellcheck is a convenience; never block startup on a missing dictionary */
  }
  // Start the CUA daemon before the window so the harness can pick up the
  // connection descriptor on first render. Never blocks window creation on
  // failure — computer use degrades to "unavailable", the rest still works.
  cuaReady =
    process.platform === "darwin"
      ? startCua().catch((e) => {
          console.error("[cua] start failed:", e);
          return { mode: "unavailable", reason: String(e) };
        })
      : Promise.resolve({ mode: "unavailable", reason: "unsupported-platform" });
  if (app.isPackaged && !remoteMode) serverReady = await startServerPackaged();
  // The companion the user left on comes back without anyone finding the
  // toggle again — one attempt, after the harness port is settled, with the
  // exact options the IPC handler uses. A failure surfaces in companionState
  // (the panel shows the error) rather than retrying; and it never delays
  // the window. A remote client leaves the companion to the remote host.
  if (!remoteMode && serverReady && companionEnabledAtRest()) {
    void startCompanion({ resourcesPath: process.resourcesPath, harnessPort: SERVER_PORT, log: slog });
  }

  if (HEADLESS) {
    if (!app.isPackaged) {
      console.error("[headless] --headless is for packaged builds; use `pnpm dev:server` in development");
      app.quit();
      return;
    }
    const host = process.env.OC_HOST || "127.0.0.1";
    console.log(`[headless] KodBot server listening on http://${host}:${SERVER_PORT}`);
    console.log("[headless] point the desktop app at this address from Settings → General → Server");
    const stop = () => app.quit();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }

  const win = createWindow(remoteMode ? remoteConnection.url : null);
  // in-app auto-update (packaged only) — checks GitHub releases, downloads on
  // the user's click, installs on "Restart to update"
  startUpdater(win);
  createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(remoteMode ? remoteConnection.url : null);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// EMBEDDING.md lifecycle rule: defer the first quit until the embedded
// daemon's async cleanup completes — it can't run after the host exits.
// Cap the defer so a wedged daemon cannot keep the app alive forever.
const CUA_STOP_TIMEOUT_MS = 2500;
let cuaCleanedUp = false;
app.on("before-quit", (e) => {
  if (cuaCleanedUp) return;
  e.preventDefault();
  try {
    serverProc?.kill();
  } catch {}
  // the sidecar holds a socket that is reachable from off this machine —
  // it should not outlive the window by even a moment
  void stopCompanion();
  // a live dictation session runs its own helper child that holds the mic —
  // stop it here so quitting never orphans a recording process
  stopSpeech();
  const cleanup = Promise.race([
    stopCua().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, CUA_STOP_TIMEOUT_MS).unref()),
  ]);
  cleanup.then(() => {
    cuaCleanedUp = true;
    app.quit();
  });
});
