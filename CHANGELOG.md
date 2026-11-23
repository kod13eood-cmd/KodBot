# KodBot changelog

Dated, user-facing changes. Newest first.

## 2026-11-23 — 0.1.67

- **KodBot Business — live shared conversations.** The owner can publish a bot as a **live shared conversation**. Every signed-in member sees and can use the same thread from **Settings → Shared bots → Open conversation**; messages are attributed by member and the bot keeps one history. Existing template copies stay independent.
- Live shared bots run on a dedicated shared harness with its own data directory, not in a member's workspace. The organization OpenCode key is passed only to that harness (`OC_ORG_OPENCODE_API_KEY` in the gateway env file); it never reaches a member's tenant. Free OpenCode models work without a key.
- **Usage by member:** the gateway records each shared turn's input/output tokens and estimated USD against the speaker. The owner sees the totals in the shared conversation panel. No payments or invoices are created.
- Member harnesses no longer inherit the gateway's provider API keys.

## 2026-11-23 — 0.1.66

- **Windows Solo first start:** the bundled OpenCode is added to the user PATH, so `opencode` works in a new cmd/PowerShell without a separate install. KodBot's sign-in command also points at the bundled executable, so it no longer depends on npm or PATH.
- Free OpenCode models work without an account, so a fresh install is ready to chat. Signing in is optional and only unlocks paid models; the in-app **Open OpenCode sign-in** button runs the bundled login, and paid-model failures show the sign-in card.
- **Gateway:** a wrong browser password now returns to the login form with a translated error instead of a black JSON screen. Signed-in Business users get **Settings → General → Account → Change password** with current-password verification; all sessions are signed out after a successful change.

## 2026-11-23 — 0.1.65

- App Settings → General → **Language** now has a **New bot names** choice: **Match the app language** (default), **Bulgarian names**, or **English names**. With Bulgarian selected, a new bot gets a Cyrillic Bulgarian name and a Bulgarian greeting; English keeps the original pool. Existing bots are never renamed.
- The choice is per window, like the interface language, and applies to the next bot created with **+ → New Bot**.

## 2026-11-23 — 0.1.64

- **User mode** keeps one calm status line through the whole turn, not only before the first sentence. It names what the bot is doing — thinking, searching, reading, writing, editing, running a command, asking the team, using the computer, or writing a reply — with an animated action icon, a soft sheen, and a timer. When a sentence lands and the bot pauses for its next tool, the line changes to that next action instead of leaving only a blinking caret.
- **Developer mode** still shows the full process: the extended reasoning, expanded by default, and every tool/action chip.
- The queued-message panel stays above the composer in normal flow, collapsed to one line until opened, so it cannot cover the current reasoning or actions.
- Windows installers now list **Kod 13 Ltd** as Publisher (previously a personal name). The Linux deb maintainer uses the same legal name. No `publisherName` is added to the unsigned build, so auto-update keeps working.
- **Windows and Android app icons** now use the same mint K monogram as Linux. Android is **0.1.29** (versionCode 30) so installed phones are offered the update. A real uninstall now resets only the first-run Solo/Business routing, so a fresh install asks again; updates keep the saved choice.

## 2026-11-22 — Calm process view

- The queued-message panel now sits **above the composer in normal flow** instead of floating over the chat. It is collapsed to one line by default and expands on demand, so it no longer hides the current thinking or tool activity. The transcript stays pinned to the latest row when the composer grows.
- **User mode** shows one human progress line — the latest narrated action and a timer — while the bot works. Raw tool chips and the model's extended reasoning are hidden; handoffs, delegation replies, and errors stay visible.
- **Developer mode** shows the full thought process expanded by default, plus every tool action, alongside the transcript.

## 2026-11-22 — 0.1.63

KodBot Solo and KodBot Business, shared bot templates, and OpenCode included.

- First launch asks **KodBot Solo** (local, private, free, no account) or **KodBot Business** (organization server, browser sign-in). Change it later in **Settings → General → Usage mode**.
- Business owners can publish a **shared bot template** from **Settings → Shared bots**: name, title, description, and core `MEMORY.md`, with common secret shapes redacted. Members install their own copy; turns run in their workspace with their own model, key, and quota.
- Packaged builds include **OpenCode 2.3.2** for the platform. The engine is pinned and updated with KodBot releases — it does not self-update. Add an OpenCode API key; new bots prefer the unified OpenCode engine.
- Team leaders now collect delegated replies — including peers outside their own team — in one follow-up turn. Page forms submit again.
- The hosted gateway has a bilingual login and an owner-only **Admin** area for users, invites, temporary passwords, disabling accounts, and session sign-out.
- Android remains **0.1.28** (versionCode 29).

## 2026-11-22 — OpenCode is included

- Packaged KodBot builds now include the official OpenCode CLI for the platform. There is no separate `opencode` install, no PATH setup, and no version to manage. Source checkouts stage it with `pnpm prepare:opencode`.
- The bundled engine is pinned (OpenCode 2.3.2) and updated **with KodBot releases**, never by silent self-update. KodBot still needs an OpenCode API key or other model access.
- Existing bots keep the engine they already use. New bots prefer the unified OpenCode engine when it is available and authenticated. A bot can still point at a different `opencode` binary in Engines.
- The OpenCode MIT notice ships in `LICENSES/OpenCode-MIT.txt` and beside the binary.
- Linux/macOS/Windows packaging stages the matching platform binary. The desktop installer grows accordingly; the Linux server needs the binary staged and `OC_EXTRA_PATH` set.

## 2026-11-22 — Team leaders collect cross-team replies

- Fixed a team leader going quiet after delegating to **bots outside its own team**. The collecting turn now starts for a leader's whole delegation batch, not only when a target is a member of that leader's team. Quill delegating to Watcher and Кари (both in other teams) is the case that exposed it.
- The follow-up still runs once per batch, carries the replies into the leader's context, and cannot delegate again in that turn.

## 2026-11-22 — Shared bot templates

- KodBot Business owners can publish a bot as a **shared bot template**. Only the name, title, description, and core `MEMORY.md` are shared; common secret shapes are redacted before the template leaves the owner's harness.
- Every member can install a shared bot into their own workspace. The copy is independent: turns run there, with that member's model, key, and usage quota. The gateway never executes a bot, so per-speaker billing stays natural.
- The Shared bots section is visible only in Business. It shows the published templates, the owner's publish controls, and the member's install action. Existing installed copies are not updated by later template changes in this version.
- This is the first shared-bot slice; live shared conversations, a single bot instance across accounts, organization-key proxying, and per-speaker billing for a live shared bot are still to come.

## 2026-11-22 — KodBot Solo and KodBot Business

- First launch now asks how you want to use KodBot. **KodBot Solo** runs the server on your computer: local, private, free, no account. **KodBot Business** connects to your organization's KodBot server and signs you in with your browser.
- The choice is reversible: **Settings → General → Usage mode** can switch between this computer and an organization server, and shows which edition the current server puts you in.
- This first slice is the edition choice, the organization connect flow, and the usage-mode card. Shared bots across accounts, per-speaker billing, and an organization key are still to come.

## 2026-11-21 — Team leaders collect delegated work

- A **team leader** that delegates tasks with `delegate_bot` now gets one follow-up turn when the last teammate finishes, carrying their replies, so it can synthesize the result instead of going quiet. The collecting turn cannot delegate again, which keeps the fan-out one hop deep.
- The follow-up waits if the leader is busy and runs when it is free; the full replies still live in each `A ⇄ B` channel.
- Fixed successful delegation jobs showing the error “Delegated turn did not finish” even when they completed.

## 2026-11-21 — Page forms work again

- Fixed **Send answers** (and every other form) on bot pages: the page preview sandbox now permits a form's own submit handler to run, so a question page can hand its answers back to the bot and close itself. A real form navigation is still blocked; the page can only post its text to the KodBot bridge.
- This applies to the chat preview, the full-screen page viewer, and the Pages tab in bot settings.

## 2026-11-21 — Gateway admin

- Settings has an **Admin** area for the gateway owner: list accounts, create and revoke one-time invites, give a member a temporary password, disable or enable an account, and sign out every session.
- The owner account cannot be disabled, and members never see the Admin tab or reach the admin routes.
- Temporary passwords and invite codes are shown once, with a copy button. Creating an invite can pin it to an email address and choose 1, 7, or 30 days.
- A locked-out person sees "Forgot your password? Ask the owner to reset it" on the login page, in English and Bulgarian.
- The Admin screen is translated into Bulgarian together with the rest of Settings.

## 2026-11-21 — Gateway login

- The hosted gateway login and registration page now supports **English and Bulgarian**. The switch is a real link, the choice is remembered in a cookie, and the page follows the browser language.
- Common sign-in and invite errors are translated too.

## 2026-11-20 — 0.1.62

- Hard spending caps: per-bot daily token and USD limits, plus app-wide monthly token and USD limits. Empty/0 means off. A turn that is already running always finishes; the next turn is refused with a clear “cap reached” error.
- Usage is recorded in a local append-only ledger (`usage-ledger.jsonl`), so daily and monthly windows survive restarts. Settings shows today’s bot spend and this month’s total.
- Server runtime moved to Node.js **24.22.3** (security patches through 11 Nov 2026); pnpm **10.34.9**. The harness, companion, and gateway run on the patched runtime.

## 2026-11-20 — 0.1.61

- Android 0.1.28: **Send now** on queued messages, and a full **Knowledge** editor for the global book and each team book (core + topics).
- Native Claude steering is available experimentally with `KODBOT_CLAUDE_STEERING=1`: stdin stays open, a second stream-json message can join the turn, and input closes after two minutes with fallback to the normal queue. Off by default until the CLI’s EOF behavior is verified.
- Shared knowledge editor includes a visible warning that the global book is readable by every bot; keep client-sensitive material in a team book or a topic.

## 2026-11-19 — 0.1.60

- Routine suggestions are now global + per-bot, off by default. Enable them in Settings → General or override them in Bot settings.
- **Send now** on a queued prompt: press Enter on the focused card or click the send button. ACP and Codex engines can join the running turn at a safe point; other engines queue it for the end of the turn. This lets you correct or extend the current task without pressing Stop.
- Fixed the team-shared cloud computer: provision, join, sleep, exec, and screenshot now resolve the same team scope as status and normal turns. Previously those actions still looked at the bot’s private box.

## 2026-11-19 — 0.1.59

- Shared knowledge: a global core for every bot (owner, mission, projects, skills, preferences) plus a separate book for each team. The compact core rides every turn; full topics are snapshotted into each bot’s workspace and read on demand.
- Knowledge editor in Settings, with Global and Team tabs, topics, a template, and secret redaction. Bots propose durable facts in chat; the book button on a bot reply saves a proposal after a person edits and approves it.
- Public dated changelog at `/changelog` (no login), backed by `CHANGELOG.md` in the repo and bundled with the server.
- The last English desktop panels are translated: Engines, Local Computer, the Local VM viewer, the team library, and the Inspector.

## 2026-11-19 — 0.1.58

- Skill routing: Auto classifies each turn as code, screen, translate, or general. Code and screen work stay on a strong model; screen work prefers vision.
- Economy mode: a per-bot toggle that lets short, simple questions use a faster or free model. Off by default on desktop and Android.
- Routine offers: a finished multi-step turn can offer “Save this as a routine?” with an editable prompt and time. Saving keeps it paused.
- Team-shared cloud computer: a bot in a team can share one Box machine, browser logins, and files with its teammates.
- Bulgarian on Android: a full Bulgarian interface and a Language switch in Settings. Android 0.1.27 / versionCode 28.
- Desktop EN/BG now covers the main remaining panels, approval cards, update banner, rooms, calls, engine setup, API keys, and the computer panel.

## 2026-11-19 — 0.1.57

- Warm ACP sessions: ACP engines keep their process for 10 minutes after a successful turn (up to four parked), so the next message continues the same session without reloading it.
- Prompt once: the stable system layer is sent once per prompt-style session; memory, pages, computer notes, tagged teammates, and webhook notes still ride every turn.
- Tool trace: a fresh replay includes a short diary of recently used tools.
- Work alone (off by default, Bot settings): one automatic continuation when a turn stops with an open checklist or a denied tool, then a “This still needs you” card. It never widens approvals.

## 2026-11-19 — 0.1.56

- Settings → About shows the running version and its components: Node, platform and architecture; the desktop shell’s Electron, Chromium and Node; every available engine CLI with its probed version; and the local speech stack.
- A remote desktop and server on different versions are called out.

## 2026-11-15 — 0.1.55

- A server restart or crash mid-turn no longer looks like a silent stop: the next startup appends a visible interruption note and marks the bot unread.

## 2026-11-15 — 0.1.54

- Android page file links download through Android’s DownloadManager, with progress in the notification shade and the file in Downloads.

## 2026-11-15 — 0.1.53

- Task menus on desktop and Android: rename, archive, restore, and delete from the task list.
