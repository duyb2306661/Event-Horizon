# Security policy

Event Horizon runs with administrator rights and executes PowerShell, so security reports are taken seriously.

## Supported versions

| Version | Supported |
|---|---|
| 1.x (latest release) | ✅ |
| Older | ❌ |

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:

**[Report a vulnerability](https://github.com/muhzain05/Event-Horizon/security/advisories/new)**

Include what you found, how to reproduce it, the version, and the impact you expect. You should get an acknowledgement within 7 days. Fixes for confirmed issues are released as soon as practical and credited in the advisory unless you prefer otherwise.

## In scope

- Code execution or privilege escalation through the app, its IPC channels, or its PowerShell runner.
- A tweak whose revert does not restore the documented state, or whose check reports the wrong state, in a way that weakens security.
- The renderer making network requests, or loading remote content.
- Tampering with the release pipeline or published artifacts.

## Out of scope

- The documented effect of high-risk tweaks (for example, disabling VBS lowers security isolation by design; the app labels and confirms these).
- Antivirus heuristics flagging the unsigned executable.

## Verifying downloads

Every release includes `SHA256SUMS.txt`. Releases are built by GitHub Actions from the tagged commit; the workflow is in [`.github/workflows/release.yml`](.github/workflows/release.yml).
