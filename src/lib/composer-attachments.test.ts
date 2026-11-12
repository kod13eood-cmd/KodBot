import { describe, expect, it, vi } from "vitest";

import {
  composeMessage,
  uploadRemoteAttachments,
  uploadVoiceNote,
  type Attachment,
} from "./composer-attachments";

describe("voice attachments", () => {
  it("stores a recorded clip and returns the host path plus a playable URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "/home/user/.kodbot/uploads/123-abc-voice-note.webm",
          url: "/api/uploads/123-abc-voice-note.webm",
          name: "voice-note.webm",
          size: 42,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const stored = await uploadVoiceNote(new Blob(["voice"]), "voice-note.webm", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "audio/webm",
          "x-kodbot-filename": "voice-note.webm",
        }),
      }),
    );
    expect(stored).toEqual({
      path: "/home/user/.kodbot/uploads/123-abc-voice-note.webm",
      url: "/api/uploads/123-abc-voice-note.webm",
      name: "voice-note.webm",
      size: 42,
    });
  });

  it("keeps an already-stored voice note out of the remote re-upload path", async () => {
    const fetchMock = vi.fn();
    const attachment: Attachment = {
      kind: "file",
      id: "voice",
      path: "/home/user/.kodbot/uploads/123-abc-voice-note.webm",
      name: "voice-note.webm",
      size: 42,
      remote: true,
      audio: true,
    };
    await expect(uploadRemoteAttachments([attachment], fetchMock)).resolves.toEqual([attachment]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("composes the transcript prompt with the audio path attached", () => {
    const attachment: Attachment = {
      kind: "file",
      id: "voice",
      path: "/home/user/.kodbot/uploads/123-abc-voice-note.webm",
      name: "voice-note.webm",
      size: 42,
      remote: true,
      audio: true,
    };
    const composed = composeMessage("🎤 hello\n\n[Play voice note](/api/uploads/123-abc-voice-note.webm)", [
      attachment,
    ]);
    expect(composed).toContain('<attached-file path="/home/user/.kodbot/uploads/123-abc-voice-note.webm" />');
    expect(composed).toContain("🎤 hello");
  });
});
