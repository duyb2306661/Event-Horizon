## What and why

<!-- One logical change. Link the issue it closes: Closes #123 -->

## Type

- [ ] Bug fix
- [ ] New tweak or tweak change
- [ ] App feature
- [ ] Docs or tooling

## For tweak changes

- [ ] Source or benchmark linked:
- [ ] `apply`, `revert` (restores the Windows default) and `check` (read-only) all included
- [ ] Risk level justified, and description says what it costs
- [ ] Tested on a VM or with a restore point: apply → shows Applied → (reboot) → revert → shows Not applied
- [ ] `npm run docs` run and `docs/TWEAKS.md` committed

## Checks

- [ ] `npm test` passes
- [ ] No network requests added to the renderer
- [ ] CHANGELOG.md updated under "Unreleased"
