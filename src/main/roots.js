import fsp from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, ROOTS_FILE, statOrNull } from './config.js';

/** Roots supplied out-of-band via environment variable, e.g. `NLT_GAMES_ROOT="/path/to/games"`. */
export function rootsFromEnvironment() {
  const raw = process.env.NLT_GAMES_ROOT;
  if (!raw) return [];
  return raw
    .split(new RegExp(`[${path.delimiter === ';' ? ';' : ':'},]`))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

export async function getRootsConfig() {
  const stat = await statOrNull(ROOTS_FILE);
  if (!stat || !stat.isFile()) {
    return {
      roots: rootsFromEnvironment(),
      games: {},
      updatedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(await fsp.readFile(ROOTS_FILE, 'utf8'));
    const roots = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.roots) ? parsed.roots : [];
    const games = parsed?.games && typeof parsed.games === 'object' ? parsed.games : {};
    return {
      roots: roots.filter((entry) => typeof entry === 'string' && entry.trim() !== ''),
      games,
      updatedAt: parsed?.updatedAt || null,
    };
  } catch (err) {
    console.warn(`[nlt] ignoring unreadable ${ROOTS_FILE}: ${err.message}`);
    return {
      roots: rootsFromEnvironment(),
      games: {},
      updatedAt: null,
    };
  }
}

let inMemoryRoots = null;

export async function saveRootsConfig({ roots = [], games = {} } = {}) {
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  const allRoots = new Set(roots);
  for (const game of Object.values(games)) {
    if (game.gameDir) allRoots.add(path.resolve(game.gameDir));
    if (game.moviesDir) allRoots.add(path.resolve(game.moviesDir));
  }

  // Update in-memory roots cache immediately so protocol handler permits streaming media with zero race
  inMemoryRoots = [...allRoots];

  const payload = {
    roots: inMemoryRoots,
    games,
    updatedAt: new Date().toISOString(),
  };

  const tmpPath = `${ROOTS_FILE}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  await fsp.rm(ROOTS_FILE, { force: true }).catch(() => {});
  await fsp.rename(tmpPath, ROOTS_FILE);
  return payload;
}

export function addAllowedRoots(newRoots) {
  if (!Array.isArray(newRoots)) return;
  if (!inMemoryRoots) inMemoryRoots = rootsFromEnvironment();
  const set = new Set(inMemoryRoots);
  for (const r of newRoots) {
    if (r) set.add(path.resolve(r));
  }
  inMemoryRoots = [...set];
}

/**
 * Read-only roots list consumed by the media allow-list.
 */
export async function readRoots() {
  if (inMemoryRoots) return inMemoryRoots;
  const cfg = await getRootsConfig();
  inMemoryRoots = cfg.roots;
  return inMemoryRoots;
}
