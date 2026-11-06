// Parses every PowerShell snippet with the real PowerShell parser.
// Windows only: skipped elsewhere. Nothing is executed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { TWEAKS } = require('../src/main/tweaks');
const { BOOSTS } = require('../src/main/boosts');
const { PS_PRELUDE } = require('../src/main/powershell');

const isWin = process.platform === 'win32';

test('all PowerShell snippets parse without errors', { skip: !isWin && 'requires Windows PowerShell' }, () => {
  const snippets = { prelude: PS_PRELUDE };
  for (const t of TWEAKS) for (const k of ['apply', 'revert', 'check']) snippets[`${t.id}.${k}`] = t[k];
  for (const b of BOOSTS) snippets[`boost.${b.id}`] = b.script;
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'src', 'backend'))) {
    snippets[`backend/${f}`] = fs.readFileSync(path.join(__dirname, '..', 'src', 'backend', f), 'utf8');
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horizon-parse-'));
  const json = path.join(dir, 'snippets.json');
  fs.writeFileSync(json, JSON.stringify(snippets));
  const script = path.join(dir, 'parse.ps1');
  fs.writeFileSync(script, `
$s = Get-Content -Raw -LiteralPath '${json.replace(/'/g, "''")}' | ConvertFrom-Json
$bad = @()
foreach ($p in $s.PSObject.Properties) {
  $tokens = $null; $errors = $null
  [System.Management.Automation.Language.Parser]::ParseInput($p.Value, [ref]$tokens, [ref]$errors) | Out-Null
  foreach ($e in $errors) { $bad += "$($p.Name): $($e.Message)" }
}
$bad | ConvertTo-Json -Compress
`);
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout.trim();
  const errors = out ? [].concat(JSON.parse(out)) : [];
  assert.deepEqual(errors, [], `parse errors:\n${errors.join('\n')}`);
  assert.ok(Object.keys(snippets).length > 270);
});
