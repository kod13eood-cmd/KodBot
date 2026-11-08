# Multi-user KodBot — invite-only hosted accounts

Status: design approved in principle (2026-11-08). No auth code has shipped yet.
Branch: `feat/multi-user`.

## Decisions

| Question | Decision |
| --- | --- |
| Product type | Invite-only hosted platform |
| Isolation | One harness process + data directory per user |
| Auth | Built-in email + password |
| Existing live data | Assigned to the owner account |
| Phone pairing | QR/device token bound to the logged-in user |
| Public signup | Not in the first release; invites only |

## Implementation status

Phase 1 (auth/invites/devices) and Phase 2 (per-user harness + streaming
proxy) are implemented in `gateway/` with tests. They are not deployed to the
live host yet.

- `gateway/src/auth.ts`, `store.ts`, `password.ts`, `server.ts`, `harness.ts`
- `gateway/src/cli.ts` for owner creation, invites, password reset, and
  device revocation
- `pnpm build:gateway` → `dist-gateway/`
- `pnpm gateway:dev` → local gateway on port 8780
- Transitional owner mode: set `OC_GATEWAY_OWNER_HARNESS_PORT=8799` so the
  gateway proxies the owner to the existing live harness without starting a
  second process on `~/.kodbot`. New accounts still get their own harness.

The next implementation step is the Android login screen and HTTPS address
support, then deployment on port 8780 behind TLS.

## Why a gateway instead of making the harness multi-tenant

The current harness is deliberately single-user. Its `Store`, `messages.db`,
workspaces, connected-app installation, routines, webhooks and companion
tokens all assume one owner. Turning every one of those into a tenant-scoped
store is a large, risky rewrite.

A gateway keeps the proven harness unchanged:

```
browser / desktop / phone
          |
          v
   kodbot-gateway  :8780     auth, sessions, invites, devices, static UI
          |
          |  loopback only, one process per user
          v
   harness(user A) :random   ~/.kodbot-tenants/<id>
   harness(user B) :random   ~/.kodbot-tenants/<id>
   harness(owner)  :random   ~/.kodbot          (legacy data)
```

The gateway is the only public listener. Harnesses bind `127.0.0.1` and are
never exposed directly. This preserves the current single-user app and gives
each account its own bots, rooms, teams, routines, workspaces, transcripts,
and engine configuration.

## Non-goals for the first release

- Public self-service signup.
- Email verification and self-service password reset (SMTP comes later;
  invites and an owner CLI are the gate for the first release).
- Per-user managed Composio provisioning. New tenants start with connected
  apps disabled; the owner keeps the existing managed installation.
- Strong isolation for untrusted users. Invite-only/trusted users share the
  host OS user; a hostile bot could read another tenant's files. Public
  signup requires per-tenant containers or VMs before it can be enabled.

Android email/password login **is** in the first release: the phone asks for
the gateway URL, email, and password, stores a bearer session token, and
keeps QR pairing as an alternative. The desktop app and browser use the
cookie session.

All tenant harnesses inherit the operator's shared `OPENCODE_API_KEY` (and
any other engine credentials the operator puts in the gateway environment).


## Data model (gateway SQLite)

Control data lives in `~/.kodbot-gateway/gateway.db` (mode 600), never in a
tenant's data directory.

```sql
users(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','member')),
  data_dir TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER
)

sessions(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT
)

invites(
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT REFERENCES users(id),
  used_at INTEGER
)

devices(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
)

pairings(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts_left INTEGER NOT NULL,
  used_at INTEGER
)
```

Passwords use Node's built-in `scrypt` (N=16384, r=8, p=1, 64-byte output,
16-byte random salt). The stored format records its parameters so it can be
upgraded later. Session and device tokens are 32 random bytes; only their
SHA-256 is stored. The raw token goes to the client once.

## Authentication

### Web and desktop

- `GET /login` — standalone, server-rendered login/register page.
- `POST /api/auth/login` — email + password, sets `kodbot_session`
  (`HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` behind TLS).
- `POST /api/auth/register` — email + password + invite code.
- `POST /api/auth/logout` — deletes the session and clears the cookie.
- `GET /api/auth/me` — current user and role.
- Session lifetime: 30 days, sliding `last_seen_at` at most once per minute.
- Rate limit: per IP and per email, e.g. 10 attempts / 15 minutes.
- Origin + Host allowlist on every state-changing request; `SameSite=Strict`
  is the first CSRF defence. No cross-origin auth routes.
- On success redirect to `/`; on failure render the form with a generic
  "email or password is wrong" message.

### Owner bootstrap

The first owner is created with a CLI, not a public route:

```sh
node dist-gateway/cli.js owner --email owner@example.com --data-dir ~/.kodbot
```

The CLI prompts for the password (or reads `OC_GATEWAY_OWNER_PASSWORD` for
automation). It refuses if an owner already exists. Invites are created with:

```sh
node dist-gateway/cli.js invite --email friend@example.com --days 7
```

The printed code is shared out of band. It is stored only as a hash.

## Per-user harnesses

`HarnessManager` in the gateway:

1. Look up the user's `data_dir`.
2. If a child process is already healthy, reuse it.
3. Pick two free loopback ports (harness and webhook receiver).
4. Spawn:
   ```sh
   node /opt/kodbot/server/index.js
   ```
   with `OC_HOST=127.0.0.1`, `OC_PORT=<port>`, `OC_DATA_DIR=<dir>`,
   `OC_WEBHOOK_PORT=<port>`, `OC_STATIC_DIR=""`, and the operator's shared
   engine environment.
5. Wait for `GET /api/health` (bounded, e.g. 30 seconds).
6. Proxy requests to `127.0.0.1:<port>`.
7. On child exit, clear the entry; the next request restarts it.

The owner's `data_dir` is the existing `~/.kodbot`, so the current bots,
rooms, teams, routines, and history become the owner account's workspace
without a data migration. New users get
`~/.kodbot-tenants/<userId>/`.

The gateway strips `cookie`, `authorization`, `origin`, and the public
`host` header before proxying. The harness only sees a loopback request from
the gateway. The gateway is the sole auth boundary.

### Static UI

The gateway serves `dist/` and proxies `/api/*`. The React app needs no auth
rewrite: an unauthenticated page request redirects to `/login`, and
`/api/*` without a session returns 401. After login the normal app loads and
all relative `/api` calls go through the gateway.

## QR pairing (hosted mode)

The existing Android app already understands:

- QR payload: `kodbot://pair?hosts=...&token=omb_pair_...`
- Redemption: `POST /api/pair` with the pairing credential
- Long-lived device token: `Authorization: Bearer omb_...`

The gateway implements the same shape, so the Android pairing UI keeps
working:

1. A logged-in user opens **Companion** in the app and starts pairing.
2. `POST /api/device/pairing` creates a two-minute pairing window bound to
   that user and returns the QR payload and six-digit fallback code.
3. The phone redeems via `POST /api/pair` and receives a device token.
4. The gateway maps the token hash to the user; subsequent device requests
   are proxied to that user's harness.
5. The gateway enforces the companion allowlist (`denyReason` from
   `companion/src/routes.ts`) so a device cannot reach auth/admin routes.
6. `GET /api/devices` and `DELETE /api/devices/:id` let the user list and
   revoke phones. Revocation is immediate.

Direct local pairing (the existing `kodbot-companion` sidecar) stays for
single-user/local installs. Hosted mode uses the gateway pairing routes.

## Connected apps

Composio's managed broker currently identifies one installation, not one
KodBot user. The first release therefore:

- keeps the owner's existing managed connected apps;
- starts new tenants with connected apps disabled;
- lets a tenant use the self-hosted Composio path with their own project key.

Per-user managed Composio requires a broker change (installations keyed by
KodBot user, not by desktop install) and is a separate phase.

## Security boundaries

- The gateway binds a public port only behind TLS (Caddy/nginx/Tailscale
  HTTPS). Never expose plain HTTP with passwords.
- Harnesses bind loopback only. Firewall rules must not expose their random
  ports.
- Passwords, session tokens, device tokens, and invites are never logged.
- Auth responses are generic; no account enumeration.
- Rate limits cover login, register, pair redemption, and password hashing
  concurrency.
- The gateway data directory and tenant directories are mode 700/600.
- A compromised member bot is still a host-level risk because all harnesses
  run as the same OS user. Invite-only/trusted users only until per-tenant
  containers exist.
- Backups must include `~/.kodbot-gateway` and every tenant directory, with
  the existing 2/2/2 retention policy extended to the new roots.

## Rollout phases

### Phase 1 — Auth foundation (no live switch)

- Gateway package, SQLite schema, password/session/invite/device stores.
- Login/register/logout/me routes and the standalone login page.
- Owner/invite CLI.
- Unit tests for hashing, sessions, invites, devices, rate limits.

### Phase 2 — Per-user runtime

- Harness manager, free-port allocation, health checks.
- Streaming HTTP/SSE proxy and 401/503 handling.
- Static UI serving and unauthenticated redirect.
- Owner data-dir mapping; new tenant dirs.
- Integration test with a fake upstream harness.

### Phase 3 — Devices, QR, and Android login

- Gateway pairing window, `/api/pair`, device token auth.
- Companion route allowlist and revocation.
- Android: gateway URL + email/password screen, bearer session storage,
  logout, and 401 handling. QR pairing remains available.
- Android pairing against the gateway in a test environment.

### Phase 4 — Hosted rollout

- New `kodbot-gateway.service` on port 8780 (existing harness on 8799 stays
  untouched during the transition).
- Create the owner account pointing at `~/.kodbot`.
- Point the desktop app at the gateway URL and verify bots/history.
- Add TLS/reverse proxy, email verification/reset, backups, monitoring.

## Acceptance criteria for the first usable release

- An invited user can register with email + password, log in on two browsers
  and the desktop app, and see only their own bots/rooms/history.
- The owner logs in and still sees the existing live fleet and transcripts.
- A phone can scan a QR from the logged-in user, redeem it, and use the
  existing companion UI; revoking the phone stops it immediately.
- Logout clears the session everywhere; an expired session returns the login
  page, not a broken app.
- A member cannot reach another tenant's API, data directory, or device list.
- A device cannot call auth/admin routes even with a valid device token.
- No passwords or raw tokens appear in logs, SQLite plaintext, or backups.
