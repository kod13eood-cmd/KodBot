# KodBot Companion for Android

This is a native Kotlin/Compose companion for the KodBot desktop host. The
Linux machine remains the agent host: prompts sent from Android run through its
configured agent CLI, and tool permissions are answered through the existing
approval flow. The phone does not receive a general shell endpoint.

## Current MVP

- Scan the Linux Companion QR from within the app, or pair with a manual address and
  one-time six-digit code.
- Open the same `kodbot://pair` QR handoff used by the Linux Companion panel;
  the debug APK registers that scheme and redeems a one-time token-link
  immediately. Legacy `opencrew://pair` links are still accepted so a
  staggered desktop/mobile upgrade can pair.
- Keep the authenticated event stream alive with an Android foreground service.
- Show the same visible bots and group chats as the desktop, send prompts,
  read transcripts, and allow or deny pending tool requests. The foreground
  service posts native Android notifications for
  approval, question, completion, and routine-failure events.
- Long-press any answer to select and copy text, then paste it into the
  composer with the normal Android text controls.
- **Tablet and wide-window layout:** from 600dp wide the fleet becomes a left
  navigation column and the chat or settings open on the right. The breakpoint
  is width-only so opening the keyboard cannot flip the layout and drop the
  composer focus. Phones keep the single-pane layout. The QR scanner remains
  portrait-only; the chat shell follows the device.
- **Desktop mode (web view):** Settings → Display can load the same React UI
  used by the desktop app in a full-screen WebView. The native foreground
  service keeps notifications, approvals, and background SSE alive. Hosted
  sessions are handed to the gateway as an HttpOnly cookie; local QR pairings
  open the harness web UI directly. Tablets get a one-time suggestion.
- Attach photos, PDFs, or files from the composer. The phone uploads the bytes
  to the host's `~/.kodbot/uploads` directory and sends the same
  `<attached-file path="…" />` block the desktop composer uses, so the agent
  can open the file with its normal tools. Attachments are capped at 30 MB.
- Settings can test or repair the host address, change a bot's model from the
  host catalog, and toggle whether hidden bots or group chats are shown.
- The same bot shapes and job badges as the desktop are drawn natively with
  Compose, and the fleet is grouped into **Rooms**, **teams**, and **Other
  bots**. Settings shows each bot's team and leader, with join, leave, create,
  and leader-transfer actions.
- The model picker has capability badges (text, vision, audio, image, video,
  reasoning), search, and separate **OpenCode Zen** / **OpenCode Go** sections.
- Each bot can turn on Auto routing and choose an explicit Auto model pool. An
  empty pool keeps Auto inside the bot's current engine.
- `products` blocks in replies render as tappable merchant cards. **Buy now**
  opens the merchant page; the phone never claims a checkout happened.
- Bot deletion is desktop-only. The phone intentionally has no delete action
  for a bot: deleting one removes every transcript and its workspace, which is
  too destructive for a single tap on a pocket device.
- Store the paired device token encrypted with an Android Keystore AES key.

Pairing, chat, and notifications use the existing default-deny companion API
on port `8810`. This app never talks to the harness port directly and never
receives provider credentials. Use a trusted home LAN or, preferably, Tailscale
when away from home; the current sidecar transport is HTTP, as documented in
[`../docs/ios-companion.md`](../docs/ios-companion.md).

## Build

Open this directory in Android Studio and select a **JDK 17** Gradle JDK. The
app targets Android SDK 35. From a terminal, the debug APK can be built with:

```sh
cd android
JAVA_HOME="$HOME/.jdks/jdk-17.0.20.1+1" \
ANDROID_HOME="$HOME/Android/Sdk" \
./gradlew :app:assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.
Sideload that APK once before scanning the desktop QR; the QR opens the app but
does not install it. There is not yet a Play Store download link.

## In-app updates

The app checks [`latest.json`](latest.json) on launch and from
**Settings → App updates**. To publish an update:

1. Bump `versionCode` and `versionName` in `app/build.gradle.kts`.
2. Build the APK and publish it where the manifest points. The current
   manifest points at a versioned file on the `android-release` branch:
   `https://raw.githubusercontent.com/kod13eood-cmd/KodBot/android-release/KodBot-android-<version>.apk`.
   A GitHub release asset named `KodBot-android.apk` also works if the
   manifest uses the stable
   `https://github.com/kod13eood-cmd/KodBot/releases/latest/download/KodBot-android.apk`
   URL instead.
3. Set `versionCode`, `versionName`, `apkUrl`, `notes`, and the release date
   in `android/latest.json`, then push that file to `main`.

The manifest is read from
`https://raw.githubusercontent.com/kod13eood-cmd/KodBot/main/android/latest.json`,
so the `latest.json` push is what makes **Check for updates** see a release.
Android asks the user to allow installs from KodBot the first time; after that
the download starts the system installer directly.
For reliable scanning, open KodBot and tap **Scan pairing QR**. Some
Android Camera apps display custom `kodbot://` links without dispatching them
to the app; the registered link remains useful from apps that support custom
URI intents.

With a USB-debugging-enabled phone attached, install it from the repository
root with:

```sh
JAVA_HOME="$HOME/.jdks/jdk-17.0.20.1+1" \
ANDROID_HOME="$HOME/Android/Sdk" \
./android/gradlew -p android :app:installDebug
```

## Notification limits

Android notifications are delivered while the paired foreground service can
reach the Linux host. Android displays an ongoing connection notification
while that service is active. Force-stopping the app, rebooting the phone, or
losing network access stops delivery until the app reconnects. Reliable
delivery when the phone is offline or the app has been force-stopped requires
a push relay (for example, Firebase Cloud Messaging) and project credentials;
those are intentionally not embedded in this repository.
