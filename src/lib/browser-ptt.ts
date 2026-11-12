// Browser push-to-talk: record a short utterance, send it to the harness for
// local Whisper transcription, and return the text. Used where the native
// macOS speech bridge is unavailable (Linux/Windows desktop and web builds).
// getUserMedia is secure-context only; a remote plain-HTTP UI gets a clear
// message instead of a silent failure.

export function browserPttSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function audioType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

export class BrowserPtt {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private cancelled = false;

  async start(): Promise<void> {
    if (!browserPttSupported()) throw new Error("Voice capture isn't available in this browser.");
    if (!window.isSecureContext && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
      throw new Error("Voice capture needs HTTPS or the localhost desktop app.");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mimeType = audioType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.cancelled = false;
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  stop(): Promise<string> {
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve("");
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const chunks = this.chunks;
        const mime = recorder.mimeType || "audio/webm";
        const cancelled = this.cancelled;
        this.cleanup();
        if (cancelled) return resolve("");
        try {
          const response = await fetch("/api/voice/transcribe?language=auto", {
            method: "POST",
            headers: { "content-type": mime },
            body: new Blob(chunks, { type: mime }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error ?? `Transcription failed (${response.status})`);
          resolve(typeof body.text === "string" ? body.text.trim() : "");
        } catch (error) {
          reject(error);
        }
      };
      // Chromium normally fires `stop`, but a stream that ended elsewhere can
      // leave the recorder inactive without the event. Never let the UI hang
      // in "transcribing": settle from the buffered chunks after a short
      // grace period as well.
      const timer = setTimeout(() => void finish(), 4_000);
      recorder.addEventListener("stop", () => void finish(), { once: true });
      recorder.addEventListener(
        "error",
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.cleanup();
          reject(new Error("The microphone stopped unexpectedly."));
        },
        { once: true },
      );
      try {
        if (recorder.state === "inactive") void finish();
        else recorder.stop();
      } catch (error) {
        this.cleanup();
        reject(error);
      }
    });
  }

  cancel(): void {
    this.cancelled = true;
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      // Already stopped.
    }
    this.cleanup();
  }

  private cleanup() {
    this.recorder = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.chunks = [];
  }
}
