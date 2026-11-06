// Development-only screen recorder used to produce README and trailer footage.
// It records the real application from Chromium's offscreen compositor while a
// script drives the UI. Never loaded in packaged builds (see CAPTURE in main.js).
//
// Script format (JSON):
// { "out": "dir", "width": 1920, "height": 1080, "fps": 30, "zoom": 1.2,
//   "warmup": 20000, "duration": 12, "steps": [ { "at": 1.5, "js": "..." } ] }
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helpers injected into the renderer so scripts stay short and readable.
const DIRECTOR = `
window.__dir = {
  click(sel) { const el = document.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.click(); return true; },
  scroll(y, ms = 1200, sel = '#content') {
    const el = document.querySelector(sel), from = el.scrollTop, t0 = performance.now();
    el.style.scrollBehavior = 'auto';
    return new Promise(res => { const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      el.scrollTop = from + (y - from) * e; k < 1 ? requestAnimationFrame(step) : res(true); }; requestAnimationFrame(step); });
  },
};
true;`;

exports.record = (win, cfg, app) => {
  const out = cfg.out;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const index = [];
  let recording = false, t0 = 0, n = 0, pending = 0;

  win.setContentSize(cfg.width, cfg.height);
  win.webContents.setFrameRate(cfg.fps || 30);
  win.webContents.on('paint', (_e, _dirty, image) => {
    if (!recording) return;
    const t = Date.now() - t0;
    const name = `f${String(n++).padStart(5, '0')}.jpg`;
    index.push({ t, name });
    pending++;
    fs.writeFile(path.join(out, name), image.toJPEG(94), () => { pending--; });
  });

  win.webContents.once('did-finish-load', async () => {
    if (cfg.zoom) win.webContents.setZoomFactor(cfg.zoom);
    await win.webContents.executeJavaScript(DIRECTOR);
    await sleep(cfg.warmup || 20000);
    for (const js of cfg.setup || []) await win.webContents.executeJavaScript(js).catch(e => console.error('setup', e.message));
    await sleep(cfg.setupWait || 800);
    recording = true; t0 = Date.now();
    for (const step of cfg.steps || []) {
      const wait = step.at * 1000 - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
      if (step.js) win.webContents.executeJavaScript(step.js).catch(e => console.error('step', step.at, e.message));
    }
    const rest = cfg.duration * 1000 - (Date.now() - t0);
    if (rest > 0) await sleep(rest);
    recording = false;
    while (pending > 0) await sleep(50);
    fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ fps: cfg.fps || 30, duration: cfg.duration, frames: index }));
    console.log(`captured ${index.length} frames to ${out}`);
    for (const js of cfg.teardown || []) await win.webContents.executeJavaScript(js).catch(() => {});
    await sleep(cfg.teardownWait || 0);
    app.quit();
  });
};
