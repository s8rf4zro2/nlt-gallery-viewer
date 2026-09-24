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

export async function scanGame({ game, dir, gameDir, out, onProgress }) {
  const started = Date.now();
  if (typeof onProgress === 'function') {
    onProgress({
      game,
      step: 'reading',
      percent: 10,
      message: `Scanning ${game}: reading movies directory…`,
    });
  }

  const fileNames = await fsp.readdir(dir);
  const candidates = await statAll(dir, fileNames);

  if (typeof onProgress === 'function') {
    onProgress({
      game,
      step: 'dialogue',
      percent: 30,
      message: `Scanning ${game}: extracting game dialogue & choices…`,
    });
  }

  let [gameIndex, terms] = await Promise.all([
    loadJsonFile(path.join(CACHE_DIR, 'game-index.json')),
    loadJsonFile(path.join(CACHE_DIR, 'terms.json')),
  ]);

  if (!gameIndex || typeof gameIndex !== 'object') {
    gameIndex = {};
  }

  const extracted = await extractGameDialogue(game, gameDir, dir, {
    onProgress: (p) => {
      if (typeof onProgress === 'function') {
        onProgress({ game, ...p });
      }
    },
  });
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

  if (typeof onProgress === 'function') {
    onProgress({
      game,
      step: 'pairing',
      percent: 80,
      message: `Scanning ${game}: classifying & pairing ${candidates.length} clips…`,
    });
  }

  const entries = pairCandidates(game, candidates, gameIndex, terms);
  entries.sort(
    (a, b) => compareNatural(a.prefix, b.prefix) || compareNatural(a.name, b.name),
  );

  if (typeof onProgress === 'function') {
    onProgress({
      game,
      step: 'saving',
      percent: 95,
      message: `Scanning ${game}: saving index (${entries.length} scenes)…`,
    });
  }

  await writeIndex(out, entries);

  if (typeof onProgress === 'function') {
    onProgress({
      game,
      step: 'done',
      percent: 100,
      message: `Scanning ${game}: complete (${entries.length} scenes).`,
    });
  }

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

export async function scanAll({ onProgress } = {}) {
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
        onProgress,
      }),
    );
  }
  return results;
}
