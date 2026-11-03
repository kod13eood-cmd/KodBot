# Bops-inspired improvements for KodBot

Source of inspiration: <https://github.com/OrgoAI/bops> (reviewed 2026-11-03).

Bops is a Mac-only business-ops product built around Orgo cloud computers,
OpenAI, Honcho memory, Composio apps, AgentMail and AgentPhone. KodBot is a
cross-platform, local-first, multi-engine agent platform. Do **not** copy Bops
code: Bops is under FSL-1.1-ALv2, which does not permit use in a competing
product or hosted service. These are clean-room product ideas, not code imports.

## Priority 1 — trust and credentials

### Vault for logins and 2FA

- [ ] Add a cross-platform secret store: macOS Keychain, Windows Credential
      Manager/DPAPI, Linux Secret Service, with an encrypted fallback only when
      no OS store is available.
- [ ] Store only `site`, `username`, `hasPassword`, `hasTotp`, allowed bots, and
      last-used time in normal state. Never put passwords or TOTP keys in
      transcripts, prompts, logs, exports, or backups that leave the machine.
- [ ] Add a Vault page with per-bot access, add/edit/delete, and a clear
      "who can use this login" picker.
- [ ] Add TOTP generation (RFC 6238) and a bounded retry policy, so a wrong
      password cannot loop.
- [ ] Add native sign-in cards for login and two-factor pages; the card fills
      the page without exposing the secret to the model.
- [ ] Add an explicit "Sign in from Vault" action on a bot's computer screen.

**Done when:** a bot can sign in to a real site through a saved login and the
model/transcript never contains the password or TOTP key.

### Structured permissions

- [ ] Classify actions as **read**, **write/create/send**, and **pay/transfer/
      call**. Read runs immediately; write asks; money/phone always asks even
      when Auto mode is on.
- [ ] Add an "Always allow this action" rule scoped to one bot and action, not
      a blanket permission.
- [ ] Put the concrete amount, recipient, phone number, path, or URL in the
      approval card, not only a summary.
- [ ] Keep Stop authoritative: stopping a turn rejects pending actions and
      never runs a queued follow-up from the stopped turn.

**Done when:** every destructive or external action has a visible scope, and
the user can predict exactly what "Allow" will do.

### Per-app and per-account access

- [ ] Replace the per-bot Composio boolean with per-app and per-account grants.
- [ ] Add **Read** vs **Act** levels for each app grant.
- [ ] Allow several accounts for one app and let each bot choose which accounts
      it may use.
- [ ] Show which bots use each account and which accounts each bot can reach.
- [ ] Keep access changes logged and reversible.

**Done when:** giving a bot Gmail does not automatically give it every other
connected app or every account on the workspace.

## Priority 2 — screen awareness

### Blocker detection

- [ ] Use Jev to classify the current page as normal, login, two-factor,
      captcha, payment, email compose, or error.
- [ ] Only interrupt when the blocker actually stops the task.
- [ ] Show a native card with the useful action: Sign in, Enter code, Take over,
      Pay, or Open screen.
- [ ] Resume the paused turn automatically after the user resolves the page.
- [ ] Add confidence thresholds so uncertain classifications stay quiet.

**Done when:** a bot that hits a login page pauses with a useful card instead
of silently spinning or failing.

### Watches and attention

- [ ] Add watches for a screen/page: inbox, dashboard, price, status page,
      marketplace, or a local Mac window where supported.
- [ ] Read only changes; do not run a full model turn on every timer tick.
- [ ] Classify news as `now`, `quiet`, or `later` using the existing Jev layer.
- [ ] Hold `later` items into one "While you were busy" digest.
- [ ] Show a "needs you" badge on the watched screen and a link to it.
- [ ] Add a bounded fallback: if the classifier is unavailable, watches notify
      and tasks do not interrupt.

**Done when:** a watch can run all day without spending tokens while nothing
changes, and only interrupts for something the user asked to know.

## Priority 3 — reach

### Channels

- [ ] Add Telegram first: one bot token per bot, long polling, no public URL.
- [ ] Pair the owner with a one-time code; only that account may give the bot
      work. Everyone else gets a clear refusal or a message-taking flow.
- [ ] Add Discord next, then Slack. Keep channel tokens in the OS secret store.
- [ ] Mirror every channel message into the bot's normal chat and reply back to
      the same channel/thread.
- [ ] Never let a channel message bypass the same permission and payment gates
      as the desktop app.

**Done when:** a user can ask a bot from Telegram and see the answer there,
with the same approvals and safety as in KodBot.

### Org chart and team controls

- [ ] Add a visual org chart: leader, members, "reports to", "can ask", shared
      computer, and memory isolation.
- [ ] Let the leader hand off work down the chart; keep sideways chatter
      explicit.
- [ ] Show which bots share a computer/login set.
- [ ] Add member access levels: read vs write/act.

**Done when:** the team view explains who leads whom and what each member may
access without reading code or settings pages.

## Priority 4 — memory and artifacts

### Memory categories

- [ ] Add categories for people, projects, decisions, preferences, and to-dos.
- [ ] Keep a source link from every item to the chat/task that taught it.
- [ ] Make Forget delete the item and its derived facts, with a visible
      verification step.
- [ ] Keep the file-based `MEMORY.md` as the local source of truth; the index
      is a cache, not a second store.

### Page sharing

- [ ] Keep Pages as self-contained HTML artifacts.
- [ ] Add signed share links with expiry and revocation; never expose the
      workspace or API keys.
- [ ] Add a "Discuss this page" action that sends a bounded page summary back
      into the bot's transcript.

## Not planned

- Hosted multi-user Bops Cloud, Postgres state, Orgo-only computers.
- Copying Bops code or assets. License and trademark boundaries apply.
- Making UI-only claims for Stripe, phone, email, or media features without
  real provider credentials.

## Suggested rollout

1. Vault + sign-in cards + structured permissions.
2. Per-app access + blocker detection.
3. Telegram + watches + attention digest.
4. Memory categories + org chart.
5. Page sharing + routine suggestions.
