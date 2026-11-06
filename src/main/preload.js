const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('horizon', {
  win: {
    minimize: () => invoke('win:minimize'),
    maximize: () => invoke('win:maximize'),
    close: () => invoke('win:close'),
    isMaximized: () => invoke('win:isMaximized'),
    onState: (cb) => ipcRenderer.on('win:state', (_e, s) => cb(s)),
  },
  sys: {
    info: () => invoke('sys:info'),
    relaunchAdmin: () => invoke('sys:relaunchAdmin'),
    openExternal: (u) => invoke('sys:openExternal', u),
    openPath: (p) => invoke('sys:openPath', p),
    reboot: () => invoke('sys:reboot'),
    history: () => invoke('sys:history'),
    getSettings: () => invoke('sys:settings:get'),
    setSettings: (o) => invoke('sys:settings:set', o),
  },
  scan: { full: () => invoke('scan:full'), cached: () => invoke('scan:cached') },
  stats: { onTick: (cb) => ipcRenderer.on('stats:tick', (_e, s) => cb(s)) },
  tweaks: {
    list: () => invoke('tweaks:list'),
    checkAll: () => invoke('tweaks:checkAll'),
    apply: (id) => invoke('tweaks:apply', id),
    revert: (id) => invoke('tweaks:revert', id),
  },
  boosts: { list: () => invoke('boosts:list'), run: (id) => invoke('boosts:run', id) },
  programs: {
    list: () => invoke('programs:list'),
    icons: (l) => invoke('programs:icons', l),
    uninstall: (e, o) => invoke('programs:uninstall', e, o),
    removeAppx: (n) => invoke('programs:removeAppx', n),
    setStartup: (i, en) => invoke('programs:setStartup', i, en),
    removeStartup: (i) => invoke('programs:removeStartup', i),
    openLocation: (p) => invoke('programs:openLocation', p),
    bloatList: () => invoke('programs:bloatList'),
  },
});
