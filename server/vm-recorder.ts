// Durable workflow recordings for the shared Local VM.
//
// Cua's own start_recording records Cua *tool calls*, not a human moving the
// mouse in noVNC. A workflow demonstration is human input, so we record the
// viewer's RFB pointer/key messages (injected by recorder.js) and periodic
// desktop frames ourselves. The result is portable JSONL + PNG, with no video
// and no agent session held open.

import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { acquireDesktopLock, type DesktopLock } from "./desktop-lock.ts";
import {
  containerComputerScreenshot,
  containerComputerStatus,
  VM_DESKTOP_LOCK,
  VM_WORKSPACE_DIR,
  VM_WORKSPACE_GUEST,
} from "./container-computer.ts";

export interface LocalVmRecording {
  id: string;
  name: string;
  host_path: string;
  guest_path: string;
  started_at: number;
  stopped_at?: number;
  actions?: number;
  frames?: number;
}

export interface LocalVmRecordingState {
  enabled: boolean;
  guest_path: string | null;
  host_path: string | null;
  next_turn: number | null;
}

interface ActiveRecording extends LocalVmRecording {
  lock: DesktopLock;
  timer: ReturnType<typeof setInterval> | null;
  maxTimer: ReturnType<typeof setTimeout> | null;
  capture: Promise<void> | null;
  events: number;
  eventsPath: string;
  recordingPath: string;
  framesPath: string;
}

let active: ActiveRecording | null = null;

/** A browser crash must not leave the shared desktop locked forever. A
 * demonstration longer than an hour is almost certainly a forgotten tab. */
const MAX_RECORDING_MS = 60 * 60_000;

export function localVmRecordingActive(): boolean {
  return active !== null;
}

export function recordingSlug(name: string): string {
  return (
    String(name ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workflow"
  );
}

export function recordingPaths(name: string, now = Date.now()) {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const id = `${stamp}-${recordingSlug(name)}-${randomBytes(3).toString("hex")}`;
  return {
    id,
    name: String(name ?? "").trim().slice(0, 80) || "Workflow",
    guest_path: `${VM_WORKSPACE_GUEST}/recordings/${id}`,
    host_path: join(VM_WORKSPACE_DIR, "recordings", id),
    started_at: now,
  };
}

function publicRecording(recording: ActiveRecording): LocalVmRecording {
  const {
    lock: _lock,
    timer: _timer,
    maxTimer: _maxTimer,
    capture: _capture,
    events: _events,
    eventsPath: _eventsPath,
    recordingPath: _recordingPath,
    framesPath: _framesPath,
    ...value
  } = recording;
  return value;
}

async function writeMeta(recording: ActiveRecording, stoppedAt?: number) {
  await writeFile(
    recording.recordingPath,
    `${JSON.stringify(
      {
        ...publicRecording(recording),
        ...(stoppedAt ? { stopped_at: stoppedAt } : {}),
        events: recording.events,
        frames: publicRecording(recording).frames ?? 0,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function startLocalVmRecording(name: string): Promise<LocalVmRecording> {
  if (active) throw Object.assign(new Error("a workflow recording is already running"), { status: 409 });
  const vm = await containerComputerStatus();
  if (!vm.ready || !vm.runtime) throw Object.assign(new Error(vm.problem ?? "The Local VM is not ready"), { status: 409 });

  const lock = await acquireDesktopLock(VM_DESKTOP_LOCK, {
    owner: "workflow recording",
    timeoutMs: 5_000,
  });
  try {
    const paths = recordingPaths(name);
    const framesPath = join(paths.host_path, "frames");
    await mkdir(framesPath, { recursive: true, mode: 0o700 });
    const recording: ActiveRecording = {
      ...paths,
      lock,
      timer: null,
      maxTimer: null,
      capture: null,
      events: 0,
      eventsPath: join(paths.host_path, "events.jsonl"),
      recordingPath: join(paths.host_path, "recording.json"),
      framesPath,
      frames: 0,
    };
    await writeFile(recording.eventsPath, "", { mode: 0o600 });
    await writeMeta(recording);

    const capture = async () => {
      try {
        const image = await containerComputerScreenshot();
        const data = image.slice(image.indexOf(",") + 1);
        if (!data) return;
        recording.frames = (recording.frames ?? 0) + 1;
        await writeFile(
          join(framesPath, `${String(recording.frames).padStart(5, "0")}.png`),
          Buffer.from(data, "base64"),
          { mode: 0o600 },
        );
      } catch {
        // A frame can be missed while the desktop is starting; the event log
        // and the next frame still tell the story.
      }
    };

    const timer = setInterval(() => {
      if (recording.capture) return;
      const work = capture().finally(() => {
        recording.capture = null;
      });
      recording.capture = work;
    }, 2_000);
    timer.unref?.();
    recording.timer = timer;
    const maxTimer = setTimeout(() => {
      void stopLocalVmRecording().catch(() => {});
    }, MAX_RECORDING_MS);
    maxTimer.unref?.();
    recording.maxTimer = maxTimer;
    active = recording;
    return publicRecording(recording);
  } catch (error) {
    lock.release();
    throw error;
  }
}

export async function stopLocalVmRecording(): Promise<LocalVmRecording> {
  const current = active;
  if (!current) throw Object.assign(new Error("no workflow recording is running"), { status: 409 });
  clearInterval(current.timer ?? undefined);
  if (current.maxTimer) clearTimeout(current.maxTimer);
  // Let an in-flight screenshot finish before releasing the desktop.
  if (current.capture) await current.capture.catch(() => {});
  const stopped = Date.now();
  current.stopped_at = stopped;
  await writeMeta(current, stopped).catch(() => {});
  current.lock.release();
  active = null;
  return publicRecording(current);
}

export async function localVmRecordingState(): Promise<LocalVmRecordingState> {
  if (!active) {
    return { enabled: false, guest_path: null, host_path: null, next_turn: null };
  }
  return {
    enabled: true,
    guest_path: active.guest_path,
    host_path: active.host_path,
    next_turn: null,
  };
}

/** Append one pointer/key event from recorder.js. Returns false when no
 * recording is active or the event is malformed; the viewer treats that as a
 * no-op. */
export function recordLocalVmEvent(value: unknown): boolean {
  if (!active) return false;
  const event = value as Record<string, unknown>;
  if (!event || (event.type !== "pointer" && event.type !== "key")) return false;
  const at = typeof event.at === "number" && Number.isFinite(event.at) ? Math.round(event.at) : Date.now();
  const safe =
    event.type === "pointer"
      ? {
          type: "pointer",
          at,
          x: Math.max(0, Math.min(10_000, Number(event.x) || 0)),
          y: Math.max(0, Math.min(10_000, Number(event.y) || 0)),
          button: Math.max(0, Math.min(7, Math.round(Number(event.button) || 0))),
        }
      : {
          type: "key",
          at,
          down: event.down === true,
          keysym: Math.max(0, Math.min(0x10ffff, Math.round(Number(event.keysym) || 0))),
          ...(typeof event.key === "string" ? { key: event.key.slice(0, 40) } : {}),
        };
  active.events += 1;
  void appendFile(active.eventsPath, `${JSON.stringify(safe)}\n`, { mode: 0o600 }).catch(() => {});
  return true;
}

export async function listLocalVmRecordings(): Promise<LocalVmRecording[]> {
  const root = join(VM_WORKSPACE_DIR, "recordings");
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const recordings: LocalVmRecording[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const host = join(root, entry.name);
    const info = await stat(host).catch(() => null);
    if (!info) continue;
    const meta = await readFile(join(host, "recording.json"), "utf8")
      .then((text) => JSON.parse(text) as Partial<LocalVmRecording>)
      .catch(() => null);
    recordings.push({
      id: entry.name,
      name:
        meta?.name ??
        entry.name
          .replace(/^\d{8}T\d{6}Z-/, "")
          .replace(/-[a-f0-9]{6}$/, "")
          .replace(/-/g, " "),
      host_path: host,
      guest_path: `${VM_WORKSPACE_GUEST}/recordings/${entry.name}`,
      started_at: meta?.started_at ?? info.mtimeMs,
      ...(meta?.stopped_at ? { stopped_at: meta.stopped_at } : {}),
      frames: meta?.frames ?? (await readdir(join(host, "frames")).then((files) => files.length).catch(() => 0)),
    });
  }
  return recordings.sort((b, a) => b.started_at - a.started_at);
}

process.on("exit", () => {
  if (!active) return;
  clearInterval(active.timer ?? undefined);
  active.lock.release();
});
