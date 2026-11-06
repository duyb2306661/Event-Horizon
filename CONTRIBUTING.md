# Contributing to Event Horizon

Thanks for helping. This project changes real system settings on other people's PCs, so the bar for correctness and honesty is high. The rules below exist to keep it trustworthy.

## Ways to help

- **Report a bug.** Use the bug report form. Include your Windows build (`winver`), the tweak ID, and the error toast text.
- **Propose a tweak.** Use the tweak proposal form. A source is required (see below).
- **Benchmark.** Before/after results with your method go in Discussions → Benchmarks.
- **Pick up an issue.** Look for [`good first issue`](https://github.com/muhzain05/Event-Horizon/labels/good%20first%20issue) and [`help wanted`](https://github.com/muhzain05/Event-Horizon/labels/help%20wanted).

## Development setup

```bash
git clone https://github.com/muhzain05/Event-Horizon.git
cd Event-Horizon
npm ci
npm test          # catalog schema, PowerShell parse check, Electron hardening
npm start         # runs the app; accept UAC, or set HORIZON_NO_ELEVATE=1
```

Windows 11 and Node.js 20 or newer are required. The PowerShell parse test only runs on Windows.

## Adding or changing a tweak

Tweaks live in [`src/main/tweaks.js`](src/main/tweaks.js). Each one is an object passed to `add()`:

```js
add({
  id: 'menu_delay',          // snake_case, unique, never renamed after release
  cat: 'visual',             // one of the CATEGORIES keys
  name: 'Instant menus (MenuShowDelay 0)',
  desc: 'Context menus and submenus open with zero delay.',
  risk: 'safe',              // safe | medium | high
  reboot: false,             // true if it only takes effect after a restart
  recommended: true,         // included in presets
  apply:  `Set-Reg 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '0' 'String'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '400' 'String'`,
  check:  `Test-RegEq 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '0'`,
});
```

Requirements for every tweak:

1. **A source.** Link Microsoft documentation, a vendor document, or a reproducible measurement in the pull request. Folklore tweaks with no evidence of effect on current Windows will be declined. Three were removed for this reason before v1.0.0.
2. **A real revert.** `revert` must restore the Windows default. If the default differs between Windows versions, say so in the PR.
3. **A real check.** `check` must return `$true` only when the tweak is applied, and must not change anything.
4. **An honest description.** Say what it changes and what it costs. No performance numbers unless you link the benchmark. No specific CPU or GPU models (the tests enforce this).
5. **The right risk level.** `high` for anything that lowers security isolation or can break features people rely on. High-risk tweaks are never in the Lite or Power presets (also enforced by tests).
6. **Regenerate the docs.** Run `npm run docs` and commit `docs/TWEAKS.md`. CI fails if it is stale.

Use the helpers from `PS_PRELUDE` in [`src/main/powershell.js`](src/main/powershell.js) (`Set-Reg`, `Remove-Reg`, `Test-RegEq`, `Set-Svc`, `Get-SvcStart`, `Test-PowerIndex`, `Get-NvidiaKeys`) instead of raw cmdlets where possible.

Test on a VM or a machine with a fresh restore point: apply, check that the toggle shows Applied, reboot if needed, revert, check that it shows Not applied.

If you change the number of tweaks, update the count in `test/catalog.test.js`, the README and the changelog.

## Pull requests

- One logical change per PR. Fill in the template.
- `npm test` and `npm run docs -- --check` must pass.
- Keep the renderer free of network requests. The content security policy blocks them and a test checks it.
- Match the existing style: 2-space indent, single quotes, no build step.

## Commit messages

Short imperative summary (`Add tweak: disable Bluetooth LE scanning`), blank line, then why.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
