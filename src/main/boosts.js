// One-shot maintenance actions ("Boost-ups"). Each returns a short human summary on stdout.
const B = [];
const add = (b) => B.push(Object.assign({ cat: 'system', glyph: '✦' }, b));

const SIZE_FN = `
function Get-DirSize($p){ if(Test-Path $p){ (Get-ChildItem $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } else { 0 } }
function Clear-Dir($p){ if(Test-Path $p){ Get-ChildItem $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue } }
function Fmt($b){ if($b -gt 1GB){ '{0:N2} GB' -f ($b/1GB) } elseif($b -gt 1MB){ '{0:N1} MB' -f ($b/1MB) } else { '{0:N0} KB' -f ($b/1KB) } }
`;

add({
  id: 'temp_clean', cat: 'system', glyph: '🧹',
  name: 'Junk & Temp Cleaner',
  desc: 'Clears user and system temp folders, Windows Update download cache and the delivery-optimization cache.',
  script: `${SIZE_FN}
$paths = @("$env:TEMP", "$env:SystemRoot\\Temp", "$env:SystemRoot\\SoftwareDistribution\\Download", "$env:SystemRoot\\Logs\\CBS", "$env:LOCALAPPDATA\\Microsoft\\Windows\\INetCache", "$env:LOCALAPPDATA\\CrashDumps")
$before = 0; foreach($p in $paths){ $before += Get-DirSize $p }
Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
foreach($p in $paths){ Clear-Dir $p }
Start-Service wuauserv -ErrorAction SilentlyContinue
$after = 0; foreach($p in $paths){ $after += Get-DirSize $p }
"Freed $(Fmt ($before - $after)) of temporary files."`,
});

add({
  id: 'shader_cache', cat: 'gaming', glyph: '◈',
  name: 'Shader Cache Rebuild',
  desc: 'Wipes the NVIDIA DXCache/GLCache and the Windows D3DSCache so corrupt or bloated shader caches are rebuilt fresh.',
  script: `${SIZE_FN}
$paths = @("$env:LOCALAPPDATA\\NVIDIA\\DXCache", "$env:LOCALAPPDATA\\NVIDIA\\GLCache", "$env:LOCALAPPDATA\\NVIDIA Corporation\\NV_Cache", "$env:LOCALAPPDATA\\D3DSCache", "$env:PROGRAMDATA\\NVIDIA Corporation\\NV_Cache")
$before = 0; foreach($p in $paths){ $before += Get-DirSize $p }
foreach($p in $paths){ Clear-Dir $p }
"Cleared $(Fmt $before) of shader cache. Games will rebuild shaders on first launch."`,
});

add({
  id: 'dns_flush', cat: 'network', glyph: '⟁',
  name: 'Flush DNS & Reset Winsock',
  desc: 'Clears the DNS resolver cache and resets the Winsock catalog. Fixes stale lookups and odd connection issues.',
  script: `ipconfig /flushdns | Out-Null
netsh winsock reset | Out-Null
netsh int ip reset | Out-Null
"DNS cache flushed and Winsock/IP stack reset. A reboot finalises the network reset."`,
});

add({
  id: 'standby_list', cat: 'gaming', glyph: '▣',
  name: 'Free Standby Memory',
  desc: 'Trims working sets of every process and clears the file-cache standby list, returning RAM to games instantly.',
  script: `
$sig = @'
[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess);
'@
Add-Type -MemberDefinition $sig -Name PsApi -Namespace Win32 -ErrorAction SilentlyContinue
$os = Get-CimInstance Win32_OperatingSystem; $before = $os.FreePhysicalMemory
$n = 0
Get-Process | ForEach-Object { try { if([Win32.PsApi]::EmptyWorkingSet($_.Handle)){ $n++ } } catch {} }
Start-Sleep -Milliseconds 800
$os = Get-CimInstance Win32_OperatingSystem; $after = $os.FreePhysicalMemory
$gain = [math]::Max(0, ($after - $before) / 1024)
"Trimmed $n processes. Free RAM went from $([math]::Round($before/1024)) MB to $([math]::Round($after/1024)) MB (+$([math]::Round($gain)) MB)."`,
});

add({
  id: 'recycle_bin', cat: 'system', glyph: '♻',
  name: 'Empty Recycle Bin',
  desc: 'Permanently deletes everything in the Recycle Bin on all drives.',
  script: `Clear-RecycleBin -Force -ErrorAction SilentlyContinue; "Recycle Bin emptied."`,
});

add({
  id: 'prefetch_clean', cat: 'system', glyph: '✦',
  name: 'Prefetch & Thumbnail Cache',
  desc: 'Clears stale Prefetch traces and the Explorer thumbnail/icon caches, fixing blank or wrong icons.',
  script: `${SIZE_FN}
$paths = @("$env:SystemRoot\\Prefetch", "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer")
$before = 0; foreach($p in $paths){ $before += Get-DirSize $p }
Clear-Dir "$env:SystemRoot\\Prefetch"
Get-ChildItem "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer" -Filter '*cache*.db' -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
"Cleared $(Fmt $before) of prefetch and thumbnail caches. Explorer restarts to rebuild icons on next launch."`,
});

add({
  id: 'event_logs', cat: 'system', glyph: '◉',
  name: 'Clear Event Logs',
  desc: 'Wipes all Windows event logs. Useful before troubleshooting; frees a little space.',
  script: `$n=0; wevtutil el | ForEach-Object { wevtutil cl "$_" 2>$null; $n++ }; "Cleared $n event logs."`,
});

add({
  id: 'ssd_trim', cat: 'hardware', glyph: '▤',
  name: 'SSD ReTrim / Optimize Drives',
  desc: 'Runs Optimize-Volume with ReTrim on every SSD and a quick defrag analysis on any HDD.',
  script: `$out=@()
Get-PhysicalDisk | ForEach-Object { $d=$_; Get-Partition -DiskNumber $d.DeviceId -ErrorAction SilentlyContinue | Where-Object DriveLetter | ForEach-Object {
  if($d.MediaType -eq 'SSD'){ Optimize-Volume -DriveLetter $_.DriveLetter -ReTrim -ErrorAction SilentlyContinue; $out += "$($_.DriveLetter): SSD retrimmed" }
  else { Optimize-Volume -DriveLetter $_.DriveLetter -Analyze -ErrorAction SilentlyContinue; $out += "$($_.DriveLetter): HDD analysed" }
} }
($out -join '; ')`,
});

add({
  id: 'wu_cache', cat: 'system', glyph: '☄',
  name: 'Reset Windows Update Cache',
  desc: 'Stops update services, deletes SoftwareDistribution and catroot2, restarts services. Fixes stuck updates.',
  script: `${SIZE_FN}
foreach($s in 'wuauserv','bits','cryptSvc','msiserver'){ Stop-Service $s -Force -ErrorAction SilentlyContinue }
$before = (Get-DirSize "$env:SystemRoot\\SoftwareDistribution") + (Get-DirSize "$env:SystemRoot\\System32\\catroot2")
Clear-Dir "$env:SystemRoot\\SoftwareDistribution"
Clear-Dir "$env:SystemRoot\\System32\\catroot2"
foreach($s in 'cryptSvc','bits','wuauserv','msiserver'){ Start-Service $s -ErrorAction SilentlyContinue }
"Windows Update cache reset, $(Fmt $before) removed."`,
});

add({
  id: 'steam_clean', cat: 'gaming', glyph: '☁',
  name: 'Steam Cleaner',
  desc: 'Removes Steam HTTP cache, shader cache and crash dumps. Installed games and saves are not touched.',
  script: `${SIZE_FN}
$steam = (Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath
if(-not $steam){ "Steam not found."; return }
$paths = @("$steam\\appcache\\httpcache", "$steam\\dumps", "$steam\\logs", "$steam\\steamapps\\shadercache")
$before = 0; foreach($p in $paths){ $before += Get-DirSize $p }
foreach($p in $paths){ Clear-Dir $p }
"Cleared $(Fmt $before) from Steam caches."`,
});

add({
  id: 'restart_explorer', cat: 'system', glyph: '⟳',
  name: 'Restart Explorer & Reset Taskbar',
  desc: 'Restarts explorer.exe to apply UI tweaks and fix a frozen taskbar.',
  script: `Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep 1; if(-not (Get-Process explorer -ErrorAction SilentlyContinue)){ Start-Process explorer.exe }; "Explorer restarted."`,
});

add({
  id: 'gpu_reset', cat: 'hardware', glyph: '◐',
  name: 'Reset GPU Driver (Ctrl+Shift+Win+B)',
  desc: 'Issues the graphics driver reset signal — clears a black screen / stuck display without rebooting.',
  script: `Add-Type -AssemblyName System.Windows.Forms
$sig='[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'
Add-Type -MemberDefinition $sig -Name KB -Namespace W -ErrorAction SilentlyContinue
foreach($k in 0x11,0x10,0x5B,0x42){ [W.KB]::keybd_event($k,0,0,[UIntPtr]::Zero) }
foreach($k in 0x42,0x5B,0x10,0x11){ [W.KB]::keybd_event($k,0,2,[UIntPtr]::Zero) }
"GPU driver reset signal sent."`,
});

add({
  id: 'restore_point', cat: 'system', glyph: '🛡',
  name: 'Create System Restore Point',
  desc: 'Creates a restore point named "Event Horizon" so you can roll back everything in one click.',
  script: `Enable-ComputerRestore -Drive "$env:SystemDrive\\" -ErrorAction SilentlyContinue
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore' 'SystemRestorePointCreationFrequency' 0
try { Checkpoint-Computer -Description 'Event Horizon' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop; "Restore point created." } catch { "Could not create restore point: $($_.Exception.Message)" }`,
});

module.exports = { BOOSTS: B };
