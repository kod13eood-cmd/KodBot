// Local, offline voice: faster-whisper for speech-to-text and Piper for
// text-to-speech. Both live under the harness data directory so no model or
// audio leaves the machine. The binaries are provisioned by
// scripts/setup-local-voice.sh; this module only resolves and runs them.

import { spawn } from "node:child_process";
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

const TRANSCRIBE_SCRIPT = String.raw`
import subprocess, sys, numpy as np
from faster_whisper import WhisperModel
audio_path, language = sys.argv[1], (sys.argv[2] or None)
raw = subprocess.check_output([
    "ffmpeg", "-v", "quiet", "-i", audio_path,
    "-f", "s16le", "-ac", "1", "-ar", "16000", "-"
])
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language=language, beam_size=5, vad_filter=True)
print(" ".join(segment.text.strip() for segment in segments))
`;

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
    const { stdout } = await runProcess(
      PYTHON,
      ["-c", TRANSCRIBE_SCRIPT, input, language && language !== "auto" ? language : ""],
      undefined,
      120_000,
    );
    return stdout.toString("utf8").trim();
  } finally {
    await rm(input, { force: true }).catch(() => {});
  }
}
