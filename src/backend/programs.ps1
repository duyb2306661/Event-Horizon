# Installed programs, Store apps and startup entries. Prints JSON.
$paths = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$seen = @{}
$programs = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object {
  $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName -and ($_.UninstallString -or $_.QuietUninstallString) -and ($_.ReleaseType -ne 'Update') -and ($_.DisplayName -notmatch '^(Security Update|Update for|Hotfix)')
} | ForEach-Object {
  $key = ($_.DisplayName + '|' + $_.DisplayVersion).ToLower()
  if ($seen.ContainsKey($key)) { return }; $seen[$key] = 1
  $date = $null
  if ($_.InstallDate -match '^(\d{4})(\d{2})(\d{2})$' -and [int]$matches[2] -le 12 -and [int]$matches[3] -le 31) { $date = "$($matches[1])-$($matches[2])-$($matches[3])" }
  $icon = "$($_.DisplayIcon)"
  if (-not $icon -and $_.InstallLocation) { $icon = '' }
  [pscustomobject]@{
    id = $_.PSChildName; name = "$($_.DisplayName)".Trim(); version = "$($_.DisplayVersion)"; publisher = "$($_.Publisher)"
    installDate = $date; sizeMB = $(if ($_.EstimatedSize) { [math]::Round($_.EstimatedSize / 1024, 1) } else { $null })
    uninstall = "$($_.UninstallString)"; quietUninstall = "$($_.QuietUninstallString)"; location = "$($_.InstallLocation)"
    icon = $icon; hive = $(if ($_.PSPath -like '*HKEY_CURRENT_USER*') { 'user' } else { 'machine' })
    wow64 = ($_.PSPath -like '*WOW6432Node*')
  }
} | Sort-Object name

$apps = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { -not $_.IsFramework -and -not $_.IsResourcePackage -and $_.SignatureKind -ne 'System' } | ForEach-Object {
  $size = $null
  try { if ($_.InstallLocation -and (Test-Path $_.InstallLocation)) { $size = [math]::Round(((Get-ChildItem $_.InstallLocation -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } } catch {}
  $logo = $null
  try {
    $m = [xml](Get-Content (Join-Path $_.InstallLocation 'AppxManifest.xml') -ErrorAction Stop)
    $disp = $m.Package.Properties.DisplayName
    $logoRel = $m.Package.Properties.Logo
    if ($logoRel) {
      $base = Join-Path $_.InstallLocation $logoRel
      $dir = Split-Path $base; $file = [IO.Path]::GetFileNameWithoutExtension($base); $ext = [IO.Path]::GetExtension($base)
      $cand = Get-ChildItem $dir -Filter "$file*$ext" -ErrorAction SilentlyContinue | Sort-Object Length | Select-Object -First 1
      if ($cand) { $logo = $cand.FullName }
    }
    if ($disp -and $disp -notlike 'ms-resource:*') { $display = $disp } else { $display = $null }
  } catch { $display = $null }
  [pscustomobject]@{
    name = $_.Name; display = $(if ($display) { $display } else { ($_.Name -replace '^[^.]+\.', '') -creplace '([a-z])([A-Z])', '$1 $2' })
    fullName = $_.PackageFullName; version = "$($_.Version)"; publisher = ($_.Publisher -replace '^CN=', '' -replace ',.*', '')
    location = $_.InstallLocation; sizeMB = $size; logo = $logo; bloat = ($BloatApps -contains $_.Name); nonRemovable = [bool]$_.NonRemovable
  }
} | Sort-Object display

function Get-Approved($hive, $sub) {
  $p = "$hive\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\$sub"
  $r = @{}
  if (Test-Path $p) { $i = Get-ItemProperty $p; foreach ($n in $i.PSObject.Properties.Name) { if ($n -notlike 'PS*') { $r[$n] = $i.$n } } }
  $r
}
$startup = @()
foreach ($h in @(@{ hive='HKCU:'; label='User' }, @{ hive='HKLM:'; label='Machine' })) {
  foreach ($sub in @('Run', 'Run32')) {
    $regPath = if ($sub -eq 'Run') { "$($h.hive)\Software\Microsoft\Windows\CurrentVersion\Run" } else { "$($h.hive)\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run" }
    if (-not (Test-Path $regPath)) { continue }
    $approved = Get-Approved $h.hive $sub
    $i = Get-ItemProperty $regPath
    foreach ($n in $i.PSObject.Properties.Name) {
      if ($n -like 'PS*') { continue }
      $a = $approved[$n]; $enabled = $true
      if ($a -and $a.Length -gt 0 -and ($a[0] -band 1)) { $enabled = $false }
      $startup += [pscustomobject]@{ name=$n; command="$($i.$n)"; scope=$h.label; kind=$sub; enabled=$enabled; source='Registry' }
    }
  }
}
foreach ($f in @(@{ p="$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"; hive='HKCU:'; label='User' }, @{ p="$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"; hive='HKLM:'; label='Machine' })) {
  if (Test-Path $f.p) {
    $approved = Get-Approved $f.hive 'StartupFolder'
    Get-ChildItem $f.p -File -ErrorAction SilentlyContinue | Where-Object Name -ne 'desktop.ini' | ForEach-Object {
      $a = $approved[$_.Name]; $enabled = $true
      if ($a -and $a.Length -gt 0 -and ($a[0] -band 1)) { $enabled = $false }
      $startup += [pscustomobject]@{ name=$_.Name; command=$_.FullName; scope=$f.label; kind='StartupFolder'; enabled=$enabled; source='Folder' }
    }
  }
}
$tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon|Boot' } } | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object {
  [pscustomobject]@{ name=$_.TaskName; command=("$($_.Actions[0].Execute) $($_.Actions[0].Arguments)").Trim(); scope='Task'; kind=$_.TaskPath; enabled=($_.State -ne 'Disabled'); source='Scheduled Task' }
}
$startup += @($tasks)

@{ programs = @($programs); apps = @($apps); startup = @($startup) } | ConvertTo-Json -Depth 4 -Compress
