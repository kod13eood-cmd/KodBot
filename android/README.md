# KodBot Companion for Android

This is a native Kotlin/Compose companion for the KodBot desktop host. The
Linux machine remains the agent host: prompts sent from Android run through its
configured agent CLI, and tool permissions are answered through the existing
approval flow. The phone does not receive a general shell endpoint.

## Current MVP

- Scan the Linux Companion QR from within the app, or pair with a manual address and
  one-time six-digit code.
- Open the same `kodbot://pair` QR handoff used by the Linux Companion panel;
  the debug APK registers that scheme and asks for confirmation before pairing.
- Keep the authenticated event stream alive with an Android foreground service.
- Show the same visible bots and group chats as the desktop, send prompts,
  read transcripts, and allow or deny pending tool requests. The foreground
  service posts native Android notifications for
  approval, question, completion, and routine-failure events.
- Settings can test or repair the host address, change a bot's model from the
  host catalog, and toggle whether hidden bots or group chats are shown.
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
