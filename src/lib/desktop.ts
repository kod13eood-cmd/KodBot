const browserCapabilities: DesktopCapabilities = {
  host: {
    platform: "other",
    label: "Browser",
    session: "unknown",
    packaged: false,
  },
  windowChrome: "native",
  screenPreview: {
    available: false,
    interaction: "none",
    reasonCode: "desktop-app-required",
  },
  dictation: {
    available: false,
    engine: "none",
    onDevice: false,
    reasonCode: "desktop-app-required",
  },
  localComputer: {
    available: false,
    support: "unsupported",
    reasonCode: "desktop-app-required",
  },
};

let cached: DesktopCapabilities | null = null;

export function browserDesktopCapabilities(): DesktopCapabilities {
  return browserCapabilities;
}

export function initialDesktopCapabilities(): DesktopCapabilities {
  // `globalThis.window` is absent in node-based unit tests; optional chaining
  // keeps the pure module importable without pretending a browser exists.
  const platform = globalThis.window?.ogb?.platform;
  if (!platform) return browserCapabilities;
  const isMac = platform === "darwin";
  const dictation: DesktopCapabilities["dictation"] = {
    available: isMac,
    engine: isMac ? "apple-speech" : "none",
    onDevice: isMac,
  };
  if (!isMac) dictation.reasonCode = "unsupported-platform";
  return {
    ...browserCapabilities,
    host: {
      ...browserCapabilities.host,
      platform: platform === "darwin" || platform === "linux" || platform === "win32" ? platform : "other",
      label: platform === "darwin" ? "macOS" : platform === "linux" ? "Linux" : platform === "win32" ? "Windows" : "Desktop",
    },
    windowChrome: isMac ? "mac-inset" : "native",
    dictation,
  };
}

export async function loadDesktopCapabilities(): Promise<DesktopCapabilities> {
  if (cached) return cached;
  if (!window.ogb?.getCapabilities) return browserCapabilities;
  try {
    cached = await window.ogb.getCapabilities();
  } catch {
    cached = browserCapabilities;
  }
  return cached;
}
