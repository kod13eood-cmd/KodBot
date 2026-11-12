import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserPtt } from "./browser-ptt";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BrowserPtt", () => {
  it("settles and transcribes when MediaRecorder never emits stop", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "hello from the microphone" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const stream = { getTracks: () => [] };
    const recorder = {
      mimeType: "audio/webm",
      state: "recording",
      start: vi.fn(),
      // Deliberately does not fire a `stop` event; the fallback must settle.
      stop: vi.fn(),
      addEventListener: vi.fn(),
      ondataavailable: null as ((event: { data: Blob }) => void) | null,
    };
    class FakeRecorder {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        return recorder;
      }
    }
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: { hostname: "localhost" },
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("fetch", fetchMock);

    const ptt = new BrowserPtt();
    await ptt.start();
    recorder.ondataavailable?.({ data: new Blob(["speech"]) });
    const transcribed = ptt.stop();
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(transcribed).resolves.toBe("hello from the microphone");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/voice/transcribe?language=auto",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
