/**
 * Scan orchestration for single games and entire library.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../config.js';
import { getRootsConfig } from '../roots.js';
import { compareNatural, statAll } from './classifier.js';
import { detectGamesFromParent } from './detector.js';
import { extractGameDialogue } from './dialogue.js';
import { pairCandidates } from './pairer.js';
import { writeIndex } from './writer.js';

async function loadJsonFile(target) {
  try {
    return JSON.parse(await fsp.readFile(target, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Scan one game and write its index atomically.
 */
export async function scanGame({ game, dir, gameDir, out }) {
  const started = Date.now();
  const fileNames = await fsp.readdir(dir);
  const candidates = await statAll(dir, fileNames);

  let [gameIndex, terms] = await Promise.all([
    loadJsonFile(path.join(CACHE_DIR, 'game-index.json')),
    loadJsonFile(path.join(CACHE_DIR, 'terms.json')),
  ]);

  if (!gameIndex || typeof gameIndex !== 'object') {
    gameIndex = {};
  }

  // Extract game data and dialogue directly from game files if available
  const extracted = await extractGameDialogue(game, gameDir, dir);
  if (extracted) {
    gameIndex[game] = extracted;
    try {
      await fsp.mkdir(CACHE_DIR, { recursive: true });
      await fsp.writeFile(
        path.join(CACHE_DIR, 'game-index.json'),
        JSON.stringify(gameIndex, null, 2),
        'utf8',
      );
    } catch {}
  }

  const entries = pairCandidates(game, candidates, gameIndex, terms);
  entries.sort(
    (a, b) => compareNatural(a.prefix, b.prefix) || compareNatural(a.name, b.name),
  );

  await writeIndex(out, entries);

  return {
    game,
    out,
    files: fileNames.length,
    entries: entries.length,
    withLo: entries.filter((entry) => entry.lo !== null).length,
    loOnly: entries.filter((entry) => entry.hi === null).length,
    ms: Date.now() - started,
  };
}

/**
 * Scan all configured games.
 */
export async function scanAll() {
  const config = await getRootsConfig();
  const results = [];
  const gamesToScan = {};

  if (config.games && Object.keys(config.games).length > 0) {
    for (const [key, val] of Object.entries(config.games)) {
      if (val.moviesDir) gamesToScan[key] = val;
    }
  }

  // If no games configured in roots.json, try parent auto-detect on common paths
  if (Object.keys(gamesToScan).length === 0) {
    for (const fallback of ['D:/games', 'C:/games']) {
      try {
        const detected = await detectGamesFromParent(fallback);
        for (const [k, d] of Object.entries(detected)) {
          if (!gamesToScan[k] && d.moviesDir) {
            gamesToScan[k] = d;
          }
        }
      } catch {}
    }
  }

  for (const [game, paths] of Object.entries(gamesToScan)) {
    const out = path.join(CACHE_DIR, `index-${game}.json`);
    results.push(
      await scanGame({
        game,
        dir: paths.moviesDir,
        gameDir: paths.gameDir || paths.moviesDir,
        out,
      }),
    );
  }
  return results;
}
