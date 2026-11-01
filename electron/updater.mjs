// In-app auto-updater (electron-updater), manual/button-driven — the same
// shape t3code's desktop app uses: autoDownload off, quitAndInstall on the
// user's "Restart to update" click. One state object is broadcast to the
// renderer on every transition; the renderer just renders it.
//
// Only runs in the packaged, signed+notarized app (mac auto-update requires
// signing). In dev it's a no-op so the browser/dev shell is unaffected.
// electron-updater is vendored (electron/vendor/electron-updater.cjs) because
// the packaged app ships no node_modules.
import { app, ipcMain } from "electron";
import { createRequire } from "node:module";
import { createUpdaterCoordinator } from "./updater-coordinator.mjs";

const require = createRequire(import.meta.url);

// APPIMAGE_EXTRACT_AND_RUN clears APPIMAGE in the extracted child, which
// makes electron-updater unable to identify the installation. The desktop
// launcher passes the original path in KODBOT_APPIMAGE; restore both values
// before the updater is required, and keep extract-and-run for the relaunch.
if (process.platform === "linux" && process.env.KODBOT_APPIMAGE) {
  if (!process.env.APPIMAGE) process.env.APPIMAGE = process.env.KODBOT_APPIMAGE;
  process.env.APPIMAGE_EXTRACT_AND_RUN = "1";
}

let autoUpdater = null;
let win = null;
// status: idle | checking | available | downloading | downloaded | installing | error
let state = { status: "idle" };
let updaterCoordinator = null;

function setState(patch) {
  state = { ...state, ...patch };
  try {
    win?.webContents?.send("update:state", state);
  } catch {
    /* window gone */
  }
}

export function registerUpdaterIpc() {
  ipcMain.handle("update:get-state", () => state);
  ipcMain.handle("update:check", () => updaterCoordinator?.check(true));
  ipcMain.handle("update:download", () => updaterCoordinator?.download());
  ipcMain.handle("update:install", () => {
    if (!autoUpdater) return;
    // Tearing down the window and relaunching takes a beat; announce it so the
    // button greys out instead of looking like the click was swallowed.
    setState({ status: "installing" });
    // isSilent, isForceRunAfter — relaunch straight into the new version
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      setState({ status: "error", message: String(e?.message ?? e) });
    }
  });
}

export function startUpdater(mainWindow) {
  win = mainWindow;
  // dev / unsigned builds can't auto-update — leave the banner dormant
  if (!app.isPackaged) {
    updaterCoordinator = null;
    setState({ status: "idle" });
    return;
  }
  try {
    ({ autoUpdater } = require("./vendor/electron-updater.cjs"));
  } catch {
    updaterCoordinator = null;
    setState({ status: "error", message: "updater unavailable" });
    return;
  }
  autoUpdater.autoDownload = false; // button-driven download
  autoUpdater.autoInstallOnAppQuit = false; // button-driven install
  autoUpdater.logger = null;

  updaterCoordinator = createUpdaterCoordinator(autoUpdater, setState);

  // first check ~15s after launch (let the app settle), then hourly — both
  // silent on failure, hence the arrow: a bare `check` would receive the
  // timer's argument as `manual` and start reporting errors again.
  setTimeout(() => void updaterCoordinator?.check(), 15_000).unref?.();
  setInterval(() => void updaterCoordinator?.check(), 60 * 60 * 1000).unref?.();
}
