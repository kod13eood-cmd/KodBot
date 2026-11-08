# Code signing policy

**Free code signing provided by [SignPath.io](https://signpath.io), certificate by
[SignPath Foundation](https://signpath.org).**

KodBot is an MIT-licensed open-source project. The Windows installer is built by
GitHub Actions from this public repository and signed through SignPath
Foundation's open-source program. The certificate is issued to SignPath
Foundation, so the publisher shown on signed Windows binaries is SignPath
Foundation, not the KodBot maintainer.

## What is signed

- **Windows:** the NSIS installer (`KodBot-<version>-setup.exe`). This is the
  artifact SmartScreen evaluates when a user downloads and runs the installer.
- **Linux (.AppImage / .deb):** not signed through SignPath. Release assets are
  built by GitHub Actions and published with checksums on the release page.
- **Android (.apk):** distributed debug-signed for testing; not signed through
  SignPath.
- The application executable inside the NSIS installer is installed locally and
  is not re-signed by this initial integration.

## Build and approval

- Source: <https://github.com/kod13eood-cmd/KodBot>
- Build system: GitHub Actions
- Windows signing dry run:
  `.github/workflows/package-win-signpath.yml`
- SignPath artifact configuration:
  `.signpath/artifact-configurations/kodbot-windows.xml`
- Every signing request requires manual approval by an approver listed below.
- The build must come from this public repository; SignPath verifies the origin
  of the artifact.

## Team roles

KodBot is currently maintained as an individual project.

| Role | Person / group |
| --- | --- |
| Authors | Repository owner: [@kod13eood-cmd](https://github.com/kod13eood-cmd) |
| Committers and reviewers | Repository owner: [@kod13eood-cmd](https://github.com/kod13eood-cmd) |
| Approvers | Repository owner: [@kod13eood-cmd](https://github.com/kod13eood-cmd) |

All maintainers and approvers use multi-factor authentication for GitHub and
SignPath access.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## Contact

Open an issue at <https://github.com/kod13eood-cmd/KodBot/issues> for questions
about this policy or a signed build.
