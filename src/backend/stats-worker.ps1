# Long-running stats worker: emits one JSON line every ~1.5 s.
# Exits on its own when the parent app process is gone or stdout is closed,
# so a crashed app never leaves an orphaned worker behind.
param([int]$ParentPid = 0)
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
$cs = Get-CimInstance Win32_ComputerSystem
$threads = [int]$cs.NumberOfLogicalProcessors
$totalMB = [math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1024)
$baseMHz = [int](Get-CimInstance Win32_Processor | Select-Object -First 1).MaxClockSpeed
function N($s) { $d = 0.0; if ([double]::TryParse("$s".Trim(), [ref]$d)) { $d } else { $null } }

while ($true) {
  if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { exit 0 }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $pc = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
  $pi = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation -Filter "Name='_Total'"
  $os = Get-CimInstance Win32_OperatingSystem
  $load = [int]$pc.PercentProcessorTime
  $mhz = if ($pi -and $pi.PercentProcessorPerformance) { [int]($baseMHz * $pi.PercentProcessorPerformance / 100) } else { $baseMHz }
  $gpu = $null
  if ($smi) {
    $line = (& nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,clocks.current.graphics,clocks.current.memory,power.draw,fan.speed --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
    if ($line) {
      $p = "$line" -split ',\s*'
      $gpu = @{ util = N $p[0]; temp = N $p[1]; memUsed = N $p[2]; memTotal = N $p[3]; coreMHz = N $p[4]; memMHz = N $p[5]; powerW = N $p[6]; fan = N $p[7] }
    }
  }
  $all = Get-Process
  $procs = @($all | Where-Object { $_.Id -ne 0 -and $_.CPU } | Sort-Object CPU -Descending | Select-Object -First 50 | ForEach-Object {
    @{ pid = $_.Id; name = $_.ProcessName; cpu = [double]$_.CPU; memMB = [math]::Round($_.WorkingSet64 / 1MB, 1) }
  })
  $o = @{
    t = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    cpu = @{ load = $load; mhz = $mhz; threads = $threads }
    ram = @{ totalMB = $totalMB; freeMB = [math]::Round($os.FreePhysicalMemory / 1024) }
    gpu = $gpu; procCount = $all.Count; procs = $procs; ms = $sw.ElapsedMilliseconds
  }
  try {
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Depth 4 -Compress))
    [Console]::Out.Flush()
  } catch { exit 0 }
  $rest = 1500 - $sw.ElapsedMilliseconds
  if ($rest -gt 0) { Start-Sleep -Milliseconds $rest }
}
