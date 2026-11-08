# Android signing and updates

Android refuses to install an APK over an existing app with the same package
name if the signing certificate differs. Debug builds are normally signed with
a machine-generated debug key, so an APK built on a GitHub runner does **not**
update an APK built on a developer machine.

KodBot now supports a stable CI signing key. Until the `ANDROID_KEYSTORE_BASE64`
secret is configured, the release workflow refuses to publish an Android APK
rather than shipping one that cannot update existing installs.

## The key already used by the installed app

The original debug builds (0.1.12, the re-signed 0.1.13 fallback APK, and the
current 0.1.14 APK) use the debug keystore at:

```
~/.android/debug.keystore
```

- alias: `androiddebugkey`
- store password: `android`
- key password: `android`
- SHA-256: `0B:20:03:5E:3D:C7:72:6F:6A:51:81:82:4F:CB:85:46:1C:94:60:58:83:69:A6:10:DA:D5:3D:DC:D6:5C:23:69`

Using that key in CI keeps existing installs updatable. It is a **debug key**,
not a hardened production key. Back it up; losing it means every existing user
must uninstall once.

A future move to a dedicated release key is recommended before a public launch.
That move requires one uninstall on every device because the certificate
changes.

## Add the GitHub secrets

Use the keystore from the machine that signed the app currently installed on the
phone. On this setup that is the development workstation's
`~/.android/debug.keystore`; the server's own debug keystore is a different key
and would reintroduce the conflict.

In `kod13eood-cmd/KodBot` → Settings → Secrets and variables → Actions:

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of the keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | `android` |
| `ANDROID_KEY_ALIAS` | `androiddebugkey` |
| `ANDROID_KEY_PASSWORD` | `android` |

Generate the base64 locally without printing it into chat:

```sh
base64 -w0 ~/.android/debug.keystore > /tmp/kodbot-android.keystore.b64
```

Open `/tmp/kodbot-android.keystore.b64`, copy its contents, and paste it into
the GitHub secret. Delete the temporary file afterwards:

```sh
rm -f /tmp/kodbot-android.keystore.b64
```

Do not commit the keystore or the base64 file.

## How the build uses it

`android/app/build.gradle.kts` reads:

- `KODBOT_ANDROID_KEYSTORE`
- `KODBOT_ANDROID_KEYSTORE_PASSWORD`
- `KODBOT_ANDROID_KEY_ALIAS`
- `KODBOT_ANDROID_KEY_PASSWORD`

When `KODBOT_ANDROID_KEYSTORE` is set, the debug signing config is replaced with
that keystore. Local builds without the variable keep using `~/.android/debug.keystore`.

The Android job in `kodbot-releases` decodes the secret to a temporary file and
sets these variables before `./gradlew :app:assembleDebug`.

## Verify a built APK

```sh
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/debug/app-debug.apk
```

The SHA-256 must match the certificate of the currently installed app when you
intend to update in place.

## Installing the current stable build

The 0.1.14 APK (`versionCode` 15) is signed with the key above and installs over
the original 0.1.12 app and the re-signed 0.1.13 fallback without uninstalling:

- <https://github.com/kod13eood-cmd/kodbot-releases/releases/latest/download/KodBot-android.apk>
- <https://raw.githubusercontent.com/kod13eood-cmd/KodBot/android-release/KodBot-android-0.1.14.apk>

The GitHub release assets for v0.1.39 and v0.1.40 were replaced on 2026-11-08
with builds signed by the stable key, so every download link now installs over
the same app. The app's own update check reads `android/latest.json` from
`main`, which points at the same 0.1.14 build.

**One-time uninstall:** if the phone installed any GitHub release APK published
before that repair, uninstall it once before installing 0.1.14. All chats and
bots live on the server; only the local pairing/login credential is lost. After
0.1.14 is installed, future updates install in place.

## Why the GitHub release APKs conflicted

Each release was built on a fresh GitHub runner, so Android's debug signing used
a different throwaway key each time:

| Release | Certificate |
| --- | --- |
| v0.1.39 (0.1.13) | `4C:F3:5D:E7:...` |
| v0.1.40 (0.1.13) | `B3:DF:5B:18:...` |
| Installed app / `android-release` | `0B:20:03:5E:...` (stable) |

Android returned `INSTALL_FAILED_UPDATE_INCOMPATIBLE` whenever the key changed.
The release assets are now all stable-key builds, and the release workflow
requires `ANDROID_KEYSTORE_BASE64` and verifies the built APK's certificate
before uploading, so a new ephemeral key cannot be published again.
