'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('nlt', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  app: {
    info: () => call('nlt:app:info'),
  },

  cache: {
    read: (name) => call('nlt:cache:read', name),
    readJson: async (name) => {
      const entry = await call('nlt:cache:read', name);
      if (!entry || typeof entry.text !== 'string') return null;
      try {
        return JSON.parse(entry.text);
      } catch {
        return null;
      }
    },
  },

  dialog: {
    selectFolder: (defaultPath) => call('nlt:dialog:selectFolder', defaultPath),
  },

  games: {
    detect: (folderPath) => call('nlt:games:detect', folderPath),
    getConfig: () => call('nlt:games:getConfig'),
    saveAndScan: (gamesConfig) => call('nlt:games:saveAndScan', gamesConfig),
    onScanProgress: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('nlt:scan:progress', listener);
      return () => ipcRenderer.removeListener('nlt:scan:progress', listener);
    },
  },

  media: {
    scheme: 'nlt-media',
    url: (absolutePath) => {
      if (typeof absolutePath !== 'string' || absolutePath.trim() === '') {
        throw new Error('nlt.media.url(absolutePath) needs a non-empty string');
      }
      return `nlt-media://local/${encodeURIComponent(absolutePath.trim().replace(/\\/g, '/'))}`;
    },
  },

  shell: {
    showItem: (target) => call('nlt:shell:showItem', target),
  },
});
