const { spawn } = require('child_process');
const { BLOAT_APPS } = require('./tweaks');

// Shared helper functions prepended to every script we run.
const PS_PRELUDE = `
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$BloatApps = @(${BLOAT_APPS.map(a => `'${a}'`).join(',')})

function Set-Reg($path, $name, $value, $type = 'DWord') {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType $type -Force | Out-Null
}
function Get-Reg($path, $name) {
  try { (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name } catch { $null }
}
function Remove-Reg($path, $name) { Remove-ItemProperty -Path $path -Name $name -Force -ErrorAction SilentlyContinue }
function Test-RegEq($path, $name, $value) {
  $v = Get-Reg $path $name
  if ($null -eq $v) { return $false }
  return ("$v" -eq "$value")
}
function Set-Svc($name, $start) {
  $s = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($s) {
    Set-Service -Name $name -StartupType $start -ErrorAction SilentlyContinue
    if ($start -eq 'Disabled') { Stop-Service -Name $name -Force -ErrorAction SilentlyContinue }
  }
}
function Get-SvcStart($name) {
  $s = Get-CimInstance Win32_Service -Filter "Name='$name'" -ErrorAction SilentlyContinue
  if ($s) { $s.StartMode } else { $null }
}
function Get-NvidiaKeys {
  Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -match '^\\d{4}$' } |
    Where-Object { (Get-Reg $_.PSPath 'DriverDesc') -like '*NVIDIA*' } |
    ForEach-Object { $_.PSPath }
}
function Test-PowerIndex($sub, $setting, $expected) {
  $out = (powercfg -q SCHEME_CURRENT $sub $setting | Out-String)
  $m = [regex]::Match($out, 'Current AC Power Setting Index:\\s*0x([0-9a-fA-F]+)')
  if (-not $m.Success) { return $false }
  return ([Convert]::ToInt64($m.Groups[1].Value, 16) -eq $expected)
}
`;

// Scripts are never written to disk. The app usually runs elevated, and a file in a
// user-writable folder could be swapped by unelevated code between write and execution.
// Instead a fixed bootstrap (passed via -EncodedCommand) reads the script from stdin as
// UTF-8 and runs it in the current scope.
const BOOTSTRAP = Buffer.from(
  "$r = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), (New-Object System.Text.UTF8Encoding $false)); " +
  "$__script = $r.ReadToEnd(); $r.Dispose(); . ([scriptblock]::Create($__script))",
  'utf16le').toString('base64');

/** Spawn PowerShell running `script` (fed over stdin). Returns the ChildProcess. */
function spawnPS(script) {
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', BOOTSTRAP,
  ], { windowsHide: true });
  child.stdin.on('error', () => {});
  child.stdin.end(script, 'utf8');
  return child;
}

/**
 * Run a PowerShell script body (prelude is prepended). Resolves with { code, stdout, stderr }.
 */
function runPS(body, { timeout = 180000, prelude = true } = {}) {
  return new Promise((resolve) => {
    const child = spawnPS((prelude ? PS_PRELUDE : '') + '\n' + body + '\n');
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, timeout);
    child.stdout.on('data', d => stdout += d.toString('utf8'));
    child.stderr.on('data', d => stderr += d.toString('utf8'));
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(err) }); });
  });
}

/** Run a script that prints JSON as its last output and parse it. */
async function runJSON(body, opts) {
  const r = await runPS(body, opts);
  const text = r.stdout.trim();
  const start = text.search(/[\[{]/);
  if (start < 0) throw new Error(`No JSON output. stderr: ${r.stderr.slice(0, 500)}`);
  try { return JSON.parse(text.slice(start)); }
  catch (e) { throw new Error(`Bad JSON: ${e.message}\n${text.slice(0, 400)}`); }
}

function psQuote(s) { return `'${String(s).replace(/'/g, "''")}'`; }

module.exports = { runPS, runJSON, spawnPS, psQuote, PS_PRELUDE };
