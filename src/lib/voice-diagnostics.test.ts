import { describe, expect, it } from "vitest";

import { httpsVoiceUrl, microphoneIssue } from "./voice-diagnostics";

describe("microphoneIssue", () => {
  const ready = {
    secureContext: true,
    hostname: "kodbot.example.com",
    hasMediaDevices: true,
    hasMediaRecorder: true,
  };

  it("accepts a secure origin with the recording APIs", () => {
    expect(microphoneIssue(ready)).toBeNull();
  });

  it("accepts localhost over plain HTTP because Chromium treats it as secure", () => {
    expect(microphoneIssue({ ...ready, secureContext: false, hostname: "127.0.0.1" })).toBeNull();
    expect(microphoneIssue({ ...ready, secureContext: false, hostname: "localhost" })).toBeNull();
  });

  it("reports an insecure remote origin instead of hiding the microphone", () => {
    expect(
      microphoneIssue({
        ...ready,
        secureContext: false,
        hostname: "paperclipi7.tail89d239.ts.net",
      }),
    ).toBe("insecure");
  });

  it("reports a browser without the recording APIs", () => {
    expect(microphoneIssue({ ...ready, hasMediaDevices: false })).toBe("unsupported");
    expect(microphoneIssue({ ...ready, hasMediaRecorder: false })).toBe("unsupported");
  });
});

describe("httpsVoiceUrl", () => {
  it("drops the HTTP harness port when the HTTPS listener is on 443", () => {
    expect(httpsVoiceUrl("http:", "paperclipi7.tail89d239.ts.net", "8799")).toBe(
      "https://paperclipi7.tail89d239.ts.net",
    );
  });

  it("keeps a non-default HTTPS port", () => {
    expect(httpsVoiceUrl("https:", "kodbot.example.com", "8443")).toBe(
      "https://kodbot.example.com:8443",
    );
    expect(httpsVoiceUrl("https:", "kodbot.example.com", "443")).toBe(
      "https://kodbot.example.com",
    );
  });
});
