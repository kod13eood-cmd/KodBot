// Blocks the first render until this install knows whether it is KodBot Solo
// or KodBot Business. A desktop window has a main-process connection choice;
// a loopback browser gets the same first-run question; a remote personal
// harness or an organization's gateway already answers it. Failing open is
// deliberate: a broken IPC call or auth probe must never brick the only
// window.
import { useEffect, useState, type ReactNode } from "react";

import { BootScreen } from "./LoadingScreens";
import { EditionSetupWizard } from "./EditionSetupWizard";
import { browserEditionChoiceRequired, soloEditionChosen } from "@/lib/edition";
import { serverChoiceRequired } from "@/lib/server-choice";

type GateState = "checking" | "wizard" | "ready";

export function ServerSetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => {
    if (window.ogb?.server) return "checking";
    // A non-loopback origin (remote personal harness, gateway, phone) is
    // already a server the user chose; only an ambiguous loopback page needs
    // the first-run question.
    return browserEditionChoiceRequired({
      hostname: window.location.hostname,
      authUser: null,
      soloChosen: soloEditionChosen(),
    })
      ? "checking"
      : "ready";
  });

  useEffect(() => {
    const bridge = window.ogb?.server;
    if (bridge) {
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
    }

    // Browser or phone. Only a loopback page that has not chosen Solo yet is
    // ambiguous: ask once. A non-loopback origin is already a server the user
    // navigated to (personal harness or organization gateway).
    if (
      !browserEditionChoiceRequired({
        hostname: window.location.hostname,
        authUser: null,
        soloChosen: soloEditionChosen(),
      })
    ) {
      setState("ready");
      return;
    }

    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    void fetch("/api/auth/me", { signal: controller.signal, headers: { accept: "application/json" } })
      .then((response) => {
        if (!alive) return;
        // A signed-in gateway is already Business. A 401 also belongs to a
        // gateway (its API calls will redirect to /login); a local harness
        // answers 404, which is the only case that gets the first-run question.
        setState(response.ok || response.status === 401 ? "ready" : "wizard");
      })
      .catch(() => {
        // Fail open: an unavailable auth probe should not block the app.
        if (alive) setState("ready");
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
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
    return <EditionSetupWizard onDone={() => setState("ready")} />;
  }
  return <>{children}</>;
}
