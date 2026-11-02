# Developing KodBot with KodBot

This is an operating guide for using KodBot as a contributor to its own
repository. It is deliberately not a promise that the app can replace its
maintainer. The useful rule is:

> **KodBot writes and verifies the code. The human decides what ships.**

Last reviewed: 2026-11-02.

## Short answer

Use KodBot as the main implementation assistant. Do not make it the
unreviewed owner of the project.

KodBot is not a different "brain" from the models it runs. With the same model
it is roughly equal on an isolated one-off question, and usually better on real
work because it has a workspace, tools, memory, and a verification loop. That
advantage becomes a risk when the work touches security, architecture, release
gating, or the harness that KodBot itself is running on.

| Scenario | Expected result |
| --- | --- |
| Same model, isolated question, no tools | About the same |
| Same model, multi-file change with tests | KodBot usually better |
| Long-running project with memory and follow-up | KodBot clearly better |
| Architecture or threat-model decision | Human plus a strong model review |
| Security-boundary change | Human review, never auto-merge |
| Unattended merge and deploy | Not yet |

## Why this repository fits an agent loop

- The test suite is substantial and fast enough to run targeted files during a
  change, with a full run before merge.
- `pnpm typecheck` catches most cross-file TypeScript mistakes.
- The repository has a clear split between `server/`, `src/`, `companion/`,
  `android/`, and `electron/`.
- The desktop app, the harness, and the phone companion already have explicit
  boundaries, which makes “do not touch this” instructions meaningful.
- Git branches and worktrees make isolated bot work practical.
- The docs already record feature intent, so a bot can update them with the
  code instead of inventing a second source of truth.

## What KodBot should own

KodBot is a good fit for:

- reproducing a bug and writing the failing test first;
- multi-file refactors with a clear acceptance criterion;
- Android/desktop parity work that follows an existing pattern;
- UI copy, empty states, documentation, and release notes;
- running `pnpm typecheck`, targeted Vitest files, Gradle builds, and reading
  the output;
- dependency-free cleanup and small performance fixes;
- maintaining project memory across sessions;
- producing a reviewable diff with the exact commands and results.

## What must stay human

A person must own:

- product scope and architecture;
- security boundaries: pairing, the companion allowlist, approvals, auth,
  credential handling, and anything that changes what a phone or bot may reach;
- schema and data migrations;
- release approval, version bumps, and deployment;
- review of the final diff, especially a diff the bot wrote itself;
- decisions about payments, transfers, outbound calls, and destructive actions;
- any change that would restart or replace the harness the bot is running on.

The bot may prepare all of this. It should not be the final approver of it.

## Safe development setup

Use a separate checkout and a separate harness. Do not point a development bot
at the live `~/.kodbot` state or the live systemd services.

```sh
cd ~/Developer/OpenBot
git worktree add ~/Developer/OpenBot-dev -b kodbot/dev

cd ~/Developer/OpenBot-dev
OC_PORT=8899 \
OC_WEBHOOK_PORT=8900 \
OC_DATA_DIR="$HOME/.kodbot-dev" \
OC_HOST=127.0.0.1 \
pnpm dev:server
```

If the companion is needed for a mobile task, run it on separate ports as
well:

```sh
OC_PORT=8899 \
OC_COMPANION_PORT=8910 \
OC_CONTROL_PORT=8911 \
OC_DATA_DIR="$HOME/.kodbot-dev" \
pnpm companion
```

Rules for the development setup:

1. **One worktree per bot.** Never let two agents edit the same checkout.
2. **One branch per task.** Do not let the bot work directly on `main`.
3. **No production credentials.** Use test accounts, test data, and a throwaway
   data directory.
4. **No self-deploy.** The bot may produce a build; a human publishes it.
5. **No service restarts from inside a turn.** A harness restart can kill the
   turn and the bot’s own tools.
6. **Approval cards are answered by a human.** Do not grant broad
   always-allow permissions to a maintainer bot for destructive commands.

## Suggested maintainer bot prompt

The prompt matters more than the model name. A maintainer bot should be told
what it owns and what it must not touch.

```text
You are the maintainer for the KodBot repository in this worktree.

Work only inside this checkout. Never edit the live checkout, the live
~/.kodbot data directory, or the running services.

For every task:
1. Reproduce the problem or restate the acceptance criteria.
2. Write or identify a failing test first when the change is behavioral.
3. Make the smallest coherent change.
4. Run `pnpm typecheck` and the targeted Vitest files.
5. Before reporting done, run the full `pnpm vitest run` unless the task is
   documentation-only.
6. Report: summary, files changed, commands run, test results, risks, and any
   open questions.

Stop and ask a human before changing:
- companion pairing, routes, allowlist, approvals, auth, or credentials;
- data migrations or anything that rewrites existing user data;
- release versions, deployment, or systemd services;
- the harness that is currently running this bot;
- payments, transfers, outbound calls, or destructive shell commands.

Never force-push, reset a shared branch, delete a worktree, or run `rm -rf`
outside this checkout.
```

## Workflow

1. **Intake.** Write the task as an outcome and acceptance criteria, not a
   solution. “Fix the Android team card” is not enough; “show the current team
   and leader for every bot, and block Leave for the leader” is.
2. **Reproduce.** The bot finds the failing path or states why it cannot.
3. **Test first.** For behavioral changes, add the failing test before the
   implementation.
4. **Implement.** Keep the diff small enough for a human to review in one pass.
5. **Verify.** Run the targeted tests, typecheck, and then the full suite.
   For Android work, compile and run the app’s unit tests with JDK 17.
6. **Report.** The bot returns the diff, commands, output, and risks. A summary
   is not verification.
7. **Review.** A human reads the diff, especially security and data paths.
8. **Merge.** Human approval. The bot does not merge its own work.
9. **Deploy.** A separate, explicit step. The deploy may be scripted, but the
   decision is human.

## Good first tasks

Start with work where a mistake is cheap and the test is obvious:

- documentation corrections and broken links;
- adding tests around an uncovered parser or formatter;
- small UI text and empty-state fixes;
- a bug with a deterministic reproduction;
- Android parity work that follows an existing desktop pattern;
- release-note generation from a diff.

Do not start with:

- companion pairing or route allowlists;
- credential storage or provider setup;
- data migrations;
- the agent permission broker;
- release publishing;
- concurrency and turn-lifecycle fixes.

Those are excellent later tasks, after the review loop has evidence behind it.

## Definition of done for a bot task

A task is not done because the bot says it is. It is done when:

- the acceptance criteria are met;
- behavioral changes have a test that would fail without the change;
- `pnpm typecheck` passes;
- targeted tests pass, and the full suite passes before merge;
- Android changes compile and their unit tests pass;
- no secret, token, or production path was added to the diff;
- docs are updated when user-visible behavior changes;
- the diff is reviewable and has a rollback story for risky changes.

## Anti-patterns

- **The self-development loop with no review.** A bot editing its own harness,
  merging, deploying, and restarting itself is not dogfooding; it is an
  unreviewed production incident waiting to happen.
- **One giant prompt.** Large, vague tasks produce large, vague diffs.
- **Multiple bots in one worktree.** They overwrite each other and create
  conflicts that look like model failures.
- **Trusting the bot’s own summary.** Read the diff and the test output.
- **Running the full suite after every tiny edit.** Use targeted tests during
  the loop, then the full suite before merge.
- **Letting the maintainer bot restart `kodbot.service`.** It can kill the turn
  and the tools it depends on.
- **Giving a development bot production credentials “just for testing.”**

## How to decide whether it is working

After two weeks, compare:

- first-pass success on scoped tasks;
- how often a human has to rewrite the bot’s diff;
- review time per merged change;
- escaped bugs found after merge;
- cost per merged change;
- security or data incidents (the target is zero).

If rework is high, narrow the bot’s scope and improve the task brief before
adding more autonomy. If rework is low, expand from docs and tests to feature
slices, then to branch creation and PR preparation. Keep the human merge gate.

## Rollout plan

**Week 1 — observe.** One maintainer bot, one worktree, documentation and tests
only. Human reviews every diff.

**Week 2 — implementation.** Small bug fixes and feature slices with tests.
Still one bot, still one worktree.

**Week 3 — prepare, do not ship.** Let the bot create branches and prepare pull
requests. Human merges. Human deploys.

**Later — parallelism.** Multiple bots may work in separate worktrees on
independent tasks. They must not share a checkout, a branch, or a data
directory. A human still owns merge and release.

## Verdict

Using KodBot to develop KodBot is a good idea because it dogfoods the product
under real conditions and gives the model the tools that make agent work
useful. It becomes a bad idea when “switch” means handing over architecture,
security review, merge approval, and deployment.

The durable rule is:

> **KodBot can be the best developer in the room. It should not be the only
> reviewer in the room.**
