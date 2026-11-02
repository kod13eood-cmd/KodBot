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
- **Per-bot model picker with capability icons.** Every model shows small
  **text, vision, audio, image, video, and reasoning** badges so the choice is
  readable before you pick it. OpenCode **Zen** and **Go** are separate sections
  in both the picker and the Auto pool.
- **Auto model routing.** Complex work goes to the strongest configured model;
  short simple requests go to the fastest/free one. Each bot can use an
  explicit **Auto model pool** — a hand-picked list that may span engines. An
  empty pool keeps routing inside the current engine.
- **A real computer per bot.** A cloud Linux desktop, the local machine, or a
  shared room computer. Watch the live screen or take over.
- **Approvals before risky actions.** Shell commands, file edits, and questions
  surface as inline cards: Allow, Deny, or answer in chat.
- **Rooms.** Put several bots in one conversation with a shared bulletin and
  an optional Chief of Staff.
- **Tasks and branches.** Each bot keeps separate tasks; edits and rewinds
  branch the transcript instead of destroying history.
- **Remote mode.** Point the desktop app at a KodBot server that stays on 24/7.
- **Voice.** Bots can read replies aloud and hold a call-style conversation
  with an ElevenLabs key. On-device dictation on macOS.
- **Connected apps.** A marketplace over Composio: Gmail, Slack, GitHub,
  Notion, Linear, Stripe, Aircall, AgentMail, and hundreds more.

## What's new in this build

### Bot body shapes — Live

Ten silhouettes instead of one triangle: **Orb, Bubble, Pill, Hex, Diamond,
Star, Drop, Shield, Ghost, Classic**. Existing bots get a stable shape
automatically; every bot can change it in **Bot settings → Shape**. Faces,
blinking, gaze, role badges, and animations work on every shape.

### Pages — Live

A bot can build a private, self-contained HTML page: a dashboard, checklist,
report, or visual comparison. Pages live in the bot's workspace, open in a
sandbox that cannot read the chat or credentials, and appear in the chat as a
preview card with an **Open page** action as soon as the turn that wrote them
finishes. The same list remains under **Bot settings → Pages**.

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

### Connected Apps with readable identities — Live

The Connected Apps marketplace now includes **1Password, Stripe, Aircall,
AgentMail, All Images AI, and HeyGen** under their real names, alongside the
rest of the catalog. Hover any app to read its full description before
connecting. These are ordinary Connected Apps, not a separate “Grok” section.

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
| Connected apps and provider setup | Sidebar → Connected apps (hover an app for its full description) |
| Shortcuts | `Cmd/Ctrl+/` or App Settings → Keyboard shortcuts |
| Remote server | App Settings → Server |
| Models and engines | App Settings → Engines / bot Model picker |

## Demo script for ads and the website

1. Show the bot roster: different colors, roles, and body shapes.
2. Open one bot, switch its model, and show memory.
3. Ask for a dashboard; open the generated Page.
4. Ask to compare three products; show the product cards and Buy now link.
5. Toggle Auto model and run a short question vs. a complex task.
6. Open Connected Apps and hover apps like 1Password, Stripe, Aircall, and AgentMail to show their full descriptions.
7. End on the approval card: the bot asks before it acts.
