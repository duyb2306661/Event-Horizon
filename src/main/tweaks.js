// Tweak catalog. Every tweak carries PowerShell for apply / revert / check.
// `check` must evaluate to a boolean ($true when the tweak is currently applied).
// Helper functions (Set-Reg, Get-Reg, Remove-Reg, Set-Svc, Get-SvcStart, ...) are
// injected by main.js (see PS_PRELUDE in powershell.js).

const CATEGORIES = {
  fps:      { name: 'FPS & Latency',     glyph: '⚡', blurb: 'Frame pacing, input lag and scheduler priority for games.' },
  gpu:      { name: 'GPU (NVIDIA)',       glyph: '◈', blurb: 'Driver-level behaviour for NVIDIA GeForce cards.' },
  power:    { name: 'Power & CPU',        glyph: '☀', blurb: 'Keep the CPU clocked up, unparked and responsive.' },
  registry: { name: 'Registry Tweaks',    glyph: '✦', blurb: 'Low-level Windows behaviour switches.' },
  debloat:  { name: 'Windows Debloat',    glyph: '☄', blurb: 'Strip Windows 11 of ads, widgets and preinstalled junk.' },
  privacy:  { name: 'Privacy & Telemetry',glyph: '◉', blurb: 'Stop Windows phoning home in the background.' },
  network:  { name: 'Network & Ping',     glyph: '⟁', blurb: 'Lower latency, faster DNS, tighter TCP stack.' },
  storage:  { name: 'Storage & Memory',   glyph: '▣', blurb: 'NTFS, paging and RAM management for SSD systems with 16 GB+.' },
  visual:   { name: 'Visual & UI',        glyph: '◐', blurb: 'Turn off eye candy that steals frames.' },
};

const T = [];
const add = (t) => T.push(Object.assign({ risk: 'safe', reboot: false, recommended: false }, t));

/* ───────────────────────── FPS & LATENCY ───────────────────────── */

add({
  id: 'hags', cat: 'fps', recommended: true, reboot: true,
  name: 'Hardware-Accelerated GPU Scheduling',
  desc: 'Lets a supported GPU (NVIDIA GTX 10-series or newer, AMD RX 5000 or newer) manage its own work queue, which can lower latency and CPU overhead.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode' 2`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode' 1`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode' 2`,
});

add({
  id: 'game_mode', cat: 'fps', recommended: true,
  name: 'Enable Windows Game Mode',
  desc: 'Tells Windows to prioritise your game, pause Windows Update installs and background driver work while playing.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'AutoGameModeEnabled' 1; Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'AllowAutoGameMode' 1`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'AutoGameModeEnabled' 0; Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'AllowAutoGameMode' 0`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\GameBar' 'AutoGameModeEnabled' 1`,
});

add({
  id: 'gamedvr_off', cat: 'fps', recommended: true,
  name: 'Disable Game DVR & Xbox Game Bar capture',
  desc: 'Stops Xbox Game Bar from continuously recording gameplay in the background, which costs GPU encode time and disk writes.',
  apply: `Set-Reg 'HKCU:\\System\\GameConfigStore' 'GameDVR_Enabled' 0
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR' 'AllowGameDVR' 0
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR' 'AppCaptureEnabled' 0
Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'UseNexusForGameBarEnabled' 0`,
  revert: `Set-Reg 'HKCU:\\System\\GameConfigStore' 'GameDVR_Enabled' 1
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR' 'AllowGameDVR'
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR' 'AppCaptureEnabled' 1
Set-Reg 'HKCU:\\Software\\Microsoft\\GameBar' 'UseNexusForGameBarEnabled' 1`,
  check: `Test-RegEq 'HKCU:\\System\\GameConfigStore' 'GameDVR_Enabled' 0`,
});

add({
  id: 'fso_off', cat: 'fps', recommended: true,
  name: 'Disable Fullscreen Optimizations globally',
  desc: 'Forces true exclusive fullscreen instead of the borderless hybrid, cutting input latency in many DX11 titles.',
  apply: `$p='HKCU:\\System\\GameConfigStore'
Set-Reg $p 'GameDVR_FSEBehaviorMode' 2; Set-Reg $p 'GameDVR_FSEBehavior' 2
Set-Reg $p 'GameDVR_HonorUserFSEBehaviorMode' 1; Set-Reg $p 'GameDVR_DXGIHonorFSEWindowsCompatible' 1
Set-Reg $p 'GameDVR_EFSEFeatureFlags' 0`,
  revert: `$p='HKCU:\\System\\GameConfigStore'
Set-Reg $p 'GameDVR_FSEBehaviorMode' 0; Set-Reg $p 'GameDVR_FSEBehavior' 0
Set-Reg $p 'GameDVR_HonorUserFSEBehaviorMode' 0; Set-Reg $p 'GameDVR_DXGIHonorFSEWindowsCompatible' 0`,
  check: `Test-RegEq 'HKCU:\\System\\GameConfigStore' 'GameDVR_FSEBehaviorMode' 2`,
});

add({
  id: 'windowed_opt', cat: 'fps', recommended: true,
  name: 'Enable Optimizations for Windowed Games',
  desc: 'Windows 11 flip-model presentation for borderless games: lower latency and VRR/G-Sync support in windowed mode.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' 'DirectXUserGlobalSettings' 'SwapEffectUpgradeEnable=1;' 'String'`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' 'DirectXUserGlobalSettings' 'SwapEffectUpgradeEnable=0;' 'String'`,
  check: `"$(Get-Reg 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' 'DirectXUserGlobalSettings')" -like '*SwapEffectUpgradeEnable=1*'`,
});

add({
  id: 'mm_games', cat: 'fps', recommended: true,
  name: 'Boost multimedia scheduler priority for games',
  desc: 'Raises the multimedia scheduler (MMCSS) "Games" task to high CPU and I/O priority for games that register with it.',
  apply: `$p='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
Set-Reg $p 'GPU Priority' 8; Set-Reg $p 'Priority' 6; Set-Reg $p 'Scheduling Category' 'High' 'String'
Set-Reg $p 'SFIO Priority' 'High' 'String'; Set-Reg $p 'Background Only' 'False' 'String'; Set-Reg $p 'Clock Rate' 10000; Set-Reg $p 'Affinity' 0`,
  revert: `$p='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
Set-Reg $p 'GPU Priority' 8; Set-Reg $p 'Priority' 2; Set-Reg $p 'Scheduling Category' 'Medium' 'String'; Set-Reg $p 'SFIO Priority' 'Normal' 'String'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' 'Priority' 6`,
});

add({
  id: 'sysresp', cat: 'fps', recommended: true,
  name: 'System responsiveness: 0% reserved for background',
  desc: 'By default MMCSS reserves 20% of CPU time for low-priority work while multimedia tasks run. This lowers that reservation to the minimum.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness' 0`,
  revert: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness' 20`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness' 0`,
});

add({
  id: 'win32priority', cat: 'fps', recommended: true,
  name: 'Foreground process priority boost (Win32PrioritySeparation)',
  desc: 'Sets short, fixed quantum with a 3:1 foreground boost (0x26) — the classic competitive-gaming scheduler setting.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' 'Win32PrioritySeparation' 38`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' 'Win32PrioritySeparation' 2`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' 'Win32PrioritySeparation' 38`,
});

add({
  id: 'timer_res', cat: 'fps', recommended: true, reboot: true,
  name: 'Allow high-resolution timer requests',
  desc: 'Windows 11 throttles timer resolution for background windows; this lets games keep the 0.5 ms timer they ask for.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' 'GlobalTimerResolutionRequests' 1`,
  revert: `Remove-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' 'GlobalTimerResolutionRequests'`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' 'GlobalTimerResolutionRequests' 1`,
});

add({
  id: 'dynamic_tick', cat: 'fps', recommended: true, reboot: true, risk: 'medium',
  name: 'Disable Dynamic Tick',
  desc: 'Stops the kernel from coalescing timer ticks to save power. Smoother frametimes on a desktop that never runs on battery.',
  apply: `bcdedit /set disabledynamictick yes | Out-Null`,
  revert: `bcdedit /deletevalue disabledynamictick | Out-Null`,
  check: `[bool]((bcdedit /enum '{current}' | Out-String) -match 'disabledynamictick\\s+Yes')`,
});

add({
  id: 'platform_tick', cat: 'fps', risk: 'medium', reboot: true,
  name: 'Use platform tick & remove forced HPET',
  desc: 'Removes any forced HPET clock and uses the platform tick. Can lower DPC latency and micro-stutter on Intel boards.',
  apply: `bcdedit /deletevalue useplatformclock | Out-Null; bcdedit /set useplatformtick yes | Out-Null`,
  revert: `bcdedit /deletevalue useplatformtick | Out-Null`,
  check: `[bool]((bcdedit /enum '{current}' | Out-String) -match 'useplatformtick\\s+Yes')`,
});

add({
  id: 'mouse_accel', cat: 'fps', recommended: true,
  name: 'Disable mouse acceleration (1:1 raw input)',
  desc: 'Turns off "Enhance pointer precision" so every mouse count maps to the same distance. Requires sign-out to fully apply.',
  apply: `$p='HKCU:\\Control Panel\\Mouse'; Set-Reg $p 'MouseSpeed' '0' 'String'; Set-Reg $p 'MouseThreshold1' '0' 'String'; Set-Reg $p 'MouseThreshold2' '0' 'String'`,
  revert: `$p='HKCU:\\Control Panel\\Mouse'; Set-Reg $p 'MouseSpeed' '1' 'String'; Set-Reg $p 'MouseThreshold1' '6' 'String'; Set-Reg $p 'MouseThreshold2' '10' 'String'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Mouse' 'MouseSpeed' '0'`,
});

add({
  id: 'mouse_hover', cat: 'fps',
  name: 'Instant mouse hover response',
  desc: 'Drops the tooltip / hover delay from 400 ms to 10 ms so UI reacts immediately.',
  apply: `Set-Reg 'HKCU:\\Control Panel\\Mouse' 'MouseHoverTime' '10' 'String'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Mouse' 'MouseHoverTime' '400' 'String'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Mouse' 'MouseHoverTime' '10'`,
});

add({
  id: 'keyboard_rate', cat: 'fps', recommended: true,
  name: 'Fastest keyboard repeat rate & delay',
  desc: 'Minimum repeat delay and maximum repeat speed for snappier key input.',
  apply: `Set-Reg 'HKCU:\\Control Panel\\Keyboard' 'KeyboardDelay' '0' 'String'; Set-Reg 'HKCU:\\Control Panel\\Keyboard' 'KeyboardSpeed' '31' 'String'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Keyboard' 'KeyboardDelay' '1' 'String'; Set-Reg 'HKCU:\\Control Panel\\Keyboard' 'KeyboardSpeed' '31' 'String'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Keyboard' 'KeyboardDelay' '0'`,
});

add({
  id: 'sticky_keys', cat: 'fps', recommended: true,
  name: 'Disable Sticky / Filter / Toggle Keys shortcuts',
  desc: 'Never again get the Sticky Keys popup after spamming Shift mid-fight.',
  apply: `Set-Reg 'HKCU:\\Control Panel\\Accessibility\\StickyKeys' 'Flags' '506' 'String'
Set-Reg 'HKCU:\\Control Panel\\Accessibility\\ToggleKeys' 'Flags' '58' 'String'
Set-Reg 'HKCU:\\Control Panel\\Accessibility\\Keyboard Response' 'Flags' '122' 'String'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Accessibility\\StickyKeys' 'Flags' '510' 'String'
Set-Reg 'HKCU:\\Control Panel\\Accessibility\\ToggleKeys' 'Flags' '62' 'String'
Set-Reg 'HKCU:\\Control Panel\\Accessibility\\Keyboard Response' 'Flags' '126' 'String'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Accessibility\\StickyKeys' 'Flags' '506'`,
});

add({
  id: 'msi_gpu', cat: 'fps', recommended: true, reboot: true, risk: 'medium',
  name: 'Message Signaled Interrupts (MSI) for the GPU',
  desc: 'Switches the display adapter to Message Signaled Interrupts instead of legacy line-based IRQs, which can reduce interrupt latency.',
  apply: `Get-PnpDevice -Class Display -Status OK | ForEach-Object { Set-Reg "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties" 'MSISupported' 1 }`,
  revert: `Get-PnpDevice -Class Display -Status OK | ForEach-Object { Set-Reg "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties" 'MSISupported' 0 }`,
  check: `$d = Get-PnpDevice -Class Display -Status OK | Select-Object -First 1; if($d){ Test-RegEq "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($d.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties" 'MSISupported' 1 } else { $false }`,
});

add({
  id: 'background_apps_off', cat: 'fps', recommended: true,
  name: 'Disable background Store apps',
  desc: 'Stops UWP apps from running, syncing and pushing notifications while you game.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' 'GlobalUserDisabled' 1
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' 'BackgroundAppGlobalToggle' 0`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' 'GlobalUserDisabled' 0
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' 'BackgroundAppGlobalToggle' 1`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' 'GlobalUserDisabled' 1`,
});

add({
  id: 'spectre_off', cat: 'fps', risk: 'high', reboot: true,
  name: 'Disable Spectre / Meltdown CPU mitigations',
  desc: 'Removes kernel-level speculative-execution patches. Can recover CPU throughput in syscall-heavy workloads, at the cost of security hardening against speculative-execution attacks.',
  apply: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'; Set-Reg $p 'FeatureSettingsOverride' 3; Set-Reg $p 'FeatureSettingsOverrideMask' 3`,
  revert: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'; Remove-Reg $p 'FeatureSettingsOverride'; Remove-Reg $p 'FeatureSettingsOverrideMask'`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' 'FeatureSettingsOverride' 3`,
});

add({
  id: 'vbs_off', cat: 'fps', risk: 'high', reboot: true,
  name: 'Disable Virtualization-Based Security (VBS)',
  desc: 'Turns off the hypervisor layer Windows 11 enables by default, which costs FPS in many CPU-bound games. Also disables Hyper-V, WSL2, Windows Sandbox and Android apps. Reduces security isolation.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard' 'EnableVirtualizationBasedSecurity' 0
bcdedit /set hypervisorlaunchtype off | Out-Null`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard' 'EnableVirtualizationBasedSecurity' 1
bcdedit /set hypervisorlaunchtype auto | Out-Null`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard' 'EnableVirtualizationBasedSecurity' 0`,
});

add({
  id: 'hvci_off', cat: 'fps', risk: 'high', reboot: true,
  name: 'Disable Memory Integrity (HVCI)',
  desc: 'Core Isolation memory integrity runs kernel code-integrity checks inside the hypervisor. Disabling it is a widely used FPS fix for CPU-bound games, but removes a security layer.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' 'Enabled' 0`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' 'Enabled' 1`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' 'Enabled' 0`,
});

/* ───────────────────────── GPU (NVIDIA) ───────────────────────── */

add({
  id: 'nvidia_telemetry_off', cat: 'gpu', recommended: true, requires: 'nvidia',
  name: 'Disable NVIDIA telemetry',
  desc: 'Disables the NvTelemetryContainer service and the NvTmRep / profile-updater scheduled tasks.',
  apply: `Set-Svc 'NvTelemetryContainer' 'Disabled'
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like 'NvTmRep*' -or $_.TaskName -like 'NvProfileUpdater*' -or $_.TaskName -like 'NvDriverUpdateCheck*' -or $_.TaskName -like 'NvTmMon*' } | Disable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null`,
  revert: `Set-Svc 'NvTelemetryContainer' 'Automatic'
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like 'NvTmRep*' -or $_.TaskName -like 'NvProfileUpdater*' -or $_.TaskName -like 'NvDriverUpdateCheck*' -or $_.TaskName -like 'NvTmMon*' } | Enable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null`,
  check: `$s = Get-SvcStart 'NvTelemetryContainer'
$tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like 'NvTmRep*' -or $_.TaskName -like 'NvProfileUpdater*' })
if($s){ $s -eq 'Disabled' } elseif($tasks.Count -gt 0){ @($tasks | Where-Object State -ne 'Disabled').Count -eq 0 } else { $false }`,
});

add({
  id: 'nvidia_dpc', cat: 'gpu', recommended: true, reboot: true, requires: 'nvidia',
  name: 'NVIDIA per-core DPC handling',
  desc: 'Sets RmGpsPsEnablePerCpuCoreDpc so the NVIDIA driver can spread deferred procedure calls across CPU cores instead of core 0.',
  apply: `Get-NvidiaKeys | ForEach-Object { Set-Reg $_ 'RmGpsPsEnablePerCpuCoreDpc' 1 }`,
  revert: `Get-NvidiaKeys | ForEach-Object { Remove-Reg $_ 'RmGpsPsEnablePerCpuCoreDpc' }`,
  check: `$k = Get-NvidiaKeys | Select-Object -First 1; if($k){ Test-RegEq $k 'RmGpsPsEnablePerCpuCoreDpc' 1 } else { $false }`,
});

add({
  id: 'wu_driver_block', cat: 'gpu', recommended: true,
  name: 'Stop Windows Update from replacing GPU drivers',
  desc: 'Prevents Windows Update from replacing your GPU vendor driver with an older generic one.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' 'ExcludeWUDriversInQualityUpdate' 1
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DriverSearching' 'SearchOrderConfig' 0`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' 'ExcludeWUDriversInQualityUpdate'
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DriverSearching' 'SearchOrderConfig' 1`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' 'ExcludeWUDriversInQualityUpdate' 1`,
});

add({
  id: 'nvidia_shadercache_big', cat: 'gpu', recommended: true,
  name: 'Keep the DirectX shader cache',
  desc: 'Stops Disk Cleanup and Storage Sense from purging the D3D shader cache, so games do not recompile shaders after every cleanup (less first-load stutter).',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches\\D3D Shader Cache' 'Autorun' 0`,
  revert: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches\\D3D Shader Cache' 'Autorun' 1`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches\\D3D Shader Cache' 'Autorun' 0`,
});

/* ───────────────────────── POWER & CPU ───────────────────────── */

add({
  id: 'ultimate_plan', cat: 'power', recommended: true,
  name: 'Ultimate Performance power plan',
  desc: 'Unhides and activates Microsoft\'s Ultimate Performance scheme: no core parking, no idle throttling, instant frequency ramps.',
  apply: `$g='e9a42b02-d5df-448d-aa00-03f14749eb61'
if(-not ((powercfg /list | Out-String) -match $g)){ powercfg -duplicatescheme $g | Out-Null }
$line = (powercfg /list | Select-String 'Ultimate' | Select-Object -First 1)
if($line){ $guid = ([regex]'([0-9a-f\\-]{36})').Match($line.ToString()).Value; powercfg -setactive $guid | Out-Null } else { powercfg -setactive $g | Out-Null }`,
  revert: `powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e | Out-Null`,
  check: `[bool]((powercfg /getactivescheme | Out-String) -match 'Ultimate')`,
});

add({
  id: 'power_throttling_off', cat: 'power', recommended: true,
  name: 'Disable Power Throttling',
  desc: 'Stops Windows from pushing background and "inactive" processes into energy-saving mode — your game is never inactive.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' 'PowerThrottlingOff' 1`,
  revert: `Remove-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' 'PowerThrottlingOff'`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' 'PowerThrottlingOff' 1`,
});

add({
  id: 'core_parking_off', cat: 'power', recommended: true,
  name: 'Disable CPU core parking',
  desc: 'Keeps every CPU core unparked so there is no un-park latency when load spikes.',
  apply: `powercfg -attributes SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583 -ATTRIB_HIDE | Out-Null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583 100 | Out-Null
powercfg -setactive SCHEME_CURRENT | Out-Null`,
  revert: `powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583 10 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  check: `Test-PowerIndex SUB_PROCESSOR '0cc5b647-c1df-4637-891a-dec35c318583' 100`,
});

add({
  id: 'min_proc_state', cat: 'power', recommended: true,
  name: 'Minimum processor state 100%',
  desc: 'Prevents the CPU from dropping to low power states between frames. Trades a little idle wattage for consistent clocks.',
  apply: `powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 893dee8e-2bef-41e0-89c6-b55d0929964c 100 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  revert: `powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 893dee8e-2bef-41e0-89c6-b55d0929964c 5 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  check: `Test-PowerIndex SUB_PROCESSOR '893dee8e-2bef-41e0-89c6-b55d0929964c' 100`,
});

add({
  id: 'cstates_off', cat: 'power', risk: 'high',
  name: 'Disable CPU idle states (C-States)',
  desc: 'Forces the processor to stay in C0. Lowest possible wake latency but noticeably higher idle temps and power draw.',
  apply: `powercfg -attributes SUB_PROCESSOR 5d76a2ca-e8c0-402f-a133-2158492d58ad -ATTRIB_HIDE | Out-Null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 5d76a2ca-e8c0-402f-a133-2158492d58ad 1 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  revert: `powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR 5d76a2ca-e8c0-402f-a133-2158492d58ad 0 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  check: `Test-PowerIndex SUB_PROCESSOR '5d76a2ca-e8c0-402f-a133-2158492d58ad' 1`,
});

add({
  id: 'usb_suspend_off', cat: 'power', recommended: true,
  name: 'Disable USB selective suspend',
  desc: 'Keeps your mouse, keyboard and headset USB ports fully powered — no wake-up hitch after a few seconds idle.',
  apply: `powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  revert: `powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  check: `Test-PowerIndex '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' 0`,
});

add({
  id: 'pcie_aspm_off', cat: 'power', recommended: true,
  name: 'Disable PCI Express link power management',
  desc: 'Keeps PCI Express links (GPU, NVMe) at full power instead of letting Active State Power Management drop them to low-power states.',
  apply: `powercfg -setacvalueindex SCHEME_CURRENT 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  revert: `powercfg -setacvalueindex SCHEME_CURRENT 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 1 | Out-Null; powercfg -setactive SCHEME_CURRENT | Out-Null`,
  check: `Test-PowerIndex '501a4d13-42af-4429-9fd1-a8218c268e20' 'ee12f906-d277-404b-b6da-e5fa1a576df5' 0`,
});

add({
  id: 'fast_startup_off', cat: 'power', recommended: true,
  name: 'Disable Fast Startup',
  desc: 'Fast Startup keeps a stale kernel session across "shutdowns". Disabling it gives true clean boots and fixes many driver oddities.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' 'HiberbootEnabled' 0`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' 'HiberbootEnabled' 1`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' 'HiberbootEnabled' 0`,
});

add({
  id: 'hibernate_off', cat: 'power', recommended: true,
  name: 'Disable hibernation (free ~13 GB)',
  desc: 'Deletes hiberfil.sys, which reserves roughly 40% of installed RAM on the system drive. Sleep still works; hibernate does not.',
  apply: `powercfg /h off | Out-Null`,
  revert: `powercfg /h on | Out-Null`,
  check: `$v = Get-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled'; ($v -eq 0)`,
});

/* ───────────────────────── STORAGE & MEMORY ───────────────────────── */

add({
  id: 'mem_mgmt', cat: 'storage', recommended: true, reboot: true,
  name: 'Keep the kernel resident in RAM',
  desc: 'Keeps kernel code in RAM (DisablePagingExecutive) and favours application memory over the file cache.',
  apply: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'; Set-Reg $p 'DisablePagingExecutive' 1; Set-Reg $p 'LargeSystemCache' 0`,
  revert: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'; Set-Reg $p 'DisablePagingExecutive' 0; Set-Reg $p 'LargeSystemCache' 0`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' 'DisablePagingExecutive' 1`,
});

add({
  id: 'mem_compression_off', cat: 'storage', recommended: true,
  name: 'Disable memory compression',
  desc: 'On systems with 16 GB or more, compressing standby memory pages spends CPU time for little benefit. Disables it.',
  apply: `Disable-MMAgent -MemoryCompression -ErrorAction SilentlyContinue`,
  revert: `Enable-MMAgent -MemoryCompression -ErrorAction SilentlyContinue`,
  check: `-not (Get-MMAgent).MemoryCompression`,
});

add({
  id: 'page_combining_off', cat: 'storage', recommended: true,
  name: 'Disable page combining',
  desc: 'Stops the memory manager from periodically scanning RAM for identical pages to merge. Useful on systems with plenty of RAM.',
  apply: `Disable-MMAgent -PageCombining -ErrorAction SilentlyContinue`,
  revert: `Enable-MMAgent -PageCombining -ErrorAction SilentlyContinue`,
  check: `-not (Get-MMAgent).PageCombining`,
});

add({
  id: 'prelaunch_off', cat: 'storage',
  name: 'Disable application pre-launch',
  desc: 'Windows pre-launches Store apps it guesses you will open. Turn it off so RAM and disk go only to what you run.',
  apply: `Disable-MMAgent -ApplicationPreLaunch -ErrorAction SilentlyContinue`,
  revert: `Enable-MMAgent -ApplicationPreLaunch -ErrorAction SilentlyContinue`,
  check: `-not (Get-MMAgent).ApplicationPreLaunch`,
});

add({
  id: 'prefetch_off', cat: 'storage', reboot: true,
  name: 'Disable Prefetch & Superfetch (SSD)',
  desc: 'Prefetch mostly benefits spinning disks. On an SSD-only system it adds background tracing for little gain.',
  apply: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters'; Set-Reg $p 'EnablePrefetcher' 0; Set-Reg $p 'EnableSuperfetch' 0`,
  revert: `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters'; Set-Reg $p 'EnablePrefetcher' 3; Set-Reg $p 'EnableSuperfetch' 3`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' 'EnablePrefetcher' 0`,
});

add({
  id: 'sysmain_off', cat: 'storage', recommended: true,
  name: 'Disable SysMain service',
  desc: 'SysMain (Superfetch) preloads frequently used apps into RAM and can cause background disk activity. Little benefit on SSD systems.',
  apply: `Set-Svc 'SysMain' 'Disabled'`,
  revert: `Set-Svc 'SysMain' 'Automatic'`,
  check: `(Get-SvcStart 'SysMain') -eq 'Disabled'`,
});

add({
  id: 'ntfs_lastaccess', cat: 'storage', recommended: true,
  name: 'Disable NTFS last-access timestamps',
  desc: 'Every file read no longer triggers a metadata write. Less SSD wear, faster file access.',
  apply: `fsutil behavior set disablelastaccess 1 | Out-Null`,
  revert: `fsutil behavior set disablelastaccess 2 | Out-Null`,
  check: `[bool]((fsutil behavior query disablelastaccess | Out-String) -match '= (1|3)')`,
});

add({
  id: 'ntfs_memusage', cat: 'storage', recommended: true, reboot: true,
  name: 'Increase NTFS paged-pool memory',
  desc: 'Lets NTFS keep more metadata cached in paged-pool memory (fsutil memoryusage 2). Best on systems with 16 GB or more.',
  apply: `fsutil behavior set memoryusage 2 | Out-Null`,
  revert: `fsutil behavior set memoryusage 1 | Out-Null`,
  check: `[bool]((fsutil behavior query memoryusage | Out-String) -match '= 2')`,
});

add({
  id: 'ntfs_8dot3', cat: 'storage', reboot: true,
  name: 'Disable legacy 8.3 filename creation',
  desc: 'Stops NTFS generating DOS-style short names for every new file. Faster directory operations.',
  apply: `fsutil behavior set disable8dot3 1 | Out-Null`,
  revert: `fsutil behavior set disable8dot3 2 | Out-Null`,
  check: `[bool]((fsutil behavior query disable8dot3 | Out-String) -match 'registry state is: 1')`,
});

add({
  id: 'trim_on', cat: 'storage', recommended: true,
  name: 'Ensure SSD TRIM is enabled',
  desc: 'Verifies DeleteNotify is on so the SSD controller can garbage-collect freed blocks.',
  apply: `fsutil behavior set DisableDeleteNotify 0 | Out-Null`,
  revert: `fsutil behavior set DisableDeleteNotify 1 | Out-Null`,
  check: `[bool]((fsutil behavior query DisableDeleteNotify | Out-String) -match 'NTFS DisableDeleteNotify = 0')`,
});

add({
  id: 'wsearch_off', cat: 'storage',
  name: 'Disable Windows Search indexing',
  desc: 'Stops the indexer from crawling your drives in the background. Start-menu file search becomes slower.',
  apply: `Set-Svc 'WSearch' 'Disabled'`,
  revert: `Set-Svc 'WSearch' 'Automatic'`,
  check: `(Get-SvcStart 'WSearch') -eq 'Disabled'`,
});

/* ───────────────────────── REGISTRY TWEAKS ───────────────────────── */

add({
  id: 'shutdown_fast', cat: 'registry', recommended: true,
  name: 'Faster shutdown & app kill timeouts',
  desc: 'Cuts WaitToKillService to 2 s, auto-ends hung tasks and shortens the hung-app timeout.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' 'WaitToKillServiceTimeout' '2000' 'String'
$d='HKCU:\\Control Panel\\Desktop'; Set-Reg $d 'AutoEndTasks' '1' 'String'; Set-Reg $d 'HungAppTimeout' '1000' 'String'; Set-Reg $d 'WaitToKillAppTimeout' '2000' 'String'`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' 'WaitToKillServiceTimeout' '5000' 'String'
$d='HKCU:\\Control Panel\\Desktop'; Set-Reg $d 'AutoEndTasks' '0' 'String'; Set-Reg $d 'HungAppTimeout' '5000' 'String'; Set-Reg $d 'WaitToKillAppTimeout' '20000' 'String'`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' 'WaitToKillServiceTimeout' '2000'`,
});

add({
  id: 'startup_delay', cat: 'registry', recommended: true,
  name: 'Remove startup app delay',
  desc: 'Windows waits ~10 s after login before launching startup apps. Set it to zero.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' 'StartupDelayInMSec' 0`,
  revert: `Remove-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' 'StartupDelayInMSec'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' 'StartupDelayInMSec' 0`,
});

add({
  id: 'maintenance_off', cat: 'registry',
  name: 'Disable automatic maintenance',
  desc: 'Stops the idle-time maintenance window (defrag, updates scan, diagnostics) from kicking in while you AFK in a lobby.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\Maintenance' 'MaintenanceDisabled' 1`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\Maintenance' 'MaintenanceDisabled'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\Maintenance' 'MaintenanceDisabled' 1`,
});

add({
  id: 'pca_off', cat: 'registry',
  name: 'Disable Program Compatibility Assistant',
  desc: 'PCA watches every program launch to detect "compatibility issues". Disable the service and policy.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat' 'DisablePCA' 1; Set-Svc 'PcaSvc' 'Disabled'`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat' 'DisablePCA'; Set-Svc 'PcaSvc' 'Manual'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat' 'DisablePCA' 1`,
});

add({
  id: 'wer_off', cat: 'registry', recommended: true,
  name: 'Disable Windows Error Reporting',
  desc: 'No more crash-dump collection and upload in the background after a game crashes.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' 'Disabled' 1; Set-Svc 'WerSvc' 'Disabled'`,
  revert: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' 'Disabled' 0; Set-Svc 'WerSvc' 'Manual'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' 'Disabled' 1`,
});

add({
  id: 'no_auto_reboot', cat: 'registry', recommended: true,
  name: 'Never auto-restart for updates while logged in',
  desc: 'Windows Update cannot reboot the PC under you while a user session is active.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' 'NoAutoRebootWithLoggedOnUsers' 1`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' 'NoAutoRebootWithLoggedOnUsers'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' 'NoAutoRebootWithLoggedOnUsers' 1`,
});

add({
  id: 'explorer_opt', cat: 'registry', recommended: true,
  name: 'Optimize Windows Explorer',
  desc: 'Open to This PC, show file extensions, hide sync-provider ads and stop tracking recent documents.',
  apply: `$a='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
Set-Reg $a 'LaunchTo' 1; Set-Reg $a 'HideFileExt' 0; Set-Reg $a 'ShowSyncProviderNotifications' 0; Set-Reg $a 'Start_TrackDocs' 0`,
  revert: `$a='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
Set-Reg $a 'LaunchTo' 2; Set-Reg $a 'HideFileExt' 1; Set-Reg $a 'ShowSyncProviderNotifications' 1; Set-Reg $a 'Start_TrackDocs' 1`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'ShowSyncProviderNotifications' 0`,
});

add({
  id: 'remote_assist_off', cat: 'registry',
  name: 'Disable Remote Assistance',
  desc: 'Closes the Remote Assistance listener nobody on a gaming PC uses.',
  apply: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance' 'fAllowToGetHelp' 0`,
  revert: `Set-Reg 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance' 'fAllowToGetHelp' 1`,
  check: `Test-RegEq 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance' 'fAllowToGetHelp' 0`,
});

add({
  id: 'classic_context', cat: 'registry',
  name: 'Classic right-click context menu (Win11)',
  desc: 'Brings back the full Windows 10 context menu without the "Show more options" extra click. Restarts Explorer.',
  apply: `New-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Name '(Default)' -Value '' -Force
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep 1; if(-not (Get-Process explorer -ErrorAction SilentlyContinue)){ Start-Process explorer.exe }`,
  revert: `Remove-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}' -Recurse -Force -ErrorAction SilentlyContinue
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep 1; if(-not (Get-Process explorer -ErrorAction SilentlyContinue)){ Start-Process explorer.exe }`,
  check: `Test-Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32'`,
});

/* ───────────────────────── WINDOWS DEBLOAT ───────────────────────── */

add({
  id: 'bloat_apps_remove', cat: 'debloat', recommended: true, risk: 'medium',
  name: 'Remove preinstalled bloatware apps',
  desc: 'Uninstalls Bing News/Weather, Solitaire, Office Hub, Teams, Clipchamp, Maps, Alarms, Feedback Hub, Zune Music/Video, Skype, 3D Viewer and more for the current user.',
  apply: `foreach($n in $BloatApps){ Get-AppxPackage -Name $n -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue }`,
  revert: `foreach($n in $BloatApps){ Get-AppxPackage -AllUsers -Name $n -ErrorAction SilentlyContinue | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppXManifest.xml" -ErrorAction SilentlyContinue } }`,
  check: `$names = @((Get-AppxPackage -ErrorAction SilentlyContinue).Name); @($BloatApps | Where-Object { $names -contains $_ }).Count -eq 0`,
});

add({
  id: 'consumer_features_off', cat: 'debloat', recommended: true,
  name: 'Disable consumer features & suggested apps',
  desc: 'Stops Windows auto-installing Candy Crush / TikTok style "suggested" apps and showing promoted content.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsConsumerFeatures' 1
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableSoftLanding' 1
Set-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsSpotlightFeatures' 1`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsConsumerFeatures'
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableSoftLanding'
Remove-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsSpotlightFeatures'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableWindowsConsumerFeatures' 1`,
});

add({
  id: 'suggestions_off', cat: 'debloat', recommended: true,
  name: 'Remove ads from Settings, Start & lock screen',
  desc: 'Turns off every Content Delivery Manager toggle: Start suggestions, Settings tips, lock-screen "fun facts", silent app installs.',
  apply: `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'
foreach($n in 'ContentDeliveryAllowed','OemPreInstalledAppsEnabled','PreInstalledAppsEnabled','PreInstalledAppsEverEnabled','SilentInstalledAppsEnabled','SubscribedContent-310093Enabled','SubscribedContent-338387Enabled','SubscribedContent-338388Enabled','SubscribedContent-338389Enabled','SubscribedContent-338393Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled','SubscribedContent-353698Enabled','SystemPaneSuggestionsEnabled','SoftLandingEnabled','RotatingLockScreenOverlayEnabled'){ Set-Reg $p $n 0 }`,
  revert: `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'
foreach($n in 'ContentDeliveryAllowed','OemPreInstalledAppsEnabled','PreInstalledAppsEnabled','PreInstalledAppsEverEnabled','SilentInstalledAppsEnabled','SubscribedContent-310093Enabled','SubscribedContent-338387Enabled','SubscribedContent-338388Enabled','SubscribedContent-338389Enabled','SubscribedContent-338393Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled','SubscribedContent-353698Enabled','SystemPaneSuggestionsEnabled','SoftLandingEnabled','RotatingLockScreenOverlayEnabled'){ Set-Reg $p $n 1 }`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' 'SilentInstalledAppsEnabled' 0`,
});

add({
  id: 'widgets_off', cat: 'debloat', recommended: true,
  name: 'Disable Widgets & News feed',
  desc: 'Removes the taskbar Widgets board that pre-loads MSN news and weather in the background.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarDa' 0
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh' 'AllowNewsAndInterests' 0`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarDa' 1
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh' 'AllowNewsAndInterests'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarDa' 0`,
});

add({
  id: 'chat_off', cat: 'debloat', recommended: true,
  name: 'Disable Teams Chat taskbar icon',
  desc: 'Removes the consumer Teams "Chat" button and stops it auto-launching at login.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarMn' 0
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Chat' 'ChatIcon' 3`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarMn' 1
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Chat' 'ChatIcon'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarMn' 0`,
});

add({
  id: 'copilot_off', cat: 'debloat', recommended: true,
  name: 'Disable Windows Copilot',
  desc: 'Removes the Copilot button and blocks the Copilot sidebar via policy.',
  apply: `Set-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot' 1
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot' 1
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'ShowCopilotButton' 0`,
  revert: `Remove-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot'
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot'
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'ShowCopilotButton' 1`,
  check: `Test-RegEq 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot' 1`,
});

add({
  id: 'search_highlights_off', cat: 'debloat', recommended: true,
  name: 'Disable Search Highlights',
  desc: 'Stops the taskbar search box fetching daily Bing images and trending topics.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings' 'IsDynamicSearchBoxEnabled' 0`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings' 'IsDynamicSearchBoxEnabled' 1`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings' 'IsDynamicSearchBoxEnabled' 0`,
});

add({
  id: 'edge_background_off', cat: 'debloat', recommended: true,
  name: 'Stop Microsoft Edge running in the background',
  desc: 'Disables Edge Startup Boost and background mode so msedge.exe is not resident when you never opened it.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' 'StartupBoostEnabled' 0; Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' 'BackgroundModeEnabled' 0`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' 'StartupBoostEnabled'; Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' 'BackgroundModeEnabled'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge' 'StartupBoostEnabled' 0`,
});

add({
  id: 'onedrive_remove', cat: 'debloat', risk: 'medium',
  name: 'Uninstall OneDrive',
  desc: 'Removes the OneDrive client and blocks it from reinstalling via policy. Your files in the OneDrive folder stay on disk.',
  apply: `Get-Process OneDrive -ErrorAction SilentlyContinue | Stop-Process -Force
$s = "$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe"; if(-not (Test-Path $s)){ $s = "$env:SystemRoot\\System32\\OneDriveSetup.exe" }
if(Test-Path $s){ Start-Process $s '/uninstall' -Wait -WindowStyle Hidden }
$u = "$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDriveSetup.exe"; if(Test-Path $u){ Start-Process $u '/uninstall' -Wait -WindowStyle Hidden }
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive' 'DisableFileSyncNGSC' 1
Remove-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'OneDrive'`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive' 'DisableFileSyncNGSC'
$s = "$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe"; if(-not (Test-Path $s)){ $s = "$env:SystemRoot\\System32\\OneDriveSetup.exe" }
if(Test-Path $s){ Start-Process $s -WindowStyle Hidden }`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive' 'DisableFileSyncNGSC' 1`,
});

add({
  id: 'xbox_services_off', cat: 'debloat', risk: 'medium',
  name: 'Disable Xbox services',
  desc: 'Disables Xbox Live Auth, Game Save, Networking and Accessory services. Re-enable if you use Game Pass or Xbox sign-in.',
  apply: `foreach($s in 'XblAuthManager','XblGameSave','XboxNetApiSvc','XboxGipSvc'){ Set-Svc $s 'Disabled' }`,
  revert: `foreach($s in 'XblAuthManager','XblGameSave','XboxNetApiSvc','XboxGipSvc'){ Set-Svc $s 'Manual' }`,
  check: `(Get-SvcStart 'XblAuthManager') -eq 'Disabled'`,
});

add({
  id: 'print_spooler_off', cat: 'debloat', risk: 'medium',
  name: 'Disable Print Spooler',
  desc: 'No printer? The spooler is a resident service and a frequent security target. Disable it.',
  apply: `Set-Svc 'Spooler' 'Disabled'`,
  revert: `Set-Svc 'Spooler' 'Automatic'`,
  check: `(Get-SvcStart 'Spooler') -eq 'Disabled'`,
});

add({
  id: 'fax_off', cat: 'debloat', recommended: true,
  name: 'Disable Fax service',
  desc: 'Disables the Windows Fax service, which few gaming PCs need.',
  apply: `Set-Svc 'Fax' 'Disabled'`,
  revert: `Set-Svc 'Fax' 'Manual'`,
  check: `$s = Get-SvcStart 'Fax'; ($null -eq $s) -or ($s -eq 'Disabled')`,
});

add({
  id: 'insider_off', cat: 'debloat', recommended: true,
  name: 'Disable Windows Insider service',
  desc: 'Stops the Insider Program service that checks for preview builds.',
  apply: `Set-Svc 'wisvc' 'Disabled'`,
  revert: `Set-Svc 'wisvc' 'Manual'`,
  check: `(Get-SvcStart 'wisvc') -eq 'Disabled'`,
});

add({
  id: 'delivery_opt_off', cat: 'debloat', recommended: true,
  name: 'Disable Delivery Optimization (P2P updates)',
  desc: 'Stops your PC uploading Windows Update chunks to strangers and downloading from them. Frees bandwidth and disk.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' 'DODownloadMode' 0
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config' 'DODownloadMode' 0`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' 'DODownloadMode'
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config' 'DODownloadMode' 1`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' 'DODownloadMode' 0`,
});

/* ───────────────────────── PRIVACY & TELEMETRY ───────────────────────── */

add({
  id: 'telemetry_off', cat: 'privacy', recommended: true,
  name: 'Disable Windows telemetry',
  desc: 'Sets diagnostic data to Security-only and disables the DiagTrack and dmwappushservice collectors.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'AllowTelemetry' 0
Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection' 'AllowTelemetry' 0
Set-Svc 'DiagTrack' 'Disabled'; Set-Svc 'dmwappushservice' 'Disabled'`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'AllowTelemetry'
Remove-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection' 'AllowTelemetry'
Set-Svc 'DiagTrack' 'Automatic'; Set-Svc 'dmwappushservice' 'Manual'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'AllowTelemetry' 0`,
});

add({
  id: 'cortana_off', cat: 'privacy', recommended: true,
  name: 'Disable Cortana',
  desc: 'Blocks Cortana via policy so it never loads with the search host.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search' 'AllowCortana' 0`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search' 'AllowCortana'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search' 'AllowCortana' 0`,
});

add({
  id: 'bing_search_off', cat: 'privacy', recommended: true,
  name: 'Disable Bing in Start menu search',
  desc: 'Start search stays local — no web results, no keystrokes sent to Bing.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' 'BingSearchEnabled' 0
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' 'CortanaConsent' 0
Set-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' 'DisableSearchBoxSuggestions' 1`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' 'BingSearchEnabled' 1
Remove-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' 'DisableSearchBoxSuggestions'`,
  check: `Test-RegEq 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' 'DisableSearchBoxSuggestions' 1`,
});

add({
  id: 'adv_id_off', cat: 'privacy', recommended: true,
  name: 'Disable advertising ID',
  desc: 'Stops apps from using a per-user advertising identifier to profile you.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' 'Enabled' 0
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo' 'DisabledByGroupPolicy' 1`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' 'Enabled' 1
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo' 'DisabledByGroupPolicy'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' 'Enabled' 0`,
});

add({
  id: 'activity_history_off', cat: 'privacy', recommended: true,
  name: 'Disable Activity History / Timeline',
  desc: 'Windows stops logging which apps and files you use and stops uploading that log to Microsoft.',
  apply: `$p='HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System'; Set-Reg $p 'EnableActivityFeed' 0; Set-Reg $p 'PublishUserActivities' 0; Set-Reg $p 'UploadUserActivities' 0`,
  revert: `$p='HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System'; Remove-Reg $p 'EnableActivityFeed'; Remove-Reg $p 'PublishUserActivities'; Remove-Reg $p 'UploadUserActivities'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' 'PublishUserActivities' 0`,
});

add({
  id: 'location_off', cat: 'privacy',
  name: 'Disable location tracking',
  desc: 'Denies location access system-wide and disables the location platform.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location' 'Value' 'Deny' 'String'
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors' 'DisableLocation' 1`,
  revert: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location' 'Value' 'Allow' 'String'
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors' 'DisableLocation'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors' 'DisableLocation' 1`,
});

add({
  id: 'feedback_off', cat: 'privacy', recommended: true,
  name: 'Disable feedback requests',
  desc: 'No more "How likely are you to recommend Windows?" prompts and feedback notifications.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Siuf\\Rules' 'NumberOfSIUFInPeriod' 0; Set-Reg 'HKCU:\\Software\\Microsoft\\Siuf\\Rules' 'PeriodInNanoSeconds' 0
Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'DoNotShowFeedbackNotifications' 1`,
  revert: `Remove-Reg 'HKCU:\\Software\\Microsoft\\Siuf\\Rules' 'NumberOfSIUFInPeriod'; Remove-Reg 'HKCU:\\Software\\Microsoft\\Siuf\\Rules' 'PeriodInNanoSeconds'
Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'DoNotShowFeedbackNotifications'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'DoNotShowFeedbackNotifications' 1`,
});

add({
  id: 'tailored_off', cat: 'privacy', recommended: true,
  name: 'Disable tailored experiences',
  desc: 'Stops Microsoft using your diagnostic data to personalise tips, ads and recommendations.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy' 'TailoredExperiencesWithDiagnosticDataEnabled' 0
Set-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableTailoredExperiencesWithDiagnosticData' 1`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy' 'TailoredExperiencesWithDiagnosticDataEnabled' 1
Remove-Reg 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\CloudContent' 'DisableTailoredExperiencesWithDiagnosticData'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy' 'TailoredExperiencesWithDiagnosticDataEnabled' 0`,
});

add({
  id: 'remote_registry_off', cat: 'privacy', recommended: true,
  name: 'Disable Remote Registry',
  desc: 'Nobody should be editing your registry over the network.',
  apply: `Set-Svc 'RemoteRegistry' 'Disabled'`,
  revert: `Set-Svc 'RemoteRegistry' 'Manual'`,
  check: `(Get-SvcStart 'RemoteRegistry') -eq 'Disabled'`,
});

add({
  id: 'llmnr_off', cat: 'privacy',
  name: 'Disable LLMNR name resolution',
  desc: 'Turns off multicast name resolution — a chatty, spoofable legacy protocol.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient' 'EnableMulticast' 0`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient' 'EnableMulticast'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient' 'EnableMulticast' 0`,
});

/* ───────────────────────── NETWORK & PING ───────────────────────── */

add({
  id: 'nagle_off', cat: 'network', recommended: true, reboot: true,
  name: "Disable Nagle's algorithm",
  desc: 'Sends small TCP packets immediately instead of batching them. Helps TCP-based games and launchers; most shooters use UDP and are unaffected.',
  apply: `Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { Set-Reg $_.PSPath 'TcpAckFrequency' 1; Set-Reg $_.PSPath 'TCPNoDelay' 1; Set-Reg $_.PSPath 'TcpDelAckTicks' 0 }`,
  revert: `Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { Remove-Reg $_.PSPath 'TcpAckFrequency'; Remove-Reg $_.PSPath 'TCPNoDelay'; Remove-Reg $_.PSPath 'TcpDelAckTicks' }`,
  check: `$hit=$false; Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { if(Test-RegEq $_.PSPath 'TcpAckFrequency' 1){ $hit=$true } }; $hit`,
});

add({
  id: 'net_throttle_off', cat: 'network', recommended: true,
  name: 'Disable network throttling',
  desc: 'Windows rate-limits non-multimedia network traffic to 10 packets/ms. Set NetworkThrottlingIndex to off.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex' -1`,
  revert: `Set-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex' 10`,
  check: `$v = Get-Reg 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex'; ($v -eq -1) -or ($v -eq 4294967295)`,
});

add({
  id: 'tcp_optimize', cat: 'network', recommended: true,
  name: 'Optimize TCP stack for gaming',
  desc: 'Disables RSC, ECN and TCP timestamps, sets normal auto-tuning and CTCP congestion control.',
  apply: `netsh int tcp set global autotuninglevel=normal | Out-Null
netsh int tcp set global rsc=disabled | Out-Null
netsh int tcp set global ecncapability=disabled | Out-Null
netsh int tcp set global timestamps=disabled | Out-Null
netsh int tcp set supplemental internet congestionprovider=ctcp | Out-Null`,
  revert: `netsh int tcp set global autotuninglevel=normal | Out-Null
netsh int tcp set global rsc=enabled | Out-Null
netsh int tcp set global ecncapability=default | Out-Null
netsh int tcp set global timestamps=default | Out-Null
netsh int tcp set supplemental internet congestionprovider=default | Out-Null`,
  check: `[bool]((netsh int tcp show global | Out-String) -match 'Receive Segment Coalescing State\\s*:\\s*disabled')`,
});

add({
  id: 'dns_cloudflare', cat: 'network', risk: 'medium',
  name: 'Use Cloudflare DNS (1.1.1.1)',
  desc: 'Sets Cloudflare (1.1.1.1) as the DNS resolver on every active adapter. Speeds up name lookups on many ISPs, not game ping. Revert restores DHCP-assigned DNS.',
  apply: `Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('1.1.1.1','1.0.0.1') -ErrorAction SilentlyContinue }; ipconfig /flushdns | Out-Null`,
  revert: `Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue }; ipconfig /flushdns | Out-Null`,
  check: `$hit=$false; Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { $d = (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses; if($d -contains '1.1.1.1'){ $hit=$true } }; $hit`,
});

add({
  id: 'net_adapter_power', cat: 'network', recommended: true,
  name: 'Stop Windows powering down the network adapter',
  desc: 'Clears "Allow the computer to turn off this device to save power" on every NIC.',
  apply: `Get-NetAdapter -Physical | ForEach-Object { Disable-NetAdapterPowerManagement -Name $_.Name -ErrorAction SilentlyContinue }`,
  revert: `Get-NetAdapter -Physical | ForEach-Object { Enable-NetAdapterPowerManagement -Name $_.Name -ErrorAction SilentlyContinue }`,
  check: `$a = Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1; if($a){ $p = Get-NetAdapterPowerManagement -Name $a.Name -ErrorAction SilentlyContinue; if($p){ $p.AllowComputerToTurnOffDevice -eq 'Disabled' } else { $false } } else { $false }`,
});

add({
  id: 'net_offloads', cat: 'network', risk: 'medium',
  name: 'Disable NIC interrupt moderation & flow control',
  desc: 'Interrupt moderation batches packets to save CPU at the cost of a little latency. Disabling it delivers packets immediately. Only applies to adapters that expose these settings.',
  apply: `Get-NetAdapter -Physical | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $_.Name -DisplayName 'Interrupt Moderation' -DisplayValue 'Disabled' -ErrorAction SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $_.Name -DisplayName 'Flow Control' -DisplayValue 'Disabled' -ErrorAction SilentlyContinue }`,
  revert: `Get-NetAdapter -Physical | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $_.Name -DisplayName 'Interrupt Moderation' -DisplayValue 'Enabled' -ErrorAction SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $_.Name -DisplayName 'Flow Control' -DisplayValue 'Rx & Tx Enabled' -ErrorAction SilentlyContinue }`,
  check: `$a = Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1; if($a){ $p = Get-NetAdapterAdvancedProperty -Name $a.Name -DisplayName 'Interrupt Moderation' -ErrorAction SilentlyContinue; if($p){ $p.DisplayValue -eq 'Disabled' } else { $false } } else { $false }`,
});

/* ───────────────────────── VISUAL & UI ───────────────────────── */

add({
  id: 'animations_off', cat: 'visual', recommended: true,
  name: 'Disable window animations & visual effects',
  desc: 'Best-performance visual settings: no window fade, no taskbar animation, no menu slide. Sign out to fully apply.',
  apply: `Set-Reg 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' 'MinAnimate' '0' 'String'
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarAnimations' 0
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' 'VisualFXSetting' 3
Set-Reg 'HKCU:\\Control Panel\\Desktop' 'UserPreferencesMask' ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) 'Binary'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' 'MinAnimate' '1' 'String'
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'TaskbarAnimations' 1
Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' 'VisualFXSetting' 0
Set-Reg 'HKCU:\\Control Panel\\Desktop' 'UserPreferencesMask' ([byte[]](0x9E,0x1E,0x07,0x80,0x12,0x00,0x00,0x00)) 'Binary'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' 'MinAnimate' '0'`,
});

add({
  id: 'transparency_off', cat: 'visual', recommended: true,
  name: 'Disable transparency effects',
  desc: 'Acrylic blur on the taskbar and Start menu is rendered by the GPU every frame. Turn it off.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' 'EnableTransparency' 0`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' 'EnableTransparency' 1`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' 'EnableTransparency' 0`,
});

add({
  id: 'menu_delay', cat: 'visual', recommended: true,
  name: 'Instant menus (MenuShowDelay 0)',
  desc: 'Context menus and submenus open with zero delay.',
  apply: `Set-Reg 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '0' 'String'`,
  revert: `Set-Reg 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '400' 'String'`,
  check: `Test-RegEq 'HKCU:\\Control Panel\\Desktop' 'MenuShowDelay' '0'`,
});

add({
  id: 'aero_shake_off', cat: 'visual',
  name: 'Disable Aero Shake',
  desc: 'Stops windows minimising when you shake one by the title bar.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'DisallowShaking' 1`,
  revert: `Remove-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'DisallowShaking'`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'DisallowShaking' 1`,
});

add({
  id: 'lockscreen_off', cat: 'visual',
  name: 'Skip the lock screen',
  desc: 'Boots straight to the password prompt instead of the Spotlight lock screen image.',
  apply: `Set-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization' 'NoLockScreen' 1`,
  revert: `Remove-Reg 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization' 'NoLockScreen'`,
  check: `Test-RegEq 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization' 'NoLockScreen' 1`,
});

add({
  id: 'thumbnails_off', cat: 'visual',
  name: 'Show icons instead of thumbnails',
  desc: 'Explorer stops generating image and video thumbnails, which avoids disk activity when browsing large folders.',
  apply: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'IconsOnly' 1`,
  revert: `Set-Reg 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'IconsOnly' 0`,
  check: `Test-RegEq 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' 'IconsOnly' 1`,
});

const BLOAT_APPS = [
  'Microsoft.BingNews', 'Microsoft.BingWeather', 'Microsoft.BingSearch', 'Microsoft.GetHelp', 'Microsoft.Getstarted',
  'Microsoft.MicrosoftOfficeHub', 'Microsoft.MicrosoftSolitaireCollection', 'Microsoft.People', 'Microsoft.Todos',
  'Microsoft.WindowsAlarms', 'Microsoft.WindowsFeedbackHub', 'Microsoft.WindowsMaps', 'Microsoft.ZuneMusic',
  'Microsoft.ZuneVideo', 'Microsoft.PowerAutomateDesktop', 'Clipchamp.Clipchamp', 'MicrosoftTeams', 'MSTeams',
  'microsoft.windowscommunicationsapps', 'Microsoft.549981C3F5F10', 'Microsoft.Microsoft3DViewer',
  'Microsoft.MixedReality.Portal', 'Microsoft.SkypeApp', 'Microsoft.Wallet', 'Microsoft.OutlookForWindows',
  'Microsoft.Copilot', 'Microsoft.Windows.DevHome', 'Microsoft.MicrosoftJournal', 'Microsoft.WindowsSoundRecorder',
];

const PRESETS = {
  lite:  { name: 'Lite',  blurb: 'Recommended tweaks with no functional trade-off. Apply and forget.',        filter: t => t.recommended && t.risk === 'safe' },
  power: { name: 'Power', blurb: 'Everything in Lite plus medium-risk latency tweaks (MSI, Nagle, tick).', filter: t => t.recommended && t.risk !== 'high' },
  max:   { name: 'Max',   blurb: 'Power plus VBS, HVCI and CPU-mitigation removal. Most performance, least security isolation.', filter: t => t.recommended || t.risk === 'high' },
};

// A tweak is user-scope when it only touches HKCU registry values, so it can run without elevation.
const ADMIN_PATTERN = /HKLM|Set-Svc|bcdedit|powercfg|fsutil|netsh|MMAgent|PnpDevice|NetAdapter|Appx|ScheduledTask|Process|DnsClient|OneDrive|Get-NvidiaKeys|ipconfig/i;
for (const t of T) t.userScope = !ADMIN_PATTERN.test(t.apply) && !ADMIN_PATTERN.test(t.revert);

module.exports = { TWEAKS: T, CATEGORIES, BLOAT_APPS, PRESETS };
