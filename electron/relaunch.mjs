/** How a relaunch should start, when Electron's default is not safe.
 *
 * An AppImage started in extract-and-run mode (FUSE unavailable) runs from a
 * temp directory that the AppImage runtime deletes when the process exits.
 * `app.relaunch()` reuses `process.execPath`, which names a binary inside that
 * directory, and the replacement starts in the middle of the old runtime's
 * cleanup — both use the same temp path. The launcher passes the real file in
 * KODBOT_APPIMAGE; start that after a short pause, once the old runtime has
 * removed its copy, and the new instance extracts cleanly.
 *
 * Pure so the decision can be tested without Electron.
 */
export function relaunchCommand({ platform, appImage }) {
  if (platform !== "linux" || !appImage) return null;
  // The path travels as a positional argument, so spaces need no quoting.
  return { command: "/bin/sh", args: ["-c", 'sleep 1; exec "$1"', "sh", appImage] };
}
