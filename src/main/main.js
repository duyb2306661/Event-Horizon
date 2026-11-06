const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const { runPS, runJSON, psQuote } = require('./powershell');
const { TWEAKS, CATEGORIES, PRESETS, BLOAT_APPS } = require('./tweaks');
const { BOOSTS } = require('./boosts');

const BACKEND = path.join(__dirname, '..', 'backend');
const readScript = (n) => fs.readFileSync(path.join(BACKEND, n), 'utf8');

let win = null;
let isAdmin = false;
// Development-only switches. Ignored in packaged builds.
const DEV = !app.isPackaged;
const CAPTURE = DEV && process.env.HORIZON_CAPTURE ? JSON.parse(fs.readFileSync(process.env.HORIZON_CAPTURE, 'utf8')) : null;
const DEMO = DEV && (!!process.env.HORIZON_DEMO || !!CAPTURE);
if (CAPTURE) app.commandLine.appendSwitch('force-device-scale-factor', '1');

/* ───────────── persistence ───────────── */
function dataFile(name) { return path.join(app.getPath('userData'), name); }
function loadJSON(name, fallback) { try { return JSON.parse(fs.readFileSync(dataFile(name), 'utf8')); } catch { return fallback; } }
function saveJSON(name, obj) { try { fs.writeFileSync(dataFile(name), JSON.stringify(obj, null, 2)); } catch {} }
function appendLog(entry) {
  const log = loadJSON('history.json', []);
  log.unshift(Object.assign({ at: new Date().toISOString() }, entry));
  saveJSON('history.json', log.slice(0, 500));
}

/* ───────────── admin / elevation ───────────── */
function checkAdmin() {
  return new Promise((resolve) => {
    execFile('net', ['session'], { windowsHide: true }, (err) => resolve(!err));
  });
}

function relaunchElevated() {
  return new Promise((resolve) => {
    const exe = process.execPath;
    const args = app.isPackaged ? [] : [app.getAppPath()];
    const argList = args.length ? `-ArgumentList ${args.map(a => psQuote(`"${a}"`)).join(',')}` : '';
    const cmd = `try { Start-Process -FilePath ${psQuote(exe)} ${argList} -Verb RunAs -ErrorAction Stop; exit 0 } catch { exit 1 }`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

function openHttps(url) {
  try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch {}
}

/* ───────────── window ───────────── */
function createWindow() {
  win = new BrowserWindow({
    width: CAPTURE ? CAPTURE.width : 1380, height: CAPTURE ? CAPTURE.height : 860, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#04040c', show: false, useContentSize: true, enableLargerThanScreen: !!CAPTURE,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      offscreen: !!CAPTURE,
    },
  });
  if (CAPTURE) require('./capture').record(win, CAPTURE, app);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!CAPTURE) win.show(); startStatsWorker(); });
  if (DEV && process.env.HORIZON_SHOT) {
    const [file, page, delay] = process.env.HORIZON_SHOT.split('|');
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (page) await win.webContents.executeJavaScript(`document.querySelector('[data-page="${page}"]').click()`);
      await new Promise(r => setTimeout(r, Number(delay || 8000)));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(file, img.toPNG()); app.quit();
    }, 2500));
  }
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
  win.webContents.setWindowOpenHandler(({ url }) => { openHttps(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.whenReady().then(async () => {
  isAdmin = await checkAdmin();
  // HORIZON_NO_ELEVATE=1 opens the UI without a UAC prompt (read-only use; user-level tweaks still work).
  if (!isAdmin && !process.env.HORIZON_NO_ELEVATE && !CAPTURE) {
    const ok = await relaunchElevated();
    if (ok) { app.quit(); return; }
  }
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ───────────── IPC: window ───────────── */
ipcMain.handle('win:minimize', () => win.minimize());
ipcMain.handle('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());
ipcMain.handle('win:isMaximized', () => win.isMaximized());

/* ───────────── IPC: system ───────────── */
ipcMain.handle('sys:info', () => ({
  isAdmin, version: app.getVersion(), packaged: app.isPackaged, userData: app.getPath('userData'), demo: DEMO,
}));
ipcMain.handle('sys:relaunchAdmin', async () => {
  const ok = await relaunchElevated();
  if (ok) app.quit();
  return ok;
});
ipcMain.handle('sys:openExternal', (_e, url) => openHttps(url));
ipcMain.handle('sys:openPath', (_e, p) => shell.openPath(p));
ipcMain.handle('sys:reboot', () => { spawn('shutdown', ['/r', '/t', '5', '/c', 'Event Horizon: rebooting to apply tweaks'], { windowsHide: true }); });
ipcMain.handle('sys:history', () => loadJSON('history.json', []));
ipcMain.handle('sys:settings:get', () => loadJSON('settings.json', {}));
ipcMain.handle('sys:settings:set', (_e, obj) => { saveJSON('settings.json', Object.assign(loadJSON('settings.json', {}), obj)); return true; });

/* ───────────── IPC: scan & stats ───────────── */
// Demo mode hides identifiers (host and user names, MAC addresses, memory part numbers) for screenshots and videos.
function redact(scan) {
  if (!DEMO || !scan) return scan;
  const s = JSON.parse(JSON.stringify(scan));
  s.host.name = 'HORIZON-RIG'; s.host.user = 'Commander';
  (s.nics || []).forEach(n => { n.mac = '••-••-••-••-••-••'; });
  (s.ram.modules || []).forEach(m => { m.part = ''; m.maker = ''; });
  return s;
}
ipcMain.handle('scan:full', async () => {
  const data = await runJSON(readScript('scan.ps1'), { timeout: 60000 });
  saveJSON('lastscan.json', data);
  return redact(data);
});
ipcMain.handle('scan:cached', () => redact(loadJSON('lastscan.json', null)));
/* streaming stats worker */
let statsProc = null;
function startStatsWorker() {
  if (statsProc) return;
  // PowerShell cannot read files inside app.asar, so materialise the script on disk first.
  const dir = path.join(app.getPath('userData'), 'scripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'stats-worker.ps1');
  fs.writeFileSync(file, '﻿' + readScript('stats-worker.ps1'), 'utf8');
  const logFile = path.join(app.getPath('userData'), 'stats-worker.log');
  statsProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, '-ParentPid', String(process.pid)], { windowsHide: true });
  statsProc.stderr.on('data', (d) => { try { fs.appendFileSync(logFile, d.toString('utf8')); } catch {} });
  statsProc.on('error', (e) => { try { fs.appendFileSync(logFile, `spawn error: ${e}\n`); } catch {} });
  let buf = '';
  statsProc.stdout.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('{')) continue;
      try { const obj = JSON.parse(line); if (win && !win.isDestroyed()) win.webContents.send('stats:tick', obj); } catch {}
    }
  });
  statsProc.on('close', () => { statsProc = null; if (!app.isQuitting) setTimeout(startStatsWorker, 3000); });
}
app.on('before-quit', () => { app.isQuitting = true; if (statsProc) try { statsProc.kill(); } catch {} });

/* ───────────── IPC: tweaks ───────────── */
const publicTweak = (t) => ({ id: t.id, cat: t.cat, name: t.name, desc: t.desc, risk: t.risk, reboot: t.reboot, recommended: t.recommended, requires: t.requires || null, userScope: t.userScope });
ipcMain.handle('tweaks:list', () => ({
  tweaks: TWEAKS.map(publicTweak), categories: CATEGORIES,
  presets: Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, { name: p.name, blurb: p.blurb, ids: TWEAKS.filter(p.filter).map(t => t.id) }])),
}));

ipcMain.handle('tweaks:checkAll', async () => {
  const body = ['$r = [ordered]@{}'];
  for (const t of TWEAKS) {
    body.push(`try { $r['${t.id}'] = [bool](& { ${t.check} }) } catch { $r['${t.id}'] = $false }`);
  }
  body.push('$r | ConvertTo-Json -Compress');
  return runJSON(body.join('\n'), { timeout: 120000 });
});

async function runTweak(id, action) {
  const t = TWEAKS.find(x => x.id === id);
  if (!t) return { ok: false, error: 'Unknown tweak' };
  if (!isAdmin && !t.userScope) return { ok: false, error: 'Administrator rights required' };
  const script = (action === 'apply' ? t.apply : t.revert) + `\n"__DONE__"\ntry { $__c = [bool](& { ${t.check} }) } catch { $__c = $false }\n"__STATE__=$__c"`;
  const r = await runPS(script, { timeout: 240000 });
  const applied = /__STATE__=True/i.test(r.stdout);
  const ok = r.stdout.includes('__DONE__') && (action === 'apply' ? applied : !applied);
  appendLog({ type: 'tweak', id, name: t.name, action, ok });
  return { ok, applied, output: r.stdout.replace(/__DONE__|__STATE__=\w+/g, '').trim(), stderr: r.stderr.trim(), reboot: t.reboot };
}
ipcMain.handle('tweaks:apply', (_e, id) => runTweak(id, 'apply'));
ipcMain.handle('tweaks:revert', (_e, id) => runTweak(id, 'revert'));

/* ───────────── IPC: boosts ───────────── */
ipcMain.handle('boosts:list', () => BOOSTS.map(b => ({ id: b.id, cat: b.cat, glyph: b.glyph, name: b.name, desc: b.desc })));
ipcMain.handle('boosts:run', async (_e, id) => {
  const b = BOOSTS.find(x => x.id === id);
  if (!b) return { ok: false, error: 'Unknown boost' };
  const r = await runPS(b.script, { timeout: 300000 });
  const output = r.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || 'Done.';
  appendLog({ type: 'boost', id, name: b.name, ok: r.code === 0, output });
  return { ok: r.code === 0, output, stderr: r.stderr.trim() };
});

/* ───────────── IPC: programs ───────────── */
ipcMain.handle('programs:list', async () => runJSON(readScript('programs.ps1'), { timeout: 120000 }));

ipcMain.handle('programs:icons', async (_e, list) => {
  const cache = loadJSON('icons.json', {});
  const missing = list.filter(p => p && !(p in cache)).slice(0, 80);
  if (missing.length) {
    const body = `$IconList = @(${missing.map(psQuote).join(',')})\n` + readScript('icons.ps1');
    try {
      const got = await runJSON(body, { timeout: 60000 });
      for (const p of missing) cache[p] = got[p] || null;
      saveJSON('icons.json', cache);
    } catch { for (const p of missing) cache[p] = null; }
  }
  return Object.fromEntries(list.map(p => [p, cache[p] || null]));
});

ipcMain.handle('programs:uninstall', async (_e, entry, { silent = false } = {}) => {
  let cmd = (silent && entry.quietUninstall) ? entry.quietUninstall : entry.uninstall;
  if (!cmd) return { ok: false, error: 'No uninstall command' };
  if (/msiexec/i.test(cmd)) {
    cmd = cmd.replace(/\/I\s*\{/i, '/X {').replace(/\/I(?=\{)/i, '/X');
    if (silent) cmd += ' /qn /norestart'; else if (!/\/q|\/passive/i.test(cmd)) cmd += ' /passive';
  }
  appendLog({ type: 'uninstall', name: entry.name, cmd });
  const r = await runPS(`Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ${psQuote(cmd)} -Wait -WindowStyle Hidden; "ok"`, { prelude: false, timeout: 600000 });
  return { ok: r.code === 0, output: r.stdout.trim() };
});

ipcMain.handle('programs:removeAppx', async (_e, fullName) => {
  const r = await runPS(`Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object PackageFullName -eq ${psQuote(fullName)} | Remove-AppxPackage -ErrorAction Stop; "ok"`, { timeout: 120000 });
  appendLog({ type: 'removeAppx', name: fullName, ok: r.stdout.includes('ok') });
  return { ok: r.stdout.includes('ok'), error: r.stderr.trim() };
});

ipcMain.handle('programs:setStartup', async (_e, item, enabled) => {
  const hive = item.scope === 'User' ? 'HKCU:' : 'HKLM:';
  let script;
  if (item.source === 'Scheduled Task') {
    script = `$t = Get-ScheduledTask -TaskName ${psQuote(item.name)} -TaskPath ${psQuote(item.kind)} -ErrorAction SilentlyContinue; if($t){ if(${enabled ? '$true' : '$false'}){ $t | Enable-ScheduledTask | Out-Null } else { $t | Disable-ScheduledTask | Out-Null } }; "ok"`;
  } else {
    const sub = item.source === 'Folder' ? 'StartupFolder' : item.kind;
    const bytes = enabled ? '0x02,0,0,0,0,0,0,0,0,0,0,0' : '0x03,0,0,0,0,0,0,0,0,0,0,0';
    script = `Set-Reg '${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${sub}' ${psQuote(item.name)} ([byte[]](${bytes})) 'Binary'; "ok"`;
  }
  const r = await runPS(script, { timeout: 30000 });
  return { ok: r.stdout.includes('ok'), error: r.stderr.trim() };
});

ipcMain.handle('programs:removeStartup', async (_e, item) => {
  const hive = item.scope === 'User' ? 'HKCU:' : 'HKLM:';
  let script;
  if (item.source === 'Folder') script = `Remove-Item -LiteralPath ${psQuote(item.command)} -Force; "ok"`;
  else if (item.source === 'Scheduled Task') script = `Unregister-ScheduledTask -TaskName ${psQuote(item.name)} -TaskPath ${psQuote(item.kind)} -Confirm:$false; "ok"`;
  else {
    const p = item.kind === 'Run32' ? `${hive}\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run` : `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
    script = `Remove-Reg '${p}' ${psQuote(item.name)}; "ok"`;
  }
  const r = await runPS(script, { timeout: 30000 });
  appendLog({ type: 'removeStartup', name: item.name, ok: r.stdout.includes('ok') });
  return { ok: r.stdout.includes('ok'), error: r.stderr.trim() };
});

ipcMain.handle('programs:openLocation', (_e, p) => { if (p && fs.existsSync(p)) shell.openPath(p); });
ipcMain.handle('programs:bloatList', () => BLOAT_APPS);
