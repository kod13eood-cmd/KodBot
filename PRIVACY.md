# Privacy policy

KodBot is a local-first application. This policy covers the open-source desktop
app and the optional invite-only gateway used to host multiple accounts.

## Local desktop mode

- Bots, transcripts, settings, API keys, and workspaces are stored on the
  computer that runs the harness, under `~/.kodbot` by default.
- KodBot does not operate a central account service for local mode.
- When you use an AI provider (OpenCode, Anthropic, OpenAI, xAI, or another
  configured engine), the prompts and context needed for a turn are sent to that
  provider under its own terms.
- Connected apps use Composio. OAuth tokens are held by Composio, not copied
  into the chat transcript. A self-hosted Composio key is stored in the local
  config.
- Optional update checks contact the configured release/update feed. Optional
  product analytics can be disabled in the app's settings.

## Hosted gateway mode (invite-only)

When an operator runs `kodbot-gateway`:

- The gateway stores the account email, password hash (scrypt), session records,
  invite records, and paired-device token hashes in its control database.
- Each account's bots, rooms, transcripts, workspaces, and settings are stored in
  that account's own data directory on the operator's server.
- Passwords are never stored in plaintext. Session and device tokens are stored
  only as SHA-256 hashes.
- A paired phone sees only the account that created the pairing. Revoking a
  device invalidates its token immediately.
- The operator controls backups and retention. The default backup policy keeps
  only the newest snapshots; see the operator's restore documentation.
- Data is not sold. It is shared only with the infrastructure and providers the
  operator configures (for example an AI model provider, Composio, or an email
  provider when password reset is enabled).
- Account deletion, export, and access requests are handled by the operator of
  that gateway. For the public KodBot project, open an issue at
  <https://github.com/kod13eood-cmd/KodBot/issues>.

## Third-party services

KodBot can connect to third-party services at the user's request. Those services
process data under their own privacy policies. KodBot does not control their
retention or security practices.

## Changes

This policy may be updated as the hosted service evolves. The current version is
kept in this repository.
