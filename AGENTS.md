# Agent instructions

You are working on KodBot, a local-first agent harness with a React desktop UI,
a Node server, a phone companion, and an Android app.

Before your first change, read:

1. `HANDOFF.md` — source of truth, access, remote host, credentials, and the
   live-data warning.
2. `docs/developing-kodbot-with-kodbot.md` — safe worktree and approval rules.
3. `docs/FEATURES.md` — what is actually shipped.

## Required workflow

- Work in your own git worktree. Never use the live checkout or the live
  `~/.kodbot` data directory.
- One branch per task. Do not commit directly to `main`.
- For behavioral changes, add or identify the failing test first.
- Run `pnpm typecheck` and the targeted Vitest files while iterating.
- Run the full `pnpm vitest run` before reporting a merge-ready change.
- For Android, use JDK 17 and run the Android unit tests plus
  `assembleDebug`.
- Report: summary, files changed, commands run, test results, risks, and open
  questions.

## Safety boundaries

Stop and ask a human before changing:

- companion pairing, routes, allowlist, approvals, authentication, or secrets;
- data migrations or anything that rewrites existing user data;
- release versions, deployment, Android publishing, or systemd services;
- the harness that is running you;
- payments, transfers, outbound calls, or destructive shell commands.

Never print, commit, or put into a prompt:

- private SSH keys;
- `~/.kodbot/config.json`;
- `~/.kodbot-companion/devices.json`;
- Android signing keystores;
- real `.env` files or API tokens.

Do not restart `kodbot.service` or `kodbot-companion.service` until the live
data warning in `HANDOFF.md` is resolved.

## Useful commands

```sh
source ~/.nvm/nvm.sh
nvm use 24
pnpm typecheck
pnpm vitest run
pnpm build
pnpm build:server
pnpm build:companion

export JAVA_HOME="$HOME/.jdks/jdk-17.0.20.1+1"
export PATH="$JAVA_HOME/bin:$PATH"
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```
