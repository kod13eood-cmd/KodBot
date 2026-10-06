import { describe, expect, it, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { removeTempDir } from "../../testing/cleanup.ts";
import {
  createOpenCodeDriver,
  mergeOpenCodeCatalogs,
} from "./opencode.ts";
import {
  isFreeModelId,
  pickBestFreeModel,
  resetOpenCodeCatalogCache,
} from "./opencode-shared.ts";
import type { ModelCatalog } from "../../contracts.ts";

const FAKE_CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "testing", "fake-acp-cli.ts");

function catalog(options: Array<{ id: string; label?: string; free?: boolean; group?: string }>): ModelCatalog {
  return {
    default: options[0]?.id ?? "",
    options: options.map((option) => ({ label: option.id, ...option })),
  };
}

/** A fetcher that serves a distinct catalog per OpenCode endpoint. */
function endpointFetcher(byUrl: { zen?: unknown; go?: unknown }): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/zen/go/")) return new Response(JSON.stringify(byUrl.go ?? []), { status: 200 });
    if (url.includes("/zen/v1/")) return new Response(JSON.stringify(byUrl.zen ?? []), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
}

describe("OpenCode free model helpers", () => {
  it("flags -free ids and known stealth models", () => {
    expect(isFreeModelId("big-pickle")).toBe(true);
    expect(isFreeModelId("opencode/big-pickle")).toBe(true);
    expect(isFreeModelId("opencode-go/space-bunny-free")).toBe(true);
    expect(isFreeModelId("grok-4.7")).toBe(false);
  });

  it("prefers the curated best free model, then any free model", () => {
    const options = [
      { id: "opencode/grok-4.7", label: "Grok 4.7" },
      { id: "opencode-go/space-bunny-free", label: "Space Bunny Free", free: true },
      { id: "opencode/big-pickle", label: "Big Pickle", free: true },
    ];
    expect(pickBestFreeModel(options)).toBe("opencode/big-pickle");
    expect(pickBestFreeModel([{ id: "opencode-go/mystery-free", label: "Mystery", free: true }])).toBe(
      "opencode-go/mystery-free",
    );
    expect(pickBestFreeModel([{ id: "opencode/grok-4.7", label: "Grok 4.7" }])).toBeUndefined();
  });
});

describe("mergeOpenCodeCatalogs", () => {
  it("dedupes by full id and defaults to the best free model", () => {
    const zen = catalog([
      { id: "opencode/grok-4.7", group: "Zen" },
      { id: "opencode/big-pickle", group: "Zen", free: true },
    ]);
    const go = catalog([
      { id: "opencode-go/grok-4.7", group: "Go" },
      { id: "opencode-go/space-bunny-free", group: "Go", free: true },
    ]);
    const merged = mergeOpenCodeCatalogs([zen, go]);
    expect(merged.default).toBe("opencode/big-pickle");
    expect(merged.options.map((o) => o.id)).toEqual([
      "opencode/grok-4.7",
      "opencode/big-pickle",
      "opencode-go/grok-4.7",
      "opencode-go/space-bunny-free",
    ]);
    expect(merged.options.find((o) => o.id === "opencode-go/space-bunny-free")?.group).toBe("Go");
  });

  it("does not duplicate the same id across catalogs", () => {
    const merged = mergeOpenCodeCatalogs([
      catalog([{ id: "opencode-go/grok-4.7", group: "Go" }]),
      catalog([{ id: "opencode-go/grok-4.7", group: "Go" }]),
    ]);
    expect(merged.options).toHaveLength(1);
  });
});

describe("unified OpenCode driver", () => {
  beforeEach(() => resetOpenCodeCatalogCache());

  it("merges Zen and Go catalogs from one engine", async () => {
    const driver = createOpenCodeDriver(endpointFetcher({
      zen: [{ id: "big-pickle" }, { id: "grok-4.7" }],
      go: [{ id: "space-bunny-free" }, { id: "grok-4.6" }],
    }));
    const instance = await driver.create({
      instanceId: "opencode",
      displayName: "OpenCode",
      environment: {},
      enabled: true,
      config: driver.defaultConfig(),
    });
    try {
      expect(instance.driverKind).toBe("opencode");
      expect(instance.models.default).toBe("opencode/big-pickle");
      const ids = instance.models.options.map((o) => o.id);
      expect(ids).toContain("opencode/big-pickle");
      expect(ids).toContain("opencode-go/space-bunny-free");
      expect(instance.models.options.find((o) => o.id === "opencode/big-pickle")?.free).toBe(true);
    } finally {
      await instance.dispose();
    }
  });

  it("keeps the pinned fallback default (best free) when both catalogs fail", async () => {
    const driver = createOpenCodeDriver((async () => {
      throw new Error("network down");
    }) as typeof fetch);
    const instance = await driver.create({
      instanceId: "opencode",
      displayName: "OpenCode",
      environment: {},
      enabled: true,
      config: driver.defaultConfig(),
    });
    try {
      expect(instance.models.default).toBe("opencode/big-pickle");
      expect(instance.models.options.some((o) => o.id === "opencode/big-pickle" && o.free)).toBe(true);
    } finally {
      await instance.dispose();
    }
  });

  it("still lists Go models when the Zen endpoint is down", async () => {
    const driver = createOpenCodeDriver((async (input: string | URL) => {
      if (String(input).includes("/zen/go/")) {
        return new Response(JSON.stringify([{ id: "space-bunny-free" }]), { status: 200 });
      }
      throw new Error("zen down");
    }) as typeof fetch);
    const instance = await driver.create({
      instanceId: "opencode",
      displayName: "OpenCode",
      environment: {},
      enabled: true,
      config: driver.defaultConfig(),
    });
    try {
      expect(instance.models.options.some((o) => o.id === "opencode-go/space-bunny-free")).toBe(true);
    } finally {
      await instance.dispose();
    }
  });

  it("declares the OpenCode CLI setup and default config", () => {
    const driver = createOpenCodeDriver(async () => new Response("[]", { status: 200 }));
    expect(driver.driverKind).toBe("opencode");
    expect(driver.decodeConfig(undefined)).toEqual({ cli: "opencode", fullAuto: false, workspace: undefined });
    expect(driver.install?.docsUrl).toContain("opencode.ai");
  });

  it("recognizes a Zen login stored by the CLI", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "omb-opencode-auth-"));
    const authDir = join(scratch, "opencode");
    mkdirSync(authDir, { recursive: true });
    writeFileSync(join(authDir, "auth.json"), JSON.stringify({
      opencode: { type: "api", key: "stored-zen-secret" },
    }));
    const driver = createOpenCodeDriver(async () => new Response("[]", { status: 200 }));
    const instance = await driver.create({
      instanceId: "opencode-auth",
      displayName: "OpenCode",
      environment: { XDG_DATA_HOME: scratch, OPENCODE_API_KEY: "" },
      enabled: true,
      config: { cli: FAKE_CLI, fullAuto: false },
    });
    try {
      expect((await instance.snapshot()).authenticated).toBe(true);
    } finally {
      await instance.dispose();
      await removeTempDir(scratch);
    }
  });
});
