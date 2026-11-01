# Running KodBot on a 24/7 machine

KodBot's desktop window and its agent harness are separate processes. That
means the harness can live on a machine that stays on while you connect from a
laptop.

## 1. Start the server on the always-on machine

Install the Linux build on the 24/7 machine, then run it headless:

```sh
OC_HOST=0.0.0.0 /opt/KodBot/kodbot --headless
```

`OC_HOST=0.0.0.0` listens on every interface. Prefer a Tailscale address or a
firewall rule that exposes port `8799` only to your tailnet/LAN; KodBot's
harness has no built-in login.

For systemd, a minimal unit looks like:

```ini
[Unit]
Description=KodBot harness
After=network-online.target

[Service]
Environment=OC_HOST=0.0.0.0
ExecStart=/opt/KodBot/kodbot --headless
Restart=always

[Install]
WantedBy=default.target
```

The headless process keeps the harness (and the companion, if you enabled it
in that install) alive without opening a window.

Set the server's timezone to the timezone you use for schedules. Routine times
are wall-clock times interpreted by the server; a UTC host would run a 09:00
schedule at 11:00 in Sofia. Add to the unit's `[Service]` section:

```ini
Environment=TZ=Europe/Sofia
```

Then `sudo systemctl daemon-reload && sudo systemctl restart kodbot`.

## 2. Point the desktop app at it

On the laptop, open **Settings → General → Server**, enter:

```text
http://the-24-7-machine:8799
```

and choose **Connect to remote server**. The app checks `/api/health`, saves
the address, and restarts with the remote UI. Use **Use this computer** to
switch back.

If the address cannot be reached at launch, the app falls back to a local
server and shows a warning in the same panel, so a typo does not leave you with
a blank window.

## What lives where

- Agent processes, workspaces, transcripts, provider keys, connected apps, and
  the phone companion live on the remote machine.
- The laptop window is a client; native dictation and the local screen preview
  still use the laptop where available.
- The remote harness has no authentication of its own. Do not expose port
  `8799` directly to the public internet; use Tailscale, a private LAN, or an
  authenticating reverse proxy.

## Companion and phones

The companion is an Electron-owned sidecar. To pair phones against the remote
harness, enable **Companion** once in the desktop app on the 24/7 machine (or
run the packaged app there normally), then switch that machine to `--headless`.
The phone then talks to the companion on that machine, not to the laptop.
