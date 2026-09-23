import { app, dialog, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { PROJECT_ROOT, CACHE_DIR } from './config.js';
import { getRootsConfig, saveRootsConfig } from './roots.js';
import { readCache } from './cache.js';
import { detectMoviesDir, detectGamesFromParent, scanGame } from './scanner.js';

export function registerIpc() {
  ipcMain.handle('nlt:app:info', () => ({
    name: 'nlt-gallery-viewer',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    projectRoot: PROJECT_ROOT,
    cacheDir: CACHE_DIR,
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('nlt:cache:read', (_event, name) => readCache(name));

  ipcMain.handle('nlt:shell:showItem', (_event, target) => {
    shell.showItemInFolder(path.resolve(String(target)));
    return true;
  });

  ipcMain.handle('nlt:dialog:selectFolder', async (_event, defaultPath) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow, {
      title: 'Select Game Folder',
      properties: ['openDirectory'],
      defaultPath: defaultPath || undefined,
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0].replace(/\\/g, '/');
  });

  ipcMain.handle('nlt:games:detect', async (_event, folderPath) => {
    const single = await detectMoviesDir(folderPath);
    const parent = await detectGamesFromParent(folderPath);
    return { single, parent };
  });

  ipcMain.handle('nlt:games:getConfig', async () => {
    const config = await getRootsConfig();
    const gamesStatus = {};
    for (const [gameKey, gameData] of Object.entries(config.games || {})) {
      const target = gameData.moviesDir || gameData.gameDir;
      const detected = await detectMoviesDir(target);
      gamesStatus[gameKey] = {
        ...gameData,
        valid: Boolean(detected.moviesDir && detected.count > 0),
        count: detected.count,
      };
    }
    return {
      ...config,
      games: gamesStatus,
    };
  });

  ipcMain.handle('nlt:games:saveAndScan', async (_event, gamesConfig) => {
    const current = await getRootsConfig();
    const updatedGames = { ...current.games };
    const scanResults = [];

    for (const [gameKey, paths] of Object.entries(gamesConfig || {})) {
      if (!paths || !paths.moviesDir) continue;
      const gameDir = paths.gameDir || paths.moviesDir;
      updatedGames[gameKey] = {
        gameDir,
        moviesDir: paths.moviesDir,
      };
      const outPath = path.join(CACHE_DIR, `index-${gameKey}.json`);
      const res = await scanGame({
        game: gameKey,
        dir: paths.moviesDir,
        gameDir,
        out: outPath,
      });
      scanResults.push(res);
    }

    await saveRootsConfig({ roots: current.roots, games: updatedGames });
    return { success: true, results: scanResults };
  });
}
