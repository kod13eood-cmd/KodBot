# OpenCode

OpenCode is a KodBot engine. KodBot runs the maintained OpenCode
CLI through its ACP stdio interface, so sessions, streaming, coding tools,
permission requests, MCP integrations, resume, and cancellation use the same
runtime as the other ACP engines.

The unified **OpenCode** engine merges the **OpenCode Go** and **OpenCode
Zen** model catalogs behind a single picker entry — including their **free
models** — so one credential and one bot can reach every plan.

> The older Go-only engine (`OpenCode Go` in the picker) remains registered for
> backwards compatibility. New installs should use the unified `OpenCode`
> engine, which is what ships in the default fleet.

## Setup

1. Install the official CLI using the
   [OpenCode installation guide](https://opencode.ai/docs/).
2. Create or obtain an OpenCode API key from the
   [OpenCode console](https://opencode.ai/auth). One key covers OpenCode Go,
   Go Plus, and Zen — including the free models.
3. Open KodBot Settings → Connections and save the key under **OpenCode
   API key**.

The key is stored locally as write-only configuration. KodBot reports only
whether it is configured, never the value. A key saved in KodBot is
injected as `OPENCODE_API_KEY` only into the OpenCode child process; it is not
sent to the renderer, logs, analytics, snapshots, error messages, or command
arguments.

OpenCode remains unavailable until both the `opencode` executable and the
credential are present. It is never selected as a runnable default while either
requirement is missing. Users may instead manage OpenCode's own login flow with
`opencode auth login`; KodBot does not edit OpenCode auth/config files.

## Models

The model picker refreshes two public catalogs:

- Zen — `https://opencode.ai/zen/v1/models`, addressed as `opencode/<model-id>`
- Go — `https://opencode.ai/zen/go/v1/models`, addressed as `opencode-go/<model-id>`

The unified engine merges both, tags each row with its plan group, and marks
free/stealth models with a **Free** badge. Its default is the best available
free model according to a curated preference order
(`server/drivers/acp/opencode-shared.ts` → `FREE_PREFERENCE`), falling back to
the first catalog entry. Because the free lineup changes, treat the badge and
default as a convenience, not a contract.

If a catalog is unavailable, the last successful catalog is used, followed by a
small pinned fallback. The catalogs are mutable; current names, pricing, limits,
and retention terms remain defined by the live OpenCode documentation.

Before every prompt, ACP receives `session/set_config_option` with
`configId: "model"` and the exact provider-qualified model ID. KodBot
fails the turn rather than silently running a different model.

### Free models

Free models still require an OpenCode account and API key. Some free/stealth
models may use your prompts to improve the model — check the live privacy
terms before sending sensitive data. The unified engine treats a model as free
when its id ends in `-free` or is otherwise listed as known-free.

## Privacy

See the live OpenCode privacy notes for per-model retention and training
policies. Free and stealth ("contributor") models vary: some collect data during
their free period. KodBot links to the live documentation rather than
duplicating mutable commercial or retention details.

## Testing

Normal unit and ACP protocol tests do not require a subscription. Live tests,
if added, must be explicitly enabled and must never print credentials or upload
native protocol logs from a credentialed run.
