# Grok Bot upgrade parity plan

- Status: Phase 1 implemented 2026-11-01; external connectors blocked on credentials
- Source: [The NEW Grok Bot is Here (RoboNuggets)](https://youtu.be/P_hvEpI0twQ)
- Scope: the ten product updates in the video, mapped to KodBot's local-first
  architecture rather than copied interface-for-interface

## Summary

The video covers ten updates: a credential vault and agentic payments,
shopping/product cards, Stripe Pay, outbound bot calls, bot-created pages,
iPhone app actions, memory import, best-model routing, bot-owned email, and
image/video generation. It ends with a keyboard-shortcut sheet and visual
polish.

KodBot can ship three of the ten natively now, plus the closing shortcut
sheet, without inventing a provider relationship:

1. **Pages** — private, self-contained HTML artifacts the bot writes into its
   workspace and the user opens from Settings.
2. **Memory import** — a guided copy/paste migration from another assistant
   into `MEMORY.md` or a `memory/` topic file.
3. **Best-model routing** — a per-turn heuristic that chooses the strongest
   configured model for complex work and the fastest/free model for short
   requests.
4. **Keyboard shortcuts sheet** — one discoverable list, opened with
   `Cmd/Ctrl+/`.

The remaining seven are real external integrations. They are deliberately not
mocked: each needs an account, a credential, a platform capability, or a
merchant relationship that does not exist on the current host.

## Feature matrix

| Video feature | KodBot now | Gap / next step |
| --- | --- | --- |
| Vault for cards, logins, contacts | Provider keys live in the desktop-owned config; tool approvals are enforced per action. No card vault. | Add an OS-keychain-backed vault plus a one-time-card provider. Never expose raw PANs to the model or transcript. This is a security project, not a settings toggle. |
| Shopping cards with photos, ratings, price, store, Buy now | Connected Apps can reach merchant APIs; chat replies can already show structured cards. | Product-search and checkout tools need a merchant/affiliate API, and `Buy now` needs an approval + payment rail. Add when a store integration is chosen. |
| Stripe Pay / agent-to-agent transfers | Stripe is in the Composio catalog for ordinary Stripe tools. | Stripe Pay is a separate beta product. Requires a Stripe account enabled for it, API credentials, and a deliberate payment-approval UI. |
| Bot calls with notes and a summary | TTS can speak replies. KodBot does not place calls. | Telephony provider (for example Twilio) account, phone number, outbound-call approval, recording/transcript consent, and a call-result card. Without those, a "call" button would be a lie. |
| Bot-created pages | **Implemented.** `pages/*.html` in the bot workspace, sandboxed preview, list/copy-link/delete, prompt guidance. | Public team sharing needs an explicit publish/share surface. Today the copied link is only reachable by someone who can reach the KodBot server. |
| iPhone app actions (Home, Reminders, Contacts, Alarms, Calendar) | Android companion and desktop app exist; the default-deny companion API exposes chat and approvals, not phone capabilities. | Requires an iOS app with App Intents/Shortcuts, per-capability permission prompts, and companion routes. Android's equivalents are a separate follow-up. |
| Memory import from ChatGPT/Claude | **Implemented.** Settings → Memory → Import memory: copy the prompt, paste the answer, append/replace/`memory/<topic>.md`. | Direct provider export/OAuth import would need stable provider APIs and user consent. Copy/paste is provider-neutral and works today. |
| Best model for the job | **Implemented.** `server/model-routing.ts` scores the configured catalog per turn; the routed choice is persisted so usage and the picker reflect what ran. | A developer override and richer cost/latency signals can come later. The router never calls unconfigured providers, including Midjourney/Suno. |
| Bot-owned email address | Gmail/Outlook are available as Connected Apps when the user authorizes them. There is no hosted `@bot` mailbox. | Either a hosted mail domain/provider (Resend, Postmark, Fastmail, etc.) or a Gmail account dedicated to the bot. Needs DNS/domain control, credentials, and send/receive approval policy. |
| Image/video generation | Engines can use whatever media tools they are given, but KodBot has no media-generation provider configured. | Add an image/video provider adapter (xAI, OpenAI, Replicate, fal, etc.), key storage, cost caps, and an attachment card. Requires an account and API key. |
| Shortcut sheet / visual polish | **Implemented.** `Cmd/Ctrl+/` opens a sheet grouped by Navigation and Chat. | Add more chords only when they earn their place; keep the sheet as the single source of truth. |

## Phase 1 implementation notes

### Pages

- `server/pages.ts` owns the filesystem contract: safe `*.html` names, a 2 MB
  cap, title extraction from `<title>`/`<h1>`, list/read/write/delete.
- Routes:
  - `GET /api/bots/:id/pages`
  - `GET /api/bots/:id/pages/:name`
  - `PUT /api/bots/:id/pages/:name`
  - `DELETE /api/bots/:id/pages/:name`
- Served documents use a sandbox CSP (`sandbox allow-scripts`, no same-origin,
  no network connections) and the preview iframe uses `sandbox="allow-scripts"`.
  A generated dashboard cannot read the app's session or credentials.
- `pagesSystemPrompt()` tells the bot where to write and when a page is better
  than a wall of chat. Group-room turns get the same guidance.
- Settings shows a Pages card with refresh, open preview, copy link, and delete.

### Memory import

- `POST /api/bots/:id/memory/import` accepts `{ text, mode, topic? }`, where
  mode is `append`, `replace`, or `topic`.
- The same `isMemoryTopicName` gate used by the memory reader applies to imports,
  so a pasted name cannot escape `memory/`.
- The Settings modal includes the exact prompt to give another assistant, a
  paste box, the three destinations, and an irreversible-replace confirmation.
- Topic mode appends `.md` when the user omits it.

### Best-model routing

- `chooseAutoModel(prompt, options, fallback)` in `server/model-routing.ts`.
- Complex signals: at least 500 characters, a fenced code block, or task words
  such as code/debug/architecture/research/security/plan/design.
- Short simple requests (at most 220 characters, no code, no hard-task words)
  prefer `free` and fast-labelled models.
- Candidates are the models of the engine the user already chose, from
  `registry.describe()`, and exclude an unavailable / unauthenticated engine.
  The current selection is a fallback, so a catalog refresh failure never
  blocks a turn. Cross-engine routing is deliberately out of scope: changing
  the engine changes which provider receives the prompt and where the turn
  runs, which needs explicit consent rather than a heuristic.
- The bot's `autoModel` flag is stored on the bot, toggled in Settings, and
  routed on every non-cloud 1:1 turn. Room turns keep their per-bot picker
  choice so a shared conversation cannot silently swap models between members.
  The routed 1:1 model is written back to `modelSelection`, so the picker and
  usage receipt show what actually ran.
- Cloud-routine turns keep their configured cloud instance; the router does not
  silently move a turn out of a Box VM.

### Shortcuts

- `Cmd/Ctrl+/` toggles a focused, Esc-closable sheet. It sits above other
  dialogs and traps Tab inside itself.
- Rows cover: palette, new bot, jump to 1–9, previous/next bot, the sheet itself,
  send, newline, edit-last-message, room bulletin, and Esc.
- The macOS glyphs become `Ctrl`/`Shift` elsewhere.

## Credential and platform blockers

The following are absent on the current host and cannot be truthfully shipped
by writing UI alone:

- A payment account enabled for Stripe Pay, plus card vaulting/one-time-card
  provisioning.
- A telephony account and number (for example Twilio) with consent-aware call
  recording/transcription.
- An image/video generation API key and a chosen cost cap.
- A hosted mailbox domain or a dedicated Gmail account with broker scopes.
- An iOS app target plus App Intents and the matching companion allowlist
  entries. Android cannot substitute for Apple Home/Reminders/Contacts.
- A merchant/product API and checkout agreement for shopping cards.

`wrangler whoami` is currently logged out, so changes to the managed Composio
broker (per-account removal, provider email exposure) are also blocked until
Cloudflare auth is restored.

## Verification

- `pnpm typecheck`
- `pnpm vitest run server/pages.test.ts server/workspace.test.ts server/model-routing.test.ts`
- Full suite: `pnpm vitest run`
- Build: `pnpm build` and `pnpm build:server`
- Remote smoke test after deploy:
  - create a page through a bot/tool, confirm it appears in Settings → Pages,
    previews under the sandbox CSP, and deletes;
  - import a short memory summary in append and topic modes, confirm
    `MEMORY.md` / `memory/<topic>.md` and the UI list;
  - toggle Auto model, run a short prompt and a complex prompt, confirm the
    picker/usage shows the routed models;
  - press `Cmd/Ctrl+/` and confirm the sheet opens, traps focus, and closes on
    Esc.

## Follow-ups, in priority order

1. Decide the payment boundary. A vault without a payment rail is not useful;
   a rail without a vault is unsafe. Start with a threat model and approval UX.
2. Choose one media provider and add it as a normal provider adapter with a
   spending cap, not as a hardcoded API call in the prompt.
3. Add a dedicated bot mailbox only when a domain/provider is chosen; map it to
   the existing email tools and an explicit send policy.
4. Scope an iOS app/App Intents project. Keep each capability off by default,
   mirroring the companion's current default-deny posture.
5. Add a real share/publish step for Pages (signed link, expiry, revocation)
   before calling a page "shared with the team".
