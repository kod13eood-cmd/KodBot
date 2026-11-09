// The shared Local VM desktop, embedded in the app. noVNC is proxied through
// the harness origin so a remote window or paired phone can watch and use the
// same screen the bot sees. Full screen uses the browser API; the default
// overlay already fills the app window.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, Monitor, X } from "lucide-react";

export function LocalVmViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const shell = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
