# KodBot maintainer handoff

This is the operating handoff for an agent or developer taking over KodBot.
Read [`docs/developing-kodbot-with-kodbot.md`](docs/developing-kodbot-with-kodbot.md)
before changing the agent harness itself.

**This file contains no private key or API key values.** Secrets are named by
their location and purpose only. Transfer them out-of-band: password manager,
encrypted archive, or a direct `scp`/`rsync` between trusted machines. Never
paste a private key or API key into a prompt, an issue, a commit, or a chat
transcript.

Last reviewed: **2026-11-02**.

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
| App version | `0.1.28` |
| Android version | `0.1.12` / versionCode `13` |

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

## 4. Remote deployment topology

| Item | Value |
| --- | --- |
| Host | `paperclipi7.tail89d239.ts.net` (`100.94.230.62`) |
| SSH | `paperclipi7@paperclipi7.tail89d239.ts.net:22` |
| Harness | `http://paperclipi7.tail89d239.ts.net:8799` (0.0.0.0:8799) |
| Companion | `paperclipi7.tail89d239.ts.net:8810` |
| Companion control | `127.0.0.1:8811` (loopback only) |
| Desktop update feed | `http://paperclipi7.tail89d239.ts.net:8799/updates` |
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

## 6. Critical live-data warning

As of **2026-11-02 19:49 UTC**, the live data directory on `paperclipi7`
contained `bots.json`, `messages.db`, `events`, `native`, `webhooks.json`, and
`workspaces`, but **no `config.json`**, `teams.json`, `groups.json`,
`routines.json`, or `backups` directory.

The running process still reports Composio and OpenCode Go as configured, and
the HTTP API still lists teams, rooms, and routines that are not present in the
files above. That means **some live state is in memory only**.

Before restarting `kodbot.service`:

1. Make a fresh snapshot of `/home/paperclipi7/.kodbot` and
   `/home/paperclipi7/.kodbot-companion`.
2. Snapshot the API state:
   `curl /api/teams`, `/api/routines`, `/api/webhooks`, and `/api/bots?messages=0`.
3. Recover or re-enter `config.json` from the owner’s password manager.
4. Only then restart.

A read-only handoff snapshot was taken on 2026-11-02 19:50 UTC at:

`/home/paperclipi7/kodbot-handoff-20261102-1950.tgz` (mode `600`)

It contains the current `bots.json`, `messages.db`, `webhooks.json`, and API
snapshots of bots, teams, routines, webhooks, and config flags. It does not
contain `config.json` because that file is missing.

The previous restore directory
`/home/paperclipi7/kodbot-restore-backup-20261101-133846/` contains an older
`bots.json`, `groups.json`, `messages.db`, `routines.json`, and
`webhooks.json`, but **no config.json**.

Current data is not a reliable source of truth for teams or credentials until
this is resolved. The product code is safe; the live host state is the risk.

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
