import electron from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = typeof electron === 'object' && electron !== null && 'app' in electron ? electron.app : null;

const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || null;

if (PORTABLE_DIR && app?.setPath) {
  try {
    app.setPath('userData', path.join(PORTABLE_DIR, 'data', 'user-data'));
  } catch {
    // ignore if already set
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Project root when running from source or packaged. */
export const PROJECT_ROOT = app?.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..', '..');

/**
 * The `.cache` directory:
 * - Portable mode: next to the portable executable
 * - Packaged standard mode: per-user writable appData
 * - Development mode: next to project sources
 */
export const CACHE_DIR = PORTABLE_DIR
  ? path.join(PORTABLE_DIR, '.cache')
  : (app?.isPackaged
      ? path.join(app.getPath('userData'), '.cache')
      : path.join(PROJECT_ROOT, '.cache'));

/** Games roots are user data, but keeping them in `.cache` lets `bun run scan` share them. */
export const ROOTS_FILE = path.join(CACHE_DIR, 'roots.json');

export const MEDIA_SCHEME = 'nlt-media';

export async function statOrNull(target) {
  try {
    return await fsp.stat(target);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}
