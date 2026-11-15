import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/state/store";

// Floating minimize / restore / close for the frameless Linux window. macOS
// keeps its traffic lights and Windows its native title-bar overlay, so the
// bridge is absent there and this renders nothing.
const button =
  "flex size-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-raised hover:text-ink";

/** The panels that own the top-right corner while open. Their close button
 *  must be the only X there: a floating window control on top of it either
 *  steals the click or leaves the panel's X with no hover state. Full-screen
 *  modals (settings, guide, connected apps) count too — their own X sits in
 *  that same corner on narrow windows. */
export interface WindowControlsVisibility {
  settingsOpen: boolean;
  computerOpen: boolean;
  inspectorOpen: boolean;
  appSettingsOpen: boolean;
  helpOpen: boolean;
  pluginsOpen: boolean;
}

export function windowControlsHidden(state: WindowControlsVisibility): boolean {
  return Boolean(
    state.settingsOpen ||
      state.computerOpen ||
      state.inspectorOpen ||
      state.appSettingsOpen ||
      state.helpOpen ||
      state.pluginsOpen,
  );
}

export function WindowControls() {
  const { t } = useI18n();
  const { state } = useStore();
  const bridge = window.ogb?.windowControls;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.isMaximized().then(setMaximized).catch(() => {});
    return bridge.onMaximizedChange(setMaximized);
  }, [bridge]);

  if (!bridge || windowControlsHidden(state)) return null;

  return (
    // Below the modal tier (z-50) and the side panels (z-40): a backdrop or
    // panel draws over the controls instead of the controls swallowing the
    // panel's close button.
    <div
      className="fixed right-2 top-2 z-30 flex items-center gap-0.5"
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
