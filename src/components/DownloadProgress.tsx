// Downloads started from a sandboxed page (a test APK, an export) are owned
// by the Electron main process: it asks where to save and streams progress
// here. In a browser the native download UI does this job, so the bridge is
// absent and nothing renders.
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { useI18n } from "@/lib/i18n";

type DownloadState = {
  id: number;
  filename: string;
  path?: string;
  received: number;
  total: number;
  state: "started" | "downloading" | "done" | "interrupted" | "cancelled";
};

export function DownloadProgress() {
  const { t } = useI18n();
  const [items, setItems] = useState<DownloadState[]>([]);
  const bridge = window.ogb?.downloads;

  useEffect(() => {
    if (!bridge) return;
    return bridge.onState((next) => {
      setItems((current) => {
        if (next.state === "cancelled") return current.filter((item) => item.id !== next.id);
        const index = current.findIndex((item) => item.id === next.id);
        if (index === -1) return [...current, next];
        const copy = [...current];
        copy[index] = { ...copy[index], ...next };
        return copy;
      });
    });
  }, [bridge]);

  if (!bridge || items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[85] flex w-[320px] flex-col gap-2" aria-live="polite">
      {items.map((item) => {
        const percent =
          item.total > 0 ? Math.min(100, Math.round((item.received / item.total) * 100)) : null;
        const done = item.state === "done";
        const failed = item.state === "interrupted";
        return (
          <div
            key={item.id}
            className="rounded-xl border border-hairline/50 bg-panel/95 p-3 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <div className="flex items-start gap-2">
              <Download size={15} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">{item.filename}</div>
                <div className="truncate text-[11px] text-ink-secondary">
                  {done
                    ? t("Saved")
                    : failed
                      ? t("Download interrupted")
                      : percent === null
                        ? t("Downloading…")
                        : `${percent}%`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                aria-label={t("Dismiss")}
                className="rounded p-0.5 text-ink-secondary hover:bg-raised hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
            {!done && !failed && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className={percent === null ? "h-full w-1/3 animate-pulse bg-accent" : "h-full bg-accent transition-[width]"}
                  style={percent === null ? undefined : { width: `${percent}%` }}
                />
              </div>
            )}
            {item.path && (
              <div className="mt-1.5 truncate font-mono text-[10px] text-ink-secondary/70" title={item.path}>
                {item.path}
              </div>
            )}
            {done && item.path && (
              <button
                type="button"
                onClick={() => void bridge.showInFolder(item.path!)}
                className="mt-1.5 text-[11.5px] text-accent hover:underline"
              >
                {t("Show in folder")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
