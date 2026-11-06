# Full hardware / OS scan. Prints one JSON object.
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os  = Get-CimInstance Win32_OperatingSystem
$cs  = Get-CimInstance Win32_ComputerSystem
$bb  = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_BIOS
$gpus = Get-CimInstance Win32_VideoController | ForEach-Object {
  [pscustomobject]@{
    name = $_.Name; driver = $_.DriverVersion; driverDate = $(if ($_.DriverDate) { ([datetime]$_.DriverDate).ToString('yyyy-MM-dd') } else { $null }); vramMB = [math]::Round($_.AdapterRAM/1MB)
    resolution = "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)"; refresh = $_.CurrentRefreshRate
  }
}
$nvsmi = $null
$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($smi) {
  $line = (& nvidia-smi --query-gpu=name,memory.total,driver_version,pcie.link.gen.max,pcie.link.width.max,power.limit,clocks.max.sm,clocks.max.memory --format=csv,noheader,nounits 2>$null)
  if ($line) { $p = $line -split ',\s*'; $nvsmi = [pscustomobject]@{ name=$p[0]; vramMB=[int]$p[1]; driver=$p[2]; pcieGen=$p[3]; pcieWidth=$p[4]; powerLimitW=$p[5]; maxCoreMHz=$p[6]; maxMemMHz=$p[7] } }
}
$ram = Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
  [pscustomobject]@{ bank=$_.DeviceLocator; sizeGB=[math]::Round($_.Capacity/1GB,1); speed=$_.ConfiguredClockSpeed; maker=$_.Manufacturer; part=("$($_.PartNumber)").Trim(); type=$_.SMBIOSMemoryType }
}
$disks = Get-PhysicalDisk | ForEach-Object {
  $d=$_
  $letters = (Get-Partition -DiskNumber $d.DeviceId -ErrorAction SilentlyContinue | Where-Object DriveLetter | ForEach-Object { "$($_.DriveLetter):" }) -join ' '
  [pscustomobject]@{ model=$d.FriendlyName; media=$d.MediaType; bus=$d.BusType; sizeGB=[math]::Round($d.Size/1GB); health=$d.HealthStatus; letters=$letters }
}
$vols = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{ letter=$_.DeviceID; label=$_.VolumeName; fs=$_.FileSystem; sizeGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) }
}
$nics = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ name=$_.Name; desc=$_.InterfaceDescription; status="$($_.Status)"; speed=$_.LinkSpeed; mac=$_.MacAddress }
}
$monitors = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue | ForEach-Object {
  $n = ($_.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  $m = ($_.ManufacturerName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  [pscustomobject]@{ name=$n; maker=$m }
}
$powerPlan = ((powercfg /getactivescheme | Out-String) -replace '.*\((.*)\).*','$1').Trim()
$vbs = (Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction SilentlyContinue)
$hags = Get-Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'
$tpm = (Get-Tpm -ErrorAction SilentlyContinue)
$secureBoot = $null; try { $secureBoot = Confirm-SecureBootUEFI -ErrorAction Stop } catch {}
$uptime = (Get-Date) - $os.LastBootUpTime

$result = [ordered]@{
  host = @{ name=$env:COMPUTERNAME; user=$env:USERNAME; maker=$cs.Manufacturer; model=$cs.Model; board="$($bb.Manufacturer) $($bb.Product)"; bios="$($bios.SMBIOSBIOSVersion) ($(if ($bios.ReleaseDate) { ([datetime]$bios.ReleaseDate).ToString('yyyy-MM-dd') }))" }
  os = @{ name=$os.Caption; version=$os.Version; build=$os.BuildNumber; arch=$os.OSArchitecture; installDate=([datetime]$os.InstallDate).ToString('yyyy-MM-dd'); uptimeHours=[math]::Round($uptime.TotalHours,1); lastBoot=([datetime]$os.LastBootUpTime).ToString('yyyy-MM-dd HH:mm') }
  cpu = @{ name=$cpu.Name.Trim(); cores=$cpu.NumberOfCores; threads=$cpu.NumberOfLogicalProcessors; baseMHz=$cpu.MaxClockSpeed; l2KB=$cpu.L2CacheSize; l3KB=$cpu.L3CacheSize; socket=$cpu.SocketDesignation; virt=$cpu.VirtualizationFirmwareEnabled }
  gpus = @($gpus); nvidia = $nvsmi
  ram = @{ totalGB=[math]::Round($cs.TotalPhysicalMemory/1GB,1); modules=@($ram) }
  disks = @($disks); volumes=@($vols); nics=@($nics); monitors=@($monitors)
  state = @{ powerPlan=$powerPlan; vbsRunning=($vbs -and $vbs.VirtualizationBasedSecurityStatus -eq 2); hvciRunning=($vbs -and ($vbs.SecurityServicesRunning -contains 2)); hags=($hags -eq 2); tpm=($tpm -and $tpm.TpmPresent); secureBoot=$secureBoot; gameMode=(Test-RegEq 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled' 1) }
}
$result | ConvertTo-Json -Depth 6 -Compress
