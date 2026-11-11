# KodBot token prefix rename plan

Status: planned, not started. This is a branding change with an auth
compatibility window, not a security change: the token prefix carries no
entropy, and the random body stays the same size.

## Goal

Issue `kodbot_pair_…` pairing credentials and `kodbot_…` device/session
tokens. Keep every existing `omb_pair_…` / `omb_…` token valid until the
grace period ends, so no phone has to be re-paired for this change.

## Why it is not a one-line rename

The prefixes are validated independently in the harness, the gateway, the
phone companion, Android, iOS, the pairing UI, and the tests. Changing only
the issuer would leave old clients unable to present a new token, and
changing only the validators would reject every existing pairing.

## Phase 1 — dual-prefix compatibility (no re-pairing)

1. Centralize the accepted prefixes:
   - `gateway/src/tokens.ts`: accept `kodbot_` and `omb_`, `kodbot_pair_`
     and `omb_pair_`. New issuance uses the `kodbot_` forms.
   - `companion/src/devices.ts`: same for the standalone companion.
   - `companion/src/proxy.ts` and `gateway/src/auth.ts`: validate both.
2. Update every reader that currently hard-codes `omb_`:
   - `src/lib/companion-pairing.ts` and its tests.
   - `android/…/CompanionApi.kt`, `MainActivity.kt`, and tests.
   - `ios/Sources/CompanionCore/Client.swift` and tests.
   - `scripts/capture-companion-fixtures.mjs` (redacted fixture only).
3. Keep the legacy `opencrew://pair` QR scheme accepted; new links continue
   to use `kodbot://pair`.
4. Tests must pin both forms: new issuance starts with `kodbot_`, an old
   `omb_` token still authenticates, and a malformed/other prefix is
   rejected.
5. Verify with a real paired phone or the companion proxy tests before
   moving on. No stored token is rewritten; old devices keep working.

## Phase 2 — grace period

- Announce that `omb_` is deprecated.
- Leave Phase 1 in place for at least one release cycle.
- Optionally expose a “re-pair this phone” action, but do not force it.

## Phase 3 — retire the old prefix

- Stop accepting `omb_` / `omb_pair_` after the grace period.
- Remove the legacy regexes and the `omb_` fixtures.
- Existing phones must re-pair once. This is the only step that can break a
  paired device, so it needs a human decision and a release note.

## Rollback

Phase 1 is additive: revert the commit and old tokens still work, new
`kodbot_` tokens would stop being accepted until the revert is re-applied.
No data migration is involved.

## Out of scope

- Changing the random token body or its length.
- Rotating or revoking any existing device token.
- Renaming the historical `opencrew://` QR scheme (kept as a legacy alias).
