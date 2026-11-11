// Blocks the first render until the desktop main process says whether this
// install has chosen local or remote. A browser/phone has no desktop bridge,
// so it passes straight through. Failing open is deliberate: a broken IPC
// call must never brick the only window.
import { useEffect, useState, type ReactNode } from "react";

import { BootScreen } from "./LoadingScreens";
import { ServerSetupWizard } from "./ServerSetupWizard";
import { serverChoiceRequired } from "@/lib/server-choice";

type GateState = "checking" | "wizard" | "ready";

export function ServerSetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() =>
    window.ogb?.server ? "checking" : "ready",
  );

  useEffect(() => {
    const bridge = window.ogb?.server;
    if (!bridge) return;
    let alive = true;
    void bridge
      .get()
      .then((connection) => {
        if (alive) setState(serverChoiceRequired(connection) ? "wizard" : "ready");
      })
      .catch(() => {
        if (alive) setState("ready");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex h-screen w-screen bg-app">
        <BootScreen connected={false} />
      </div>
    );
  }
  if (state === "wizard") {
    return <ServerSetupWizard onDone={() => setState("ready")} />;
  }
  return <>{children}</>;
}
