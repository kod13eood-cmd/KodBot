# Free Windows code signing with SignPath Foundation

KodBot is MIT-licensed and public, so it can apply for the free open-source
code-signing program run by [SignPath Foundation](https://signpath.org). The
certificate is issued to SignPath Foundation, not to the KodBot maintainer.
Signed Windows installers show **SignPath Foundation** as the publisher.

This is the only free option that can remove the “Unknown publisher” warning.
Self-signed certificates and Sigstore do not clear SmartScreen.

## 0. Eligibility

SignPath Foundation requires:

- a public repository with an OSI-approved licence and no commercial
  dual-licensing;
- a maintained, already-released project;
- documentation and a download page;
- a **Code signing policy** on the project home page;
- a privacy policy;
- MFA for maintainers;
- named committers/reviewers and approvers;
- manual approval of every signing request;
- binaries built from the public source in a verifiable way.

KodBot's policy is in [`CODE_SIGNING_POLICY.md`](../CODE_SIGNING_POLICY.md) and
its privacy policy is in [`PRIVACY.md`](../PRIVACY.md). The README links both.

## 1. Apply

1. Open <https://signpath.org> and choose **Apply**.
2. Use the public repository URL
   `https://github.com/kod13eood-cmd/KodBot`, the MIT licence, and the Windows
   installer as the artifact to sign.
3. Describe the build: GitHub Actions, Windows runner, NSIS installer produced
   by `pnpm package:win`.
4. Wait for SignPath to review the project. This is a manual process and may
   take days.

Do not configure the GitHub secrets until SignPath has created the project and
the signing policy; the workflow will fail without them.

## 2. Create the SignPath project

After approval:

1. Create a project named `KodBot` (slug can differ; record it).
2. Add the artifact configuration from
   [`.signpath/artifact-configurations/kodbot-windows.xml`](../.signpath/artifact-configurations/kodbot-windows.xml).
   The file can be pasted into **Artifact Configurations → Add → Custom**.
   It signs the NSIS installer and restricts the product name to `KodBot` and
   the product version to the value submitted with the request.
3. Create a signing policy named `release-signing` with manual approval.
4. Create an API token for GitHub Actions. Store it as the
   `SIGNPATH_API_TOKEN` repository secret.
5. Record the organization ID, project slug, and signing-policy slug.

The workflow submits the installer as a GitHub Actions artifact. SignPath
downloads it, verifies that it came from this repository, signs it, and returns
a new artifact. The signing request waits for an approver.

## 3. GitHub configuration

In `kod13eood-cmd/KodBot` → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `SIGNPATH_API_TOKEN` | API token from the SignPath project |
| Variable | `SIGNPATH_ORGANIZATION_ID` | SignPath organization ID |
| Variable | `SIGNPATH_PROJECT_SLUG` | Project slug |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | `release-signing` |

The workflow is
[`.github/workflows/package-win-signpath.yml`](../.github/workflows/package-win-signpath.yml).
It is manual (`workflow_dispatch`) and does **not** publish a release.

Its default source ref is `feat/multi-user` while the multi-user work is on
that branch. After the branch is merged, change the workflow input default and
the release workflow's `SOURCE_REF` to `main` so a signing request always
builds the same public commit that was reviewed.

It:

1. builds the Windows installer with `pnpm package:win`;
2. uploads the unsigned installer as a GitHub Actions artifact;
3. submits it to SignPath and waits for manual approval;
4. verifies the returned Authenticode signature;
5. refreshes `release/latest.yml` because signing changes the installer bytes;
6. uploads the signed installer and manifest as a workflow artifact.

Run it from **Actions → Package Windows with SignPath → Run workflow** and
approve the request in SignPath. The signed artifact is downloadable from the
workflow run.

## 4. What signing changes

- The installer's Authenticode signature is added. `latest.yml` contains the
  SHA-512 and size of the **unsigned** file, so it must be regenerated with:

  ```sh
  node scripts/refresh-windows-latest.mjs release/KodBot-<version>-setup.exe release/latest.yml
  ```

  The workflow does this automatically.
- The `.blockmap` generated for the unsigned installer no longer describes the
  signed file. The dry-run workflow removes it. The release upload should omit
  the old blockmap for signed builds, or regenerate it from the signed
  installer.
- `app-update.yml` must not carry `publisherName` unless the build is signed.
  Once signed, the publisher name must match the certificate subject
  (`SignPath Foundation`) and stay stable.

## 5. Folding it into the release workflow

The live release workflow is in `kodbot-releases`, not in this repository.
After the dry run succeeds:

1. Copy the “upload unsigned installer → submit SignPath → verify → refresh
   latest.yml” steps into the Windows job of
   `kodbot-releases/.github/workflows/release.yml`.
2. Add the same SignPath secrets/variables to the `kodbot-releases` repository.
3. Keep the release job's per-release manual approval.
4. Upload the signed installer and the refreshed `latest.yml` to the release.
5. Make the Windows job depend on a successful signing step; never publish an
   unsigned installer under a version advertised as signed.

The Windows installer is currently unsigned until this is configured. The
existing 0.1.40 installer remains valid; SmartScreen shows **Unknown
publisher** and users choose **More info → Run anyway**.

## 6. Verification

On a Windows runner or a Windows machine with the Windows SDK:

```powershell
Get-AuthenticodeSignature .\KodBot-<version>-setup.exe |
  Format-List Status, StatusMessage, SignerCertificate
```

`Status` must be `Valid`. The signer subject should contain `SignPath`.

Users can also check the file's **Properties → Digital Signatures** tab.

## 7. Troubleshooting

| Symptom | Cause |
| --- | --- |
| Signing request rejected with metadata error | Product name/version in the NSIS installer do not match the artifact configuration. Check `productName` in `electron-builder.yml` and the `version` parameter. |
| Workflow waits forever | The signing policy requires manual approval; open SignPath and approve the request. |
| `latest.yml` downloads but update fails | The manifest still has the unsigned SHA-512/size; rerun `refresh-windows-latest.mjs`. |
| SmartScreen still warns | New publishers build reputation over time. A SignPath Foundation signature is trusted but may still need reputation; EV certificates are the faster paid alternative. |
| Signer is not SignPath | The wrong signing policy or certificate profile is selected. |

## 8. Limits

- The certificate belongs to SignPath Foundation; the publisher name is not
  “KodBot”.
- Only the installer is signed in this first integration. The application
  executable inside the installer is not deep-signed.
- Every release needs manual approval.
- The free programme is for open-source projects; review eligibility before
  adding proprietary components or a commercial closed-source edition.
- No free option gives the KodBot maintainer's own name as publisher. Certum's
  Open Source certificate (around €49/year) is the cheapest own-name option.
