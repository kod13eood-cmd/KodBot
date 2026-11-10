// The shared Local VM desktop, embedded in the app. noVNC is proxied through
// the harness origin so a remote window or paired phone can watch and use the
// same screen the bot sees. Full screen uses the browser API; the default
// overlay already fills the app window.
import { useEffect, useRef, useState } from "react";
import { Check, Circle, ExternalLink, Loader2, Maximize2, Minimize2, Monitor, Square, X } from "lucide-react";

import { useStore } from "@/state/store";

interface Recording {
  id: string;
  name: string;
  host_path: string;
  guest_path: string;
}

export function LocalVmViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const shell = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Recording | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  recordingRef.current = recording;
  const selectedBot = state.bots.find((bot) => bot.id === state.selectedId);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch("/api/local-computer/recordings/state")
      .then((response) => response.json())
      .then((body) => {
        if (!alive || !body?.state?.enabled) return;
        const guest = String(body.state.guest_path ?? "");
        setRecording({
          id: guest.split("/").pop() ?? "recording",
          name: "Workflow",
          host_path: String(body.state.host_path ?? ""),
          guest_path: guest,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!recordingRef.current) return;
      void fetch("/api/local-computer/recordings/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).catch(() => {});
    };
  }, []);

  const record = async () => {
    const name = window.prompt(
      "Name this workflow",
      `Workflow ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    );
    if (!name?.trim()) return;
    setBusy(true);
    setMessage(null);
    setSaved(null);
    try {
      const response = await fetch("/api/local-computer/recordings/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Couldn't start the recording");
      setRecording(body.recording as Recording);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/local-computer/recordings/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Couldn't stop the recording");
      setSaved(body.recording as Recording);
      setRecording(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const analyze = () => {
    if (!saved || !selectedBot) return;
    dispatch({
      type: "send",
      botId: selectedBot.id,
      text: [
        `The user recorded a workflow in the Local VM at ${saved.host_path}.`,
        "Read recording.json, events.jsonl, and the frames/*.png screenshots in that folder, then write a concise reusable workflow to your memory (MEMORY.md or memory/<topic>.md).",
        "Include the steps, the exact controls/coordinates used, the expected result, and any gotchas. Do not replay or execute the recorded actions yet.",
      ].join(" "),
    });
    setMessage(`Sent to ${selectedBot.name}.`);
    setSaved(null);
  };

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onClose();
  };

  const toggleFullscreen = () => {
    const element = shell.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void element.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/80 p-2 backdrop-blur-sm sm:p-3">
      <div
        ref={shell}
        role="dialog"
        aria-modal="true"
        aria-label="Local VM"
        className="relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-hairline/40 bg-panel shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline/30 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Monitor size={16} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">Local VM</div>
              <div className="truncate text-[11.5px] text-ink-secondary">
                You and the bot share this desktop. Use it normally; ask the bot to take a screenshot when you want it to observe.
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {recording ? (
              <button
                type="button"
                onClick={() => void stop()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md bg-danger/15 px-2 py-1 text-[11.5px] font-medium text-danger hover:bg-danger/25 disabled:opacity-50"
                title="Stop and save the workflow recording"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />}
                Stop & save
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void record()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-hairline/40 px-2 py-1 text-[11.5px] text-ink hover:bg-raised disabled:opacity-50"
                title="Record a workflow the bot can learn from"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Circle size={11} className="fill-danger text-danger" />}
                Record
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title={fullscreen ? "Exit full screen" : "Full screen"}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title="Open in a new tab"
              aria-label="Open in a new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {(saved || message) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline/30 px-3 py-1.5 text-[11.5px]">
            {saved && (
              <>
                <Check size={13} className="text-success" />
                <span className="text-ink-secondary">Workflow saved.</span>
                {selectedBot ? (
                  <button
                    type="button"
                    onClick={analyze}
                    className="rounded-md bg-accent px-2 py-0.5 font-medium text-white hover:brightness-110"
                  >
                    Analyze with {selectedBot.name}
                  </button>
                ) : (
                  <span className="text-ink-secondary">Open a bot chat to analyze it.</span>
                )}
              </>
            )}
            {message && <span className="text-ink-secondary">{message}</span>}
          </div>
        )}
        <iframe
          src={url}
          title="Local VM desktop"
          className="min-h-0 w-full flex-1 border-0 bg-black"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
