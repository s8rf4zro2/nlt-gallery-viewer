import { app, BrowserWindow, nativeTheme } from 'electron';
import { registerIpc } from './src/main/ipc.js';
import { registerMediaSchemes, registerMediaProtocol } from './src/main/protocol.js';
import { createWindow } from './src/main/window.js';

// Force dark mode for native UI, context menus, and select popups regardless of OS mode
nativeTheme.themeSource = 'dark';

// Register privileged schemes before app is ready
registerMediaSchemes();

app.whenReady().then(() => {
  registerIpc();
  registerMediaProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
