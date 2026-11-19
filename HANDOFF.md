# KodBot maintainer handoff

This is the operating handoff for an agent or developer taking over KodBot.
Read [`docs/developing-kodbot-with-kodbot.md`](docs/developing-kodbot-with-kodbot.md)
before changing the agent harness itself.

**This file contains no private key or API key values.** Secrets are named by
their location and purpose only. Transfer them out-of-band: password manager,
encrypted archive, or a direct `scp`/`rsync` between trusted machines. Never
paste a private key or API key into a prompt, an issue, a commit, or a chat
transcript.

Last reviewed: **2026-11-12**.

## 1. Source of truth

| Item | Value |
| --- | --- |
| Owner working copy | `/home/deso/Developer/OpenBot` |
| Handoff checkout on paperclipi7 | `/home/paperclipi7/kodbot-handoff/OpenBot` |
| Current branch | `main` |
| Handoff bundle commit | `5a6689b` |
| GitHub remote | `git@github.com:kod13eood-cmd/KodBot.git` |
| Gitea remote | `ssh://git@llm1:2222/deso/kodbot.git` |
| Android release branch | `android-release` (APK-only branch) |
| App version | `0.1.60` |
| Android version | `0.1.27` / versionCode `28` |

There is also a stale remote checkout at `paperclipi7:~/Developer/OpenBot`;
it is not the deployment source. The canonical source is the owner working
copy above, pushed to GitHub and Gitea, with the handoff checkout as the
remote copy for KodBot.

Useful project docs:

- `README.md` — product overview and quick start.
- `docs/FEATURES.md` — canonical feature/status catalog.
- `docs/developing-kodbot-with-kodbot.md` — safe dogfooding workflow.
- `docs/linux-desktop.md` — Linux desktop/update packaging.
- `docs/ios-companion.md` — companion security model and ports.
- `docs/composio.md` — Connected Apps setup.

## 2. Toolchain

| Tool | Version / path |
| --- | --- |
| Node.js | 24.x (`nvm use 24`; package engines require `>=24`) |
| pnpm | 10.33.0 |
| JDK for Android | `~/.jdks/jdk-17.0.20.1+1` |
| Android SDK | `/home/deso/Android/Sdk` |
| adb | `/home/deso/Android/Sdk/platform-tools/adb` |
| Build tools | 35.0.0 (34/36 also installed) |

The shell's default Node may be 22; always run `nvm use 24` before install,
build, or tests. The `paperclipi7` host currently has Node 22.23.1, pnpm
10.33.0, JDK 21, and the Android SDK. Install Node 24 and JDK 17 there before
building the full project or Android app on that host.

```sh
source ~/.nvm/nvm.sh
nvm use 24
cd /home/deso/Developer/OpenBot
pnpm install
```

## 3. Build, test, and release commands

```sh
# TypeScript everywhere
pnpm typecheck

# Full Vitest suite (about 8 minutes on the current host)
pnpm vitest run

# Desktop UI
pnpm build

# Harness bundle
pnpm build:server

# Companion bundle
pnpm build:companion

# Android unit tests and debug APK
export JAVA_HOME="$HOME/.jdks/jdk-17.0.20.1+1"
export PATH="$JAVA_HOME/bin:$PATH"
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

The Android APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`.

### Android release flow

1. Bump `versionCode` and `versionName` in
   `android/app/build.gradle.kts`.
2. Build `assembleDebug`.
3. Copy the APK to a temporary `android-release` worktree as
   `KodBot-android-<version>.apk`, commit, and push `android-release` to
   `origin` and `gitea`.
4. Update `android/latest.json` on `main` with the new version, APK URL, notes,
   and UTC timestamp.
5. Publish the same APK and manifest to the paired host:
   `~/.kodbot/android/KodBot-android.apk` and
   `~/.kodbot/android/latest.json`.
6. Verify both the GitHub raw URL and
   `http://paperclipi7.tail89d239.ts.net:8799/api/android/latest.json`.
7. GitHub release assets are built by `kodbot-releases`; its Android job
   requires the `ANDROID_KEYSTORE_*` secrets and verifies the built
   certificate before uploading. Never upload an APK signed with a different
   key.

The current APK is **debug-signed**. Android will only install it over an
existing build signed by the same debug key. That key is:

| Item | Value |
| --- | --- |
| Keystore | `/home/deso/.android/debug.keystore` |
| Alias | `androiddebugkey` |
| Store password | `android` (standard debug default) |
| SHA-256 | `0B:20:03:5E:3D:C7:72:6F:6A:51:81:82:4F:CB:85:46:1C:94:60:58:83:69:A6:10:DA:D5:3D:DC:D6:5C:23:69` |

Do not commit the keystore. If the Android build moves to another machine,
either transfer this keystore securely or create a real release signing key
before publishing the next APK.

All GitHub release APKs were replaced with builds signed by this key on
2026-11-08. Anyone who installed an earlier CI-signed APK must uninstall it
once; after that, releases update in place.

### Release 0.1.42 (2026-11-11)

- Desktop 0.1.42 for Linux (AppImage/deb) and Windows (unsigned NSIS).
  macOS stays on the separate signed/notarized flow.
- Android remains **0.1.19 / versionCode 20**: no native Android changes; the
  new server UI is delivered through the app.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.42>
- Includes the first-run local/remote server wizard, desktop KodBot gateway
  login, worker-bot automations with Results tasks, and task archiving.

### Release 0.1.43 (2026-11-12)

- Desktop 0.1.43 for Linux (AppImage/deb) and Windows (unsigned NSIS).
  macOS stays on the separate signed/notarized flow.
- Voice fixes: the composer microphone works while a bot is busy, uses
  click-to-talk on Linux/Windows/web, has a microphone/speaker test, and can
  record a playable voice note with an attached clip and transcript.
- Android remains **0.1.19 / versionCode 20**; the APK is unchanged. Native
  dictation is fixed by the companion allowlist (`voice/transcribe`, TTS, and
  upload playback).
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.43>

### Release 0.1.44 (2026-11-12)

- Desktop 0.1.44 for Linux (AppImage/deb) and Windows (unsigned NSIS).
  macOS stays on the separate signed/notarized flow.
- Bulgarian STT now uses the **small** Whisper model with beam search 5;
  App Settings -> Voice has an Auto / Bulgarian / English recognition
  language. CPU transcription is slower.
- Android is **0.1.20 / versionCode 21**: native voice-note button with
  playback, transcript, and attachment. The companion voice routes shipped in
  0.1.43.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.44>

### Release 0.1.45 (2026-11-14)

- Desktop 0.1.45 for Linux/Windows; Android **0.1.21 / versionCode 22**.
- After dictation or a voice note, the composer shows a transcription spinner,
  elapsed seconds, and a CPU-time hint; Android has the same progress row.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.45>

### Release 0.1.46 (2026-11-15)

- Desktop 0.1.46 for Linux/Windows; Android stays **0.1.21 / versionCode 22**.
- Persistent Whisper worker keeps the small model warm: warm transcriptions
  are roughly 15-20 seconds instead of about 50 on the same CPU. The first
  request still pays the model load.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.46>

### Release 0.1.47 (2026-11-15)

- Desktop 0.1.47 for Linux/Windows; Android stays **0.1.21 / versionCode 22**.
- Scheduled/manual automation reports now append a compact summary with
  **See full run** to the owner's permanent main chat; webhook alerts keep
  their Results task. Reports wait for an active turn and show a task unread
  dot until opened.
- Workers end with a SUMMARY / NEEDS YOU block; the main chat shows that block
  instead of the whole run.
- Watcher and Skye were migrated to hidden worker bots; their old daily tasks
  and Results tasks were archived.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.47>

### Release 0.1.48 (2026-11-15)

- Desktop 0.1.48 for Linux/Windows; Android **0.1.22 / versionCode 23**.
- Bots ask with 2-5 tappable answers on every engine. OpenCode's `question`
  tool now reaches the same options card as Claude and Codex through an ACP
  form-elicitation bridge; multi-question forms are asked one card at a time,
  the approval timeout applies, and the chosen answer is stored on the card.
- Opening a bot clears the unread report dot on the task it is showing; other
  tasks keep theirs. New: `PATCH /api/bots/:id/tasks/:threadId` with `{unread}`.
- Android: **See full run** opens the worker's run in the native chat; the
  fleet badge counts report dots on a bot's tasks and clears them when the
  chat is opened.
- The first noisy Watcher manual report was removed from the live main chat
  after a stopped-server backup and `PRAGMA integrity_check`; the clean
  summary remains.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.48>

### Release 0.1.49 (2026-11-15)

- Desktop 0.1.49 for Linux/Windows; Android stays **0.1.22 / versionCode 23**.
- Frameless-window fix: the floating minimize/maximize/close controls step
  aside while a side panel (bot settings, computer, inspector) or a
  full-screen modal (guide, app settings, connected apps) is open, and they
  sit below the modal tier. The panel's own X is now the only one in that
  corner and stays clickable.
- Windows reserves the native caption area (148px) in panel and dialog
  headers, the same way the chat header already did, so their X no longer
  hides under the system buttons.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.49>

### Release 0.1.50 (2026-11-15)

- Desktop 0.1.50 for Linux/Windows; Android stays **0.1.22 / versionCode 23**.
- App-only guide fix: Electron treats the chat and sidebar headers as window
  drag strips. The guide dialog opens over the chat header's strip, so a real
  mouse press on its X started a window drag instead of a click (no hover,
  no close). Browsers and synthetic clicks bypassed the frame, which hid the
  bug from browser tests. Dialogs and the needs-you bar are now marked
  `-webkit-app-region: no-drag`.
- Verified with a real X11 pointer under Xvfb: hover changes and the click
  closes the guide; the side-panel X was already clear.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.50>

### Release 0.1.51 (2026-11-15)

- Desktop 0.1.51; Android **0.1.23 / versionCode 24**.
- Bot pages are readable on Android: a **Pages** list in a bot's chat and
  page cards in the transcript open a full-screen WebView through the paired
  companion. The companion allows only `GET` list/HTML; writes stay denied.
- **App Settings -> General -> Public address** is used by page cards, copied
  links, bot-written page links, and the pages prompt. Empty falls back to the
  window's origin; in-app previews stay on the current origin. The live server
  is set to `http://paperclipi7.tail89d239.ts.net:8799`.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.51>

### Release 0.1.52 (2026-11-15)

- Desktop 0.1.52; Android **0.1.24 / versionCode 25**.
- Automation reports carry the newest page the worker wrote during the run as
  a page card under the summary, on the web and on Android. Text messages that
  carry a page now render the card too. The 15 Nov Watcher report was
  backfilled with its Competitor Radar page.
- Android stacks the voice-note and hold-to-talk buttons above Send so the
  composer's text field keeps its width.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.52>

### Release 0.1.53 (2026-11-15)

- Desktop 0.1.53; Android **0.1.25 / versionCode 26**.
- Desktop task actions are a right-click menu: **Rename / Archive (Restore) /
  Delete**. The inline archive/delete icons are gone; renaming no longer hides
  behind a double-click.
- Android's chat top-right menu holds **Tasks** and **Pages**. Tasks switch,
  rename, archive, restore, delete, and start a new task; archived tasks keep
  their own section.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.53>

### Release 0.1.54 (2026-11-15)

- Desktop 0.1.54; Android **0.1.26 / versionCode 27**.
- Page downloads open a save dialog with the suggested filename, then a
  progress card shows percent, the final path, and **Show in folder**.
  Browsers keep their native download UI. Verified against Zuko's Lode Runner
  page: the sandboxed page's generated APK saved with progress.
- Android file links inside a page go through DownloadManager (notification
  progress, file in Downloads).
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.54>

### Release 0.1.55 (2026-11-15)

- Desktop 0.1.55; Android stays **0.1.26 / versionCode 27**.
- A server restart or crash mid-turn no longer looks like a silent stop:
  startup appends a visible interruption note to the bot's transcript and marks
  it unread, so the next message continues from a state the person can see.
  (The 16:15 deploy restart during Zuko's Lode Runner turn is the case that
  exposed it; the session resumed on the next message.)
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.55>

### Release 0.1.56 (2026-11-19)

- Desktop 0.1.56; Android stays **0.1.26 / versionCode 27**.
- Settings > About shows the harness version (injected from package.json at
  bundle time), Node/platform/arch, the desktop shell's Electron/Chromium/Node
  versions, every available engine CLI with its probed `--version`, and the
  local speech stack (faster-whisper, Piper or ElevenLabs). A remote desktop
  and server on different versions are called out.
- Server side is `GET /api/about`; the desktop shell reports its runtimes over
  the preload bridge.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.56>

### Release 0.1.57 (2026-11-19)

- Desktop 0.1.57; Android stays **0.1.26 / versionCode 27** unchanged.
- ACP engines (Grok, Gemini, Kimi, Droid, Hermes, Qwen, OpenCode, OpenCode Go)
  keep the process warm for 10 minutes after a successful turn, up to four
  parked per engine. The next turn prompts the same session instead of
  spawning and loading; a different cwd/model/MCP env/permission policy or a
  missing cursor starts fresh.
- Prompt-once: prompt-style engines get the stable system layer once per
  session; memory, pages, computer notes, tagged teammates and webhook notes
  ride every turn. A failed `session/load` correctly resends the stable layer.
- A fresh replay carries a short recent-tool trace.
- **Work alone** is a per-bot opt-in (off by default): one automatic
  continuation for an open checklist or denied tool, then a
  "This still needs you" card. It does not widen approvals; the follow-up is
  marked unattended, which disables auto-approval.
- Live harness deployed to `/opt/kodbot` and restarted; 25 bots idle at
  restart. Verified `/api/health`, packaged-server smoke, and the ACP/warm
  tests.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.57>

### Release 0.1.58 (2026-11-19)

- Desktop 0.1.58; Android **0.1.27 / versionCode 28**.
- Skill routing: code and screen stay strong (screen prefers vision), short
  translation/simple questions drop to a fast/free model only with **Economy
  mode** (per bot, off by default, desktop and Android). The task records the
  chosen skill/model.
- A finished multi-step turn can offer **Save this as a routine?**; saving
  creates a paused one-time routine. Automated runs never offer one.
- A bot in a team can enable **Share the cloud computer with the team**; all
  Box operations resolve the same `team:<id>` scope. Off remains private.
- Android has a full Bulgarian UI and a **Language** switch (system language
  on first run). The desktop EN/BG now covers the main panels, approvals,
  update banner, rooms/working folder, calls, engine setup, API keys, the
  computer panel, and server-authored Work alone/routine cards. Remaining
  secondary settings panels are still English (localization follow-up).
- Live harness deployed to `/opt/kodbot`; 25 bots idle at restart. Host
  Android files and `/api/android/latest.json` updated to 0.1.27/28.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.58>

### Release 0.1.59 (2026-11-19)

- Desktop 0.1.59; Android stays **0.1.27 / versionCode 28**.
- **Shared knowledge**: `Settings → Knowledge` writes `~/.kodbot/knowledge.json`
  with a global book for every bot and one book per team. Every turn receives
  a compact core and topic index; the full book is snapshotted into
  `<bot workspace>/shared-knowledge/` and read on demand. Core/topics are
  secret-redacted; team books are visible only to members.
- Bots propose durable facts in their reply; the book button on a bot message
  opens a prefilled editor for a person to edit and approve. Nothing is saved
  automatically.
- **Public dated changelog** at `/changelog` (no login), rendered from
  `CHANGELOG.md`; `build:server` copies it beside the harness bundle. About
  links to it.
- The last English desktop panels are translated: Engines, Local Computer,
  the Local VM viewer, the team library, and the Inspector.
- Live harness deployed to `/opt/kodbot`; 25 bots idle at restart. Verified
  `/api/knowledge`, `/changelog`, and the packaged-server smoke.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.59>

### Release 0.1.60 (2026-11-19)

- Desktop 0.1.60; Android stays **0.1.27 / versionCode 28**.
- **Send now** on a queued prompt: the queued card is focusable and Enter (or
  its send button) calls `POST /api/bots/:id/steer`. ACP engines use
  `_session/steering`; Codex uses `turn/steer`. Other engines keep the
  persistent steer-queue and run it at the end of the current turn. The
  transcript shows a steer as an ordinary user message.
- Routine suggestions are **global + per-bot**, off by default. Enable them in
  Settings → General (`offerRoutines`), or override in Bot settings; “Use app
  default” clears the per-bot override.
- Fixed team-shared cloud-computer actions: provision, join, sleep, exec, and
  screenshot now use the same `team:<id>` scope as status and normal turns.
- Live harness deployed to `/opt/kodbot`; verified `/api/about` 0.1.60,
  `/api/config.offerRoutines=false`, and the public `/changelog`.
- Release: <https://github.com/kod13eood-cmd/kodbot-releases/releases/tag/v0.1.60>

## 4. Remote deployment topology

| Item | Value |
| --- | --- |
| Host | `paperclipi7.tail89d239.ts.net` (`100.94.230.62`) |
| SSH | `paperclipi7@paperclipi7.tail89d239.ts.net:22` |
| Harness | `http://paperclipi7.tail89d239.ts.net:8799` (0.0.0.0:8799) |
| Companion | `paperclipi7.tail89d239.ts.net:8810` |
| Companion control | `127.0.0.1:8811` (loopback only) |
| Desktop update feed | `https://github.com/kod13eood-cmd/kodbot-releases/releases` (legacy: `http://paperclipi7.tail89d239.ts.net:8799/updates`) |
| Data directory | `/home/paperclipi7/.kodbot` |
| Companion state | `/home/paperclipi7/.kodbot-companion` |
| Server files | `/opt/kodbot/server` |
| Companion files | `/opt/kodbot/companion` |
| UI files | `/opt/kodbot/ui` |

Systemd units (system-level, need `sudo`):

- `kodbot.service` — harness on `0.0.0.0:8799`
- `kodbot-companion.service` — phone companion on `0.0.0.0:8810` and control
  plane on `127.0.0.1:8811`

Deploy after building locally:

```sh
pnpm build
rsync -az --delete dist/ paperclipi7@paperclipi7.tail89d239.ts.net:/opt/kodbot/ui/

pnpm build:server
rsync -az --delete dist-server/ paperclipi7@paperclipi7.tail89d239.ts.net:/opt/kodbot/server/

pnpm build:companion
rsync -az --delete dist-companion/ paperclipi7@paperclipi7.tail89d239.ts.net:/opt/kodbot/companion/

ssh paperclipi7@paperclipi7.tail89d239.ts.net \
  'sudo systemctl restart kodbot.service kodbot-companion.service'
```

Do not run the restart until the credential warning in section 6 is resolved.

The server environment sets `OC_HOST=0.0.0.0`, `OC_PORT=8799`,
`OC_STATIC_DIR=/opt/kodbot/ui`, `OC_DATA_DIR=/home/paperclipi7/.kodbot`,
`OC_ALLOWED_HOSTS` for the Tailscale/LAN names, and `TZ=Europe/Sofia`.
The companion uses `OC_COMPANION_PORT=8810`, `OC_CONTROL_PORT=8811`, and
`OC_COMPANION_DIR=/home/paperclipi7/.kodbot-companion`.

## 5. SSH, Git, and API access

### SSH key

The owner’s working key is:

| Item | Value |
| --- | --- |
| Private key | `~/.ssh/id_ed25519` |
| Public key | `~/.ssh/id_ed25519.pub` |
| Fingerprint | `SHA256:LKPPfLUcYAzlw1vHUMiUVprztfWPfMN8gorRBGTEzmI` |
| Remote authorized key | Same key is present in `paperclipi7:~/.ssh/authorized_keys` |

The same private key is also present on `paperclipi7` at
`/home/paperclipi7/.ssh/id_ed25519` (same public fingerprint). GitHub and Gitea
authentication were verified from that host on 2026-11-02; GitHub's
`known_hosts` entry was added after checking its published ED25519
fingerprint. Verify with:

```sh
ssh-keygen -lf ~/.ssh/id_ed25519.pub
ssh -T git@github.com
ssh -p 2222 git@llm1
ssh paperclipi7@paperclipi7.tail89d239.ts.net 'hostname'
```

**Recommended for an agent:** do not copy the owner’s personal private key.
Create a dedicated deploy key and grant only the access the agent needs:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/kodbot_deploy -C "kodbot-agent@$(hostname)"
```

Then add `~/.ssh/kodbot_deploy.pub`:

- to GitHub/Gitea as a repository deploy key with write access if the agent
  must push;
- to `paperclipi7:~/.ssh/authorized_keys` if the agent must deploy or inspect
  that host.

If the agent runs on the same machine and user as this working copy, it can
use the existing SSH agent instead. Keep `~/.ssh/id_ed25519` mode `600`; never
copy it into the repo or a prompt.

### API keys and provider configuration

KodBot’s provider credentials are stored in:

`/home/paperclipi7/.kodbot/config.json`

Known fields (values intentionally omitted):

| Field | Purpose | Current state |
| --- | --- | --- |
| `composio.apiKey` | Connected Apps / Composio broker | Configured in the running process |
| `opencodeGo.apiKey` | OpenCode Go provider | Configured in the running process |
| `xai.key` | xAI / Grok provider | Not configured |
| `box.token` | Box cloud computers | Not configured |
| `tts.key` | ElevenLabs voice | Not configured |
| `instances` | Provider instance configuration | See config |

The UI is write-only for these fields: once saved, it never echoes a key.
Re-enter keys through **Settings → Connections**, or write the file directly
with `chmod 600` and restart only after the file is present.

There is no personal GitHub token, Stripe key, Aircall key, AgentMail key,
HeyGen key, or All Images AI key in this repository. Those Connected Apps
require the owner’s accounts and are blocked until connected.

Cloudflare `wrangler` is logged out; managed broker changes are blocked until
the owner restores Cloudflare auth.

### Companion device tokens

Paired phone tokens live in:

`/home/paperclipi7/.kodbot-companion/devices.json`

This file is secret. If phone pairing must survive a host move, copy it
securely; otherwise revoke the old pairing and pair the phone again. Never put
it in git.

## 6. Live-data status and what happened

At about **2026-11-02 19:32 UTC** the live data directory on `paperclipi7` was
partially recreated. `messages.db` and the directory were fresh, while
`bots.json`, `events`, `native`, and `workspaces` were repopulated over the
next ~15 minutes. `config.json`, `teams.json`, `groups.json`, `routines.json`,
and the old `backups` directory disappeared.

The exact deleting command is **not in the systemd journal or shell history**.
The running server only rewrites those files on changes; it does not delete
them. The evidence is consistent with a manual or agent-driven partial restore
or cleanup, not a normal code path.

Because the server was already running, it kept teams, routines, groups, and
provider credentials in memory even though the files were gone. That is why the
HTTP API still listed them.

A KodBot maintenance pass then restored the missing state:

- `config.json`, `teams.json`, and `routines.json` were written back at
  ~20:22 UTC.
- `groups.json` was written at ~20:26 UTC.
- `/home/paperclipi7/kodbot-backups/RESTORE.md` documents the restore process.
- `kodbot-state-snapshot.timer` now snapshots `.kodbot`, `.kodbot-companion`,
  `.kodbot-gateway` (with a consistent SQLite copy) and `.kodbot-tenants`,
  plus the live API every 15 minutes.
- `kodbot-offsite-backup.timer` uploads a daily archive to `llm1:/home/llm1/backups/kodbot/`
  at 03:30 Europe/Sofia (60-day retention, sha256-verified). The archive
  includes the gateway and tenant roots.

Current state:

| File | Present | Notes |
| --- | --- | --- |
| `config.json` | Yes | Contains OpenCode Go + profile only |
| `teams.json` | Yes | Restored |
| `groups.json` | Yes | Restored |
| `routines.json` | Yes | Restored |
| `bots.json` | Yes | Current fleet |
| `messages.db` | Yes | Current transcript DB |
| `webhooks.json` | Yes | Current webhooks |
| `~/.kodbot-gateway` | Yes | Gateway DB (accounts, sessions, invites), mode 600 |
| `~/.kodbot-tenants` | Yes | Tenant root; 0 members as of 2026-11-11 |
| backups | Yes | `/home/paperclipi7/kodbot-backups` |
| `~/.config/kodbot.env` | Yes | Managed Composio broker URL/token and companion name |

### Restart status (verified)

No key re-entry is needed. Composio runs in **managed** mode from
`OC_COMPOSIO_BROKER_URL` / `OC_COMPOSIO_BROKER_TOKEN`, which live in
`/etc/systemd/system/kodbot.service`'s `EnvironmentFile`
(`~/.config/kodbot.env`) and are on disk, not memory-only. `config.json`
persists the OpenCode Go key and profile.

Before any restart, take a fresh snapshot as usual:

```sh
sudo systemctl start kodbot-state-snapshot.service
```

The 15-minute timer and `RESTORE.md` cover local recovery. A daily archive at
03:30 Europe/Sofia is uploaded to `llm1:/home/llm1/backups/kodbot/`
(60-day retention, checksum-verified).

### 2026-11-04 disk-full incident (resolved)

The 217 GB root disk filled to 100%. The hot snapshot script kept **seven
days** of 15-minute archives, each ~2 GB because the hot tar included bot
workspaces; 117 snapshots occupied 75 GB. SQLite could not write its WAL and
the harness entered a crash loop with `Error: disk I/O error` on
`PRAGMA journal_mode = WAL`, so the app showed no bots, teams, or messages.

The live state was intact. Old hot snapshots were deleted (the newest two were
kept), `~/.kodbot` was copied to
`/home/paperclipi7/kodbot-rescue-20261104-0200` (7 MB, mode 600), and
`PRAGMA integrity_check` returned `ok` with 2,946 messages. The hot-snapshot
retention is now **count-based: the newest 2 archives** (~30 minutes), while
full archives keep 2 days and offsite archives keep 2 copies. The harness was
restarted with 19
bots, 7 rooms, 5 teams, and 2,948 messages.

Launch the desktop app from the desktop session (or `systemd-run --user`), not
from the agent's sandboxed shell: that shell runs with `NoNewPrivs=1`, which
stops `snap-confine` from launching the Chromium/Firefox snaps, so external
auth links appear to do nothing. The currently running app is
`kodbot-desktop.service` under the user manager.

The 19:50 handoff snapshot remains at
`/home/paperclipi7/kodbot-handoff-20261102-1950.tgz` (mode `600`) for comparison;
it predates the restoration and should not replace the newer backups.

## 7. Agent operating rules

The agent may:

- read the repository and run tests;
- implement scoped changes on a branch;
- run targeted tests and the full suite;
- prepare diffs, release notes, and deployment commands.

The agent must get human approval before:

- changing companion pairing, routes, allowlist, approvals, auth, or credentials;
- changing data migrations or rewriting user data;
- restarting `kodbot.service` or `kodbot-companion.service`;
- deploying, publishing an APK, or pushing to a release branch;
- running destructive shell commands, payments, transfers, or outbound calls.

Use a separate worktree and a separate development harness/data directory.
Do not point a development agent at the live `~/.kodbot` state or the live
services. See `docs/developing-kodbot-with-kodbot.md` for the worktree and
harness commands.

Never commit:

- `~/.ssh/*` or any private key;
- `~/.kodbot/config.json` or `~/.kodbot-companion/devices.json`;
- `.android/debug.keystore` or a release keystore;
- `.env` files containing real credentials;
- browser session data or API tokens.

## 8. Known blockers and follow-ups

- **Stripe Pay and payments** need a Stripe account enabled for the relevant
  payment product; no key is present.
- **Bot calls** need Aircall (or another telephony provider), a number, and
  consent/recording policy.
- **Bot email** needs AgentMail (or a dedicated mailbox provider).
- **Image/video generation** needs All Images AI / HeyGen accounts.
- **iOS actions** need an iOS app with App Intents and permissions; Android is
  not a substitute.
- **Cloudflare broker deployment** is blocked while `wrangler` is logged out.
- **Android release signing** is debug-only today; see section 4.
- The full suite is green but broad: `pnpm typecheck` and `pnpm vitest run`
  before every merge.

## 9. First safe tasks for the new maintainer

1. Read `README.md`, `docs/FEATURES.md`, and
   `docs/developing-kodbot-with-kodbot.md`.
2. Verify the repository and remotes, then run `pnpm typecheck` and
   `pnpm vitest run`.
3. Back up the live host state and resolve the missing `config.json` before
   touching the remote service.
4. Reproduce one small bug with a test and fix it on a branch.
5. Run the full suite and prepare a diff for human review.
6. Only after review: deploy the server/UI and verify the live app.
7. For Android, rebuild, publish the APK, update `latest.json`, and verify the
   update feed on both GitHub and the paired host.

## 10. Handoff checklist

- [ ] Repository cloned and `main` at the agreed commit.
- [ ] Node 24, pnpm 10.33, JDK 17, Android SDK installed.
- [ ] `pnpm install`, `pnpm typecheck`, `pnpm vitest run` pass.
- [ ] SSH access to GitHub, Gitea, and `paperclipi7` verified.
- [ ] Dedicated deploy key created and scoped (preferred).
- [ ] Live host data snapshotted.
- [ ] `config.json` recovered or provider keys re-entered.
- [ ] Service restart deferred until the two items above are complete.
- [ ] Android debug/release signing key transferred or replaced.
- [ ] Human review and deploy approval process agreed.
