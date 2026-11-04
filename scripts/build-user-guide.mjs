// Build docs/USER-GUIDE.md from the bilingual guide that powers the in-app
// help. The TS module is bundled with esbuild so the docs cannot drift from
// what the app shows.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const bundle = join(mkdtempSync(join(tmpdir(), "kodbot-guide-")), "guide.mjs");
await build({
  entryPoints: ["src/lib/guide.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});

const { GUIDE_SECTIONS } = await import(pathToFileURL(bundle).href);
const title = (locale) => GUIDE_SECTIONS.map((section) => `- ${section.title[locale]}`).join("\n");

const header = `# KodBot user guide / Ръководство за KodBot

<!-- Generated from src/lib/guide.ts by scripts/build-user-guide.mjs. Edit that
     file, then run \`pnpm docs:guide\`. -->

The same guide is available inside the app: the book icon at the bottom of the
sidebar, or **Help and guide**. Use the EN / BG switch in the guide.

Същото ръководство е достъпно и в приложението: иконата с книгата в долната
част на страничната лента или **Помощ и ръководство**. Езикът се сменя с
EN / BG.

## Contents / Съдържание

${title("en")}

${title("bg")}

---

# English

`;

const between = "\n\n---\n\n# Български\n\n";

const content =
  header +
  GUIDE_SECTIONS.map((section) => section.body.en.trim()).join("\n\n---\n\n") +
  between +
  GUIDE_SECTIONS.map((section) => section.body.bg.trim()).join("\n\n---\n\n") +
  "\n";

writeFileSync("docs/USER-GUIDE.md", content);
console.log(`docs/USER-GUIDE.md: ${GUIDE_SECTIONS.length} sections, ${Buffer.byteLength(content)} bytes`);
