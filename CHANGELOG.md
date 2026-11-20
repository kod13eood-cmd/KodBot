# KodBot changelog

Dated, user-facing changes. Newest first.

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
