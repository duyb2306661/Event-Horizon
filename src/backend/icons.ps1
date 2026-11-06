# Expects $IconList (array of strings) to be defined above. Each is "exe,path" style DisplayIcon or a file path.
Add-Type -AssemblyName System.Drawing
$out = @{}
foreach ($raw in $IconList) {
  if (-not $raw) { continue }
  try {
    $s = "$raw".Trim('"')
    $idx = 0
    if ($s -match '^(.*?),\s*(-?\d+)$') { $s = $matches[1].Trim('"'); $idx = [int]$matches[2] }
    $s = [Environment]::ExpandEnvironmentVariables($s)
    if (-not (Test-Path $s)) { continue }
    $bmp = $null
    $ext = [IO.Path]::GetExtension($s).ToLower()
    if ($ext -in '.png', '.jpg', '.jpeg', '.bmp') {
      $img = [System.Drawing.Image]::FromFile($s)
      $bmp = New-Object System.Drawing.Bitmap $img, 48, 48
      $img.Dispose()
    } elseif ($ext -eq '.ico') {
      $ico = New-Object System.Drawing.Icon($s, 48, 48)
      $bmp = $ico.ToBitmap(); $ico.Dispose()
    } else {
      $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($s)
      if ($ico) { $bmp = $ico.ToBitmap(); $ico.Dispose() }
    }
    if ($bmp) {
      $ms = New-Object IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $out[$raw] = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
      $ms.Dispose(); $bmp.Dispose()
    }
  } catch {}
}
$out | ConvertTo-Json -Compress
