# KodBot feature catalog

This is the canonical, marketing-ready list of what KodBot does and what each
feature needs. Use it for the website, App Store copy, ads, and demos.

Status keys:

- **Live** — works in the current app without a new provider account.
- **Connected app** — real integration; the user must connect their own account
  in **Connected Apps**.
- **Platform** — needs a platform that does not exist yet (for example an iOS app).

## Core product

- **A roster of agents, not one chatbot.** Every bot is a contact with its own
  name, role, face, body shape, voice, model, computer, memory, and apps.
- **Bring your own agents.** Runs on the `claude`, `codex`, `grok`, and
  `opencode` CLIs you already use, with your existing logins and subscriptions.
- **Local-first.** The harness, transcripts, keys, and events stay on your
  machine (`~/.kodbot`) or on a server you control.
- **Local or hosted first run.** The desktop app asks whether to run on this
  computer or connect to a remote server. A remote address can be a KodBot
  harness or a **KodBot gateway**; the gateway opens its email/password login
  and keeps the session for the app.
- **Per-bot model picker with capability icons.** Every model shows small
  **text, vision, audio, image, video, and reasoning** badges so the choice is
  readable before you pick it. OpenCode **Zen** and **Go** are separate sections
  in both the picker and the Auto pool.
- **Auto model routing.** Code and screen work go to the strongest available
  model (screen work prefers a vision model). A short simple question stays on
  that model unless the bot's **Economy mode** is on, then it may use a
  faster/free one. Each bot can use an explicit **Auto model pool** — a
  hand-picked list that may span engines. An empty pool keeps routing inside
  the current engine.
- **A real computer per bot.** A cloud Linux desktop, a shared **Local VM**
  (Cua in Docker/Podman, with one durable workspace), or the local machine.
  Auto picks a cloud box, then the local computer, then the prepared Local VM.
  Open the shared desktop in a full-window viewer with full screen, or take
  over with the mouse and keyboard while the bot watches the same screen.
- **Approvals before risky actions.** Shell commands, file edits, and questions
  surface as inline cards: Allow, Deny, or answer in chat. A bot's own question
  can offer 2–5 one-tap answers, with a free-text field for anything else.
  Claude, Codex, and OpenCode's `question` tool share the same card. Every permission
  card explains in plain language what the action will do and why it needs
  approval, with a risk level and task context, and an unanswered card
  (including a bot-to-bot contact request) can be marked overdue without
  auto-denying; a late Allow still lets the bot finish the work.
- **Rooms.** Put several bots in one conversation with a shared bulletin and
  an optional Chief of Staff.
- **Visible bot-to-bot handoffs.** When a bot hands work to another bot, the
  source chat gets a result or failure card and the full exchange stays in the
  shared `A ⇄ B` room.
- **Tasks and branches.** Each bot keeps separate tasks; edits and rewinds
  branch the transcript instead of destroying history. On desktop, right-click
  a task for **Rename / Archive / Delete**. Android's bot menu lists **Tasks**
  with the same actions, new-task and archived-task restore, next to **Pages**.
- **Remote mode.** Point the desktop app at a KodBot server that stays on 24/7.
- **Voice.** Local click-to-talk dictation (faster-whisper) and Piper text to
  speech on the harness, with no audio leaving the machine. The web composer,
  the Electron desktop app, and the native Android chat all use it; Android
  Desktop mode uses the web control. **App Settings → Voice** has a microphone
  test, a speaker test, and an **Auto / Bulgarian / English** recognition
  language selector. The audio-lines button records a **voice note**, shows a
  player before sending, and attaches the clip so the bot can open it; a
  transcript is added when local speech-to-text is available. Android's native
  composer has its own voice-note button with playback. Voice capture needs
  HTTPS or the localhost desktop app. While Whisper works, the composer shows
  a transcribing spinner, elapsed seconds, and a CPU-time hint; Android shows
  the same progress row. Bulgarian recognition uses the small Whisper model
  and beam search 5, trading CPU time for accuracy. ElevenLabs
  remains available for cloud voices; macOS also has native on-device
  dictation.
- **Record workflow.** Record a human demonstration in the Local VM viewer:
  pointer/key events plus periodic screenshots are saved under the durable
  workspace, and the bot can read them into a reusable workflow in memory.
- **Connected apps.** A marketplace over Composio: Gmail, Slack, GitHub,
  Notion, Linear, Stripe, Aircall, AgentMail, and hundreds more.
- **Bilingual in-app guide.** A book icon at the bottom of the sidebar opens
  the full user guide in English or Bulgarian; the same content lives in
  `docs/USER-GUIDE.md`. Every bot workspace also gets `KODBOT-GUIDE.md`, so
  agents can read the same guide and answer how-to questions with exact steps.

## What's new in this build

### Hard spending caps — Live

- Per-bot **daily** token and USD caps, plus one **monthly** app-wide pair.
  Empty or 0 means off, so caps are opt-in.
- The harness records every settled turn in a local append-only ledger and
  checks the current windows before dispatch. The running turn always finishes;
  the next turn is refused with a clear message.
- Bot settings shows today’s spend; Settings → General shows this month’s
  total and the app caps.

### Shared knowledge — Live

- **Settings → Knowledge** holds a global book for every bot and a separate
  book for each team: who the owner is, the mission, active projects, skills,
  preferences, people, and longer topic notes.
- Every turn gets the compact core plus a topic index. The full book is
  snapshotted into each bot's private workspace (`shared-knowledge/`) and read
  on demand, so a large knowledge base does not flood the context.
- Bots propose durable facts in their reply; the book button on a bot message
  opens a prefilled editor. A person edits and approves; nothing is saved
  automatically. Team books are visible only to that team.
- Core and topics are scrubbed for content-shaped secrets before saving.

### Public changelog — Live

- A dated, English changelog at **`/changelog`** on the harness, reachable
  without an account. The source is `CHANGELOG.md` in the repo and ships with
  the server bundle. About → Public changelog opens it.

### Skill routing and Economy — Live

- Each Auto turn is classified as **code**, **screen**, **translate**, or
  **general**. Code stays on a strong model; screen work prefers a model with
  vision; a short translation or simple question drops to a fast/free model
  only when **Economy mode** is on.
- Economy is a per-bot toggle under **Auto model**, off by default, on desktop
  and Android. The last skill and model are recorded on the task and shown in
  the usage chip.

### Paused routine offers — Live

- After a finished turn with at least two tool steps, the bot can offer **Save
  this as a routine?** with an editable prompt and time. The offer is opt-in per
  bot (**Suggest routines**, off by default).
- Saving creates a **paused** one-time routine; it does not arm the clock.
  Skipping leaves the transcript untouched. Scheduled and automated runs never
  offer one.

### Team-shared cloud computer — Live

- A bot that belongs to a team can turn on **Share the cloud computer with the
  team** in Bot settings. Teammates then use the same Box machine, browser
  logins, and files.
- Off by default; every bot without a share keeps its private computer. The
  scope is resolved on the server for status, provisioning, exec, and
  screenshots.

### Bulgarian on Android — Live

- The Android app has a full Bulgarian interface and a **Language** switch in
  Settings. A fresh install follows the phone language; the choice is stored on
  the device. The same release adds **Send now** on queued messages and the
  full global/team **Knowledge** editor.
- The desktop already had EN/BG; this release fills the remaining main panels,
  approval cards, update banner, room settings, calls, and server-authored
  cards (Work alone and routine offers).

### Faster follow-up turns — Live

- ACP engines (Grok, Gemini, Kimi, Droid, Hermes, Qwen, OpenCode, OpenCode Go) keep their process warm for 10 minutes after a successful turn. The next message prompts the same session instead of spawning the CLI and loading the session again.
- Up to four processes stay parked per engine. A different working folder, model, MCP tool set or environment, or permission policy starts a fresh process; an idle or failed session is evicted.
- The stable system layer (persona, guide, contracts) is sent once per prompt-style session. Memory, page lists, computer notes, tagged teammates and webhook notes ride every turn; resumed sessions no longer repeat the standing block as if the user had typed it.
- When a fresh engine has to replay the thread, a short recent-tool trace is included, so the model knows what was already tried without a screenshot replay.

### Work alone — Live

- A per-bot toggle in **Bot settings**. When a turn stops with an open checklist or a denied tool, the bot continues once on its own after two seconds.
- It does not widen approvals. Destructive commands, secrets, sudo, payments and outbound calls still ask a person; the follow-up turn is marked unattended, which turns automatic approval **off** rather than on.
- If the follow-up is still unfinished, the bot posts a **This still needs you** card and waits for the person. A new message from the person resets the one-retry budget.
- Off by default; desktop setting only for now (Android parity is planned).

### Bot body shapes — Live

Ten silhouettes instead of one triangle: **Orb, Bubble, Pill, Hex, Diamond,
Star, Drop, Shield, Ghost, Classic**. Existing bots get a stable shape
automatically; every bot can change it in **Bot settings → Shape**. Faces,
blinking, gaze, role badges, and animations work on every shape.

### Pages — Live

A bot can build a private, self-contained HTML page: a dashboard, checklist,
report, or visual comparison. Pages live in the bot's workspace, open in a
sandbox that cannot read the chat or credentials, and appear in the chat as a
preview card as soon as the turn that wrote them finishes. Clicking the preview
opens the page in an in-app viewer; the small top-right icon opens it in the
normal browser. The same list remains under **Bot settings → Pages**. A page
can offer a file to download: the desktop app asks where to save it, shows a
progress card with the final path, and can reveal it in the file manager;
browsers use their own download UI. The bot
also receives the page title, file path, and a bounded text excerpt in its
conversation context, so a later turn can continue from what it built without
re-reading the file.

**Public address** (App Settings → General) is the origin other devices use to
reach this harness. Page cards, copied links, and the links bots write use it,
so a page opens on a phone or another computer instead of pointing at
`127.0.0.1`; an empty setting falls back to the address the window was opened
with. The in-app preview keeps the window's own origin so it still works when
the public name is only resolvable elsewhere. Android has the same page cards
plus a **Pages** list in a bot's chat header, opening each page in a full-screen
WebView through the paired companion. Those companion routes are read-only;
the phone cannot create, edit, or delete a page. A page can submit a form back to its bot: the answers
arrive as a user message in that bot's chat and the in-app viewer closes.

### Queued prompts — Live

Sending while a bot or room is busy no longer drops a stale bubble into the
chat. The prompt waits in a floating queue above the composer, where it can be
discarded, and it is sent one at a time as each turn finishes. The queue lives
outside the chat, so switching bots or rooms does not lose it.

**Send now** on a queued prompt joins the running turn when the engine supports
mid-turn steering (ACP `_session/steering`, Codex `turn/steer`) — the bot can
change course without stopping. Engines without it keep the message in the
persistent steer-queue and run it at the next safe point, the end of the turn.
Press **Enter on the focused queued card** or use its send button.

### Developer mode — Live

**Settings → General → Developer mode** hides the technical surfaces for
everyday use: token counts, the API keys in **Connections**, the bot and room
working-folder paths, the per-turn usage chip, and the **Inspector** button. It
is a per-client preference and starts off, so a fresh window is clean; turn it
on when you need to inspect a driver or manage keys.

### System tray — Live

The desktop app keeps a KodBot icon in the system tray with **Open KodBot** and
**Quit KodBot**. The application menu is removed on Linux and Windows, so
pressing Alt no longer drops a File/Edit/View bar over the window.

### Window chrome — Live

On Linux the desktop window is frameless: minimize, restore, and close float in
the top-right corner over the app instead of sitting in a system title bar. The
floating controls step aside while a side panel (bot settings, computer,
inspector) or a full-screen modal (guide, app settings, connected apps) owns
that corner, so the panel's own X is the only one there and stays clickable.
The header strips are the drag handle. The application menu stays removed, so
Alt does not open it, while **Ctrl+R** reloads, **Ctrl+Shift+R** force-reloads
(useful after a server UI update), and **Ctrl+Shift+I** opens the developer
tools.

### Reply to a message — Live

Hover a message and press the reply arrow. The composer shows a quote card, and
sending carries a bounded excerpt of that message with the new prompt — so the
bot knows which answer you mean even after the next turn has already started. A
reply queued while the bot is busy keeps its quote and goes out with the queued
prompt.

### Flexible schedules — Live

Automations can run once, daily at a chosen time, or **on an interval** — every
5 minutes up to once a day — optionally only inside a time window (for
example 09:00–18:00) and on selected weekdays. A slow turn never stacks runs:
the next slot waits for the current one to finish. Routine-created tasks are
marked **Scheduled** in the task picker, and a failed or missed run raises a
notification and stays in the **needs you** strip until it is opened.

### Worker bots for automations — Live

A schedule or webhook can name a **worker bot**. The owner bot keeps the
automation; the worker runs each run in its own detached task with its own
context, so background work never replaces the chat you are using. When the
worker finishes, the owner gets an `<automation> · Results` task, an unread
badge, and a notification. A run whose last line is `NOTHING NEW` stays
silent, and no report is ever injected into an active turn. Old tasks can be
archived from the task picker without deleting their transcripts.

### Questions with one-tap answers — Live

A bot that needs a decision asks with 2–5 tappable options instead of a
paragraph you have to answer in prose. Claude's `ask_user`, Codex's question
requests, and OpenCode's `question` tool all land in the same card: tap an
option, or type a different answer. OpenCode needed an ACP form-elicitation
bridge; without it the model was told the client could not show the question
and silently fell back to text. Multi-question forms are asked one card at a
time, and an unanswered question follows the same approval timeout.

### Automation reports — Live

Scheduled and manual automations run on a dedicated worker bot when one is
assigned. When a run finishes, a compact summary — date, the useful result, and
**See full run** — is appended to the owner’s permanent **Главен чат**. The main
chat is never activated or switched; if the owner is mid-turn, the report waits
until the turn settles. Webhook automations keep a separate `· Results` task so
an external alert stream cannot flood the main chat. The task carries an unread
dot until its report is opened, and the full worker run stays one click away.
If the worker wrote a dashboard or report page during the run, the summary
carries it as a page card, so the page opens right where the report is.

### About — Live

**Settings → About** shows the version of the running harness and the
components it relies on: Node, platform/architecture, the desktop shell's
Electron/Chromium/Node versions, every available engine CLI with the version
probed from its own `--version`, and the local speech stack (faster-whisper,
Piper or ElevenLabs). A remote desktop and server on different versions are
called out explicitly.

### Activity — Live

If the harness restarts while a turn is running (a deploy, a crash, a machine
restart), the bot's transcript gets a visible interruption note instead of
going quiet with no answer; the next message continues from there.

**Activity** in the sidebar collects scheduled, webhook, delegated, and live
jobs in one place: needs attention, running, and done. Each row names the bot,
shows the result or error, and links to the task or shared `A ⇄ B` channel.
This is the single view for “what is running, who owns it, and how did it end?”
without adding more panels to the chat.

### Loading feedback — Live

A branded boot screen covers the first harness snapshot, and switching bots or
rooms shows a chat-shaped skeleton with the target's name until the transcript
paints. Large transcripts no longer make the window look frozen; the sidebar
stays responsive while the chat catches up.

### Notifications — Live

A bot that cannot continue — a command or file approval, a question — raises a
native desktop notification that stays on screen until it is answered, plus a
persistent **needs you** strip at the top of the app. A scheduled run that
fails or is missed also raises a notification and joins that strip. A finished
reply notifies too when the window is on another chat or in the background.
Clicking a notification opens the bot, room, or routine task that asked; the
app title and badge count the blocked conversations. Each bot's
**Notifications** switch still gates its own notifications.

### Shopping cards — Live

A bot can emit a `products` block and KodBot renders real product cards with an
image, price, store, rating, review count, and a **Buy now** link. The link
opens the merchant; KodBot never fakes a checkout or claims a purchase
completed.

### Memory import — Live

**Bot settings → Memory → Import memory** gives the user a prompt to paste into
ChatGPT, Claude, or another assistant, then imports the answer into `MEMORY.md`
or a `memory/<topic>.md` file.

### Keyboard shortcuts — Live

`Cmd/Ctrl+/` opens one sheet with every app-wide shortcut. It also has a
visible row in **App Settings → Keyboard shortcuts**.

### Teams with leaders and membership — Live

A team is a real object with a **leader** and an explicit member list. Only an
ungrouped bot can create one; the creator becomes leader and first member. A
bot can belong to **one team at a time**. The leader or a human can add
ungrouped bots; members can leave. The leader must transfer leadership before
leaving.

Open **Plus → Manage teams** to create teams, add/remove members, transfer
leadership, rename, or open/create the optional team room. Each bot also has a
**Team** card in **Bot settings**, showing its team/leader plus Join/Leave and
Manage teams. A Chief of Staff who belongs to a team is shown inside that team
section, not in a separate slot above it. New team imports
create their team automatically. Existing rooms whose members all belong to one
team are attached to that team automatically. Ungrouped bots stay under
**Other bots**. Moving between teams is leave, then join the new team. The
sidebar team heading names the **Lead**, and the leader's row carries a
**Team leader** badge. The Android companion mirrors this: its fleet groups by
room/team/other bots, **Settings → Teams** can join, leave, create, and transfer
leadership, and each bot's Auto pool and model capability badges are available
there too.

A team leader that fans work out with `delegate_bot` collects the replies in one
follow-up turn after the last teammate finishes. The follow-up carries the
replies into the leader's context and is not allowed to delegate again, so a
team cannot accidentally recurse. The individual exchanges remain in their
`A ⇄ B` channels, and the Activity view keeps each handoff's result.

### KodBot Solo and KodBot Business — Live

First launch asks how KodBot will be used. **KodBot Solo** keeps everything on
this computer: local harness, local keys, no account, free. **KodBot Business**
connects the same app to an organization's gateway and signs in through the
browser. The mode is reversible in **Settings → General → Usage mode**, and the
current edition is derived from the server: a signed-in gateway account is
Business; a local or personal harness is Solo. Shared bots across accounts,
per-speaker billing, and an organization key are not part of this first slice.

### Connected Apps with readable identities — Live

The Connected Apps marketplace now includes **1Password, Stripe, Aircall,
AgentMail, All Images AI, HeyGen, and Google Search Console** under their real
names, alongside the rest of the catalog. Hover any app to read its full
description before connecting. These are ordinary Connected Apps, not a
separate “Grok” section.

Every new connection asks for a name first. The name is stored as the account
alias, so several Gmail, Slack, or Search Console accounts stay distinguishable
in the marketplace and in each bot's access list.

The panel checks the **whole catalog**, not only the first featured rows, so a
connected app such as Alpaca appears under **Connected** and opens **Details**
instead of offering a second connection. Accounts are sorted with active rows
first, expired rows stay removable, and **Disconnect app** revokes every
account, including expired ones. Access is still granted per bot; when some
bots are switched off, the panel offers **Allow for all bots**. Every bot is
also told about this switch, so it points to **Bot settings → Connected apps**
(or the panel's **Allow for all bots** button) instead of claiming the app is
not connected.

## Grok Bot parity

| Feature | Status | What the user gets | What it needs |
| --- | --- | --- | --- |
| Vault for cards and logins | **Connected app** | Bot uses a password manager without asking the model to read raw secrets | Connect **1Password** |
| Shopping cards | **Live** | Product cards with image, price, store, rating, and merchant link | Nothing |
| Stripe Pay / transfers | **Connected app** | Bot prepares payments through Stripe | Connect **Stripe**; Stripe Pay beta availability depends on Stripe |
| Bot calls | **Connected app** | Bot places a call through Aircall and brings notes back | Connect **Aircall**, a number, and call permissions |
| Bot-created pages | **Live** | Private HTML dashboards and reports | Nothing |
| iPhone app actions | **Platform** | Home, Reminders, Contacts, Alarms, Calendar | An iOS app with App Intents and permissions |
| Memory import | **Live** | Bring context from another assistant | Nothing |
| Best-model routing | **Live** | Strongest model for hard work, fastest for short asks; optional per-bot model pool | At least one configured engine |
| Bot email | **Connected app** | Programmable inbox, messages, drafts, and address | Connect **AgentMail** (or Gmail/Outlook for a personal mailbox) |
| Image generation | **Connected app** | Generate images and attach them in chat | Connect **All Images AI** |
| Video generation | **Connected app** | Generate short avatar videos | Connect **HeyGen** |
| One shortcut sheet | **Live** | Every command in one place | Nothing |

## Safety and honesty

- **No fake payments.** A card's Buy now opens the merchant. Stripe actions ask
  for explicit confirmation of the amount and recipient before money moves.
- **No fake calls.** A call needs a real telephony account and number; KodBot
  asks before dialing.
- **No invented mailbox.** Bot email is an AgentMail/Gmail/Outlook connection,
  not a KodBot-hosted address.
- **No invented product data.** The product-card prompt tells bots to use real
  search/connected-app results and never invent prices, ratings, or stock.
- **Provider accounts are the user's.** KodBot does not create Stripe,
  Aircall, AgentMail, 1Password, All Images AI, or HeyGen accounts.

## Where things live in the app

| Area | Path |
| --- | --- |
| Bot identity, shape, expression, color | Bot settings → Bot |
| Pages | Bot settings → Pages |
| Memory and import | Bot settings → Memory |
| Auto model and model pool | Bot settings → Model → Auto model → Choose models |
| Teams, leaders, membership, team rooms | Sidebar → Plus → Manage teams |
| Scheduled, delegated, and live jobs | Sidebar → Activity |
| Connected apps and provider setup | Sidebar → Connected apps (hover an app for its full description) |
| Shortcuts | `Cmd/Ctrl+/` or App Settings → Keyboard shortcuts |
| Remote server or gateway | App Settings → Server |
| Models and engines | App Settings → Engines / bot Model picker |

## Demo script for ads and the website

1. Show the bot roster: different colors, roles, and body shapes.
2. Open one bot, switch its model, and show memory.
3. Ask for a dashboard; open the generated Page.
4. Ask to compare three products; show the product cards and Buy now link.
5. Toggle Auto model and run a short question vs. a complex task.
6. Open Connected Apps and hover apps like 1Password, Stripe, Aircall, and AgentMail to show their full descriptions.
7. End on the approval card: the bot asks before it acts.
