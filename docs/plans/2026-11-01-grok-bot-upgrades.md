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
| Vault for cards, logins, contacts | **Connector path ready.** Connected Apps exposes the 1Password toolkit; the bot uses it through Composio tools, so the model never needs raw credentials in the transcript. No card vault of our own. | A card vault needs an OS-keychain-backed design and a one-time-card provider. Never expose raw PANs to the model or transcript. |
| Shopping cards with photos, ratings, price, store, Buy now | **Implemented.** A bot can emit a fenced `products` JSON array; KodBot renders image/price/store/rating cards. **Buy now** opens the merchant page, never a fake checkout. | Checkout/order tracking still belongs to a merchant or Stripe/Shopify connector, with an explicit payment approval. |
| Stripe Pay / agent-to-agent transfers | **Connector path ready.** Stripe is in Connected Apps. | Stripe Pay is a separate beta product. Requires a Stripe account enabled for it, credentials, and a deliberate payment-approval UI before money moves. |
| Bot calls with notes and a summary | **Connector path ready.** Aircall is in Connected Apps; the bot can use its call APIs through Composio. | A telephony account/number, outbound-call approval, recording/transcript consent, and a call-result card. KodBot does not fake a phone call without them. |
| Bot-created pages | **Implemented.** `pages/*.html` in the bot workspace, sandboxed preview, list/copy-link/delete, prompt guidance. | Public team sharing needs an explicit publish/share surface. Today the copied link is only reachable by someone who can reach the KodBot server. |
| iPhone app actions (Home, Reminders, Contacts, Alarms, Calendar) | Android companion and desktop app exist; the default-deny companion API exposes chat and approvals, not phone capabilities. | Requires an iOS app with App Intents/Shortcuts, per-capability permission prompts, and companion routes. Android's equivalents are a separate follow-up. |
| Memory import from ChatGPT/Claude | **Implemented.** Settings → Memory → Import memory: copy the prompt, paste the answer, append/replace/`memory/<topic>.md`. | Direct provider export/OAuth import would need stable provider APIs and user consent. Copy/paste is provider-neutral and works today. |
| Best model for the job | **Implemented.** `server/model-routing.ts` scores the configured catalog per turn; the routed choice is persisted so usage and the picker reflect what ran. | A developer override and richer cost/latency signals can come later. The router never calls unconfigured providers, including Midjourney/Suno. |
| Bot-owned email address | **Connector path ready.** AgentMail is in Connected Apps and supports programmable inboxes, messages, drafts, and domains. Gmail/Outlook remain available for personal mailboxes. | The user must connect or create an AgentMail account and choose the address. KodBot does not invent a hosted mailbox. |
| Image/video generation | **Connector path ready.** All Images AI is in Connected Apps for image generation; markdown images already render in chat. Video generation needs a provider with a video API (for example HeyGen for avatar video). | Connect the provider, then have the bot attach the resulting image/video URL. Requires an account, cost cap, and provider-specific tool. |
| Shortcut sheet / visual polish | **Implemented.** `Cmd/Ctrl+/` opens a sheet grouped by Navigation and Chat. Bot avatars now have ten body silhouettes instead of one triangle. | Add more chords only when they earn their place; keep the sheet as the single source of truth. |

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

### Shopping cards

- A bot emits a fenced `products` block containing a JSON array. The parser in
  `src/lib/product-cards.ts` accepts only title + safe http(s) URL, plus optional
  image, price, store, rating, reviews, and note; it caps the list at 12.
- `ProductCards` renders a responsive card grid. **Buy now** is an outbound
  merchant link; there is no simulated checkout or payment success.
- Prompt guidance in `server/product-cards.ts` tells bots to use real search /
  connected-app results and never invent prices, ratings, or availability.

### Connected Apps feature hub

- Connected Apps now carries the real provider names and full descriptions for
  1Password, Stripe, Aircall, AgentMail, All Images AI, and HeyGen. Hovering an
  app shows its full description; connecting it is the normal Connected Apps
  flow.
- Nothing claims a capability is active until the provider account is connected.
  iPhone actions remain explicitly blocked on the missing iOS app.

### Bot silhouettes

- `src/lib/mascot-shapes.ts` adds ten shapes: Orb, Bubble, Pill, Hex, Diamond,
  Star, Drop, Shield, Ghost, and Classic.
- Existing bots are assigned a stable shape from their id + color on load; new
  bots get one at creation. The Shape picker in bot settings overrides it.
- The same `CursorAvatar` face/motion engine drives every shape, so blinking,
  gaze, expressions, and role badges remain consistent.

### Best-model routing

- `chooseAutoModel(prompt, options, fallback)` in `server/model-routing.ts`.
- Complex signals: at least 500 characters, a fenced code block, or task words
  such as code/debug/architecture/research/security/plan/design.
- Short simple requests (at most 220 characters, no code, no hard-task words)
  prefer `free` and fast-labelled models.
- Candidates are the models of the engine the user already chose, from
  `registry.describe()`, and exclude an unavailable / unauthenticated engine.
  The current selection is a fallback, so a catalog refresh failure never
  blocks a turn.
- A bot can also have an explicit **auto model pool**. The pool may span
  engines, but it is the user's explicit consent: only entries in that list are
  considered. An empty pool preserves the single-engine behavior.
- Every model row carries small capability badges (text, vision, audio, image,
  video, reasoning) so a pool is readable before it is saved.
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
