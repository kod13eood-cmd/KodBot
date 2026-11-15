// Local, offline voice: faster-whisper for speech-to-text and Piper for
// text-to-speech. Both live under the harness data directory so no model or
// audio leaves the machine. The binaries are provisioned by
// scripts/setup-local-voice.sh; this module only resolves and runs them.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { DATA_DIR } from "./config.ts";
import { augmentedPath } from "./env-path.ts";

export const VOICE_DIR = join(DATA_DIR, "voice");
const PYTHON = join(VOICE_DIR, "venv", "bin", "python");
const VOICES_DIR = join(VOICE_DIR, "voices");
const BG_VOICE = "bg_BG-dimitar-medium";
const ENGLISH_VOICE = "en_US-lessac-medium";

export interface LocalVoiceInfo {
  stt: boolean;
  tts: boolean;
  voices: Array<{ id: string; label: string; description?: string }>;
}

function runProcess(
  command: string,
  args: string[],
  input: string | Buffer | undefined,
  timeoutMs: number,
): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PATH: augmentedPath() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ stdout: Buffer.concat(stdout), stderr });
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("local voice process timed out"));
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8_000);
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(stderr.trim() || `${basename(command)} exited with ${code}`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

function installedVoices(): Array<{ id: string; label: string; description?: string }> {
  if (!existsSync(VOICES_DIR)) return [];
  return readdirSync(VOICES_DIR)
    .filter((file) => file.endsWith(".onnx"))
    .map((file) => {
      const id = file.slice(0, -".onnx".length);
      const [language = "", name = id, quality = ""] = id.split("-");
      const label =
        language.toLowerCase().startsWith("bg")
          ? `Bulgarian · ${name}${quality ? ` (${quality})` : ""}`
          : language.toLowerCase().startsWith("en")
            ? `English · ${name}${quality ? ` (${quality})` : ""}`
            : id;
      return { id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function localVoiceInfo(): LocalVoiceInfo {
  const voices = installedVoices();
  return {
    stt: existsSync(PYTHON),
    tts: existsSync(PYTHON) && voices.length > 0,
    voices,
  };
}

export function localVoiceReady(): boolean {
  return localVoiceInfo().tts;
}

export function localVoices() {
  return localVoiceInfo().voices;
}

function preferredVoice(text: string, requested?: string): string | null {
  const voices = localVoices();
  if (!voices.length) return null;
  if (requested) {
    const id = requested.replace(/[^a-zA-Z0-9_.-]/g, "").replace(/\.onnx$/, "");
    if (voices.some((voice) => voice.id === id)) return id;
  }
  const cyrillic = /[\u0400-\u04ff]/.test(text);
  const preferred = cyrillic ? BG_VOICE : ENGLISH_VOICE;
  if (voices.some((voice) => voice.id === preferred)) return preferred;
  return voices[0].id;
}

export async function speakLocal(
  text: string,
  requested?: string,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!existsSync(PYTHON)) throw new Error("Local voice models are not installed on the harness.");
  const voice = preferredVoice(text, requested);
  if (!voice) throw new Error("No local voice is installed.");
  const output = join(tmpdir(), `kodbot-tts-${randomUUID()}.wav`);
  try {
    await runProcess(
      PYTHON,
      ["-m", "piper", "--model", join(VOICES_DIR, `${voice}.onnx`), "--output_file", output],
      `${text.trim()}\n`,
      60_000,
    );
    return { bytes: new Uint8Array(await readFile(output)), mime: "audio/wav" };
  } finally {
    await rm(output, { force: true }).catch(() => {});
  }
}

const WHISPER_WORKER_SCRIPT = String.raw`
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
for line in sys.stdin:
    try:
        request = json.loads(line)
        raw = subprocess.check_output([
            "ffmpeg", "-v", "quiet", "-i", request["path"],
            "-f", "s16le", "-ac", "1", "-ar", "16000", "-"
        ])
        audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
        segments, info = model.transcribe(
            audio,
            language=(request.get("language") or None),
            beam_size=5,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments)
        print("@@ " + json.dumps({"text": text}), flush=True)
    except Exception as error:
        print("@@ " + json.dumps({"error": str(error)}), flush=True)
`;

type WhisperReply = { text?: string; error?: string };

/** One long-lived Python process keeps the small Whisper model in memory.
 * A fresh process per clip spent most of its time loading the model; this
 * worker serialises requests and answers one JSON line at a time. */
class WhisperWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending: {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private buffer = "";
  private stderr = "";
  private stopped = false;

  transcribe(path: string, language?: string): Promise<string> {
    const run = this.queue.then(() => this.request(path, language));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private request(path: string, language?: string): Promise<string> {
    try {
      this.ensure();
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop(new Error("local voice process timed out"));
      }, 120_000);
      timer.unref?.();
      this.pending = { resolve, reject, timer };
      const line = `${JSON.stringify({ path, language: language ?? "" })}\n`;
      this.child?.stdin.write(line, (error) => {
        if (error) this.stop(error);
      });
    });
  }

  private ensure() {
    if (this.child) return;
    this.stopped = false;
    const child = spawn(PYTHON, ["-u", "-c", WHISPER_WORKER_SCRIPT], {
      env: { ...process.env, PATH: augmentedPath() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.buffer = "";
    this.stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      for (;;) {
        const newline = this.buffer.indexOf("\n");
        if (newline < 0) break;
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        this.answer(line);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-8_000);
    });
    child.on("error", (error) => this.stop(error));
    child.on("close", (code) => {
      if (this.stopped) return;
      this.stop(new Error(this.stderr.trim() || `local voice exited with ${code}`));
    });
    process.once("exit", () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Already gone.
      }
    });
  }

  private answer(line: string) {
    if (!line.startsWith("@@ ")) return;
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    try {
      const reply = JSON.parse(line.slice(3)) as WhisperReply;
      if (reply.error) pending.reject(new Error(reply.error));
      else pending.resolve(String(reply.text ?? "").trim());
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private stop(error: Error) {
    if (this.stopped) return;
    this.stopped = true;
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.child?.kill("SIGKILL");
    this.child = null;
    this.buffer = "";
  }
}

let whisperWorker: WhisperWorker | null = null;

export async function transcribeLocal(
  audio: Uint8Array,
  mime: string,
  language?: string,
): Promise<string> {
  if (!existsSync(PYTHON)) throw new Error("Local speech-to-text is not installed on the harness.");
  const extension = mime.includes("ogg")
    ? "ogg"
    : mime.includes("wav")
      ? "wav"
      : mime.includes("mp4") || mime.includes("m4a")
        ? "m4a"
        : mime.includes("mpeg")
          ? "mp3"
          : "webm";
  const input = join(tmpdir(), `kodbot-stt-${randomUUID()}.${extension}`);
  await writeFile(input, audio, { mode: 0o600 });
  try {
    const worker = (whisperWorker ??= new WhisperWorker());
    return await worker.transcribe(
      input,
      language && language !== "auto" ? language : undefined,
    );
  } finally {
    await rm(input, { force: true }).catch(() => {});
  }
}
