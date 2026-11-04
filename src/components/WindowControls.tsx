import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

// Floating minimize / restore / close for the frameless Linux window. macOS
// keeps its traffic lights and Windows its native title-bar overlay, so the
// bridge is absent there and this renders nothing.
const button =
  "flex size-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-raised hover:text-ink";

export function WindowControls() {
  const { t } = useI18n();
  const bridge = window.ogb?.windowControls;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.isMaximized().then(setMaximized).catch(() => {});
    return bridge.onMaximizedChange(setMaximized);
  }, [bridge]);

  if (!bridge) return null;

  return (
    <div
      className="fixed right-2 top-2 z-[80] flex items-center gap-0.5"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        className={button}
        aria-label={t("Minimize")}
        title={t("Minimize")}
        onClick={() => void bridge.minimize()}
      >
        <Minus size={15} />
      </button>
      <button
        type="button"
        className={button}
        aria-label={maximized ? t("Restore") : t("Maximize")}
        title={maximized ? t("Restore") : t("Maximize")}
        onClick={() => void bridge.toggleMaximize().then(setMaximized)}
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </button>
      <button
        type="button"
        className={cn(button, "hover:bg-danger hover:text-white")}
        aria-label={t("Close")}
        title={t("Close")}
        onClick={() => void bridge.close()}
      >
        <X size={15} />
      </button>
    </div>
  );
}
