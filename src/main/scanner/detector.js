import fsp from 'node:fs/promises';
import path from 'node:path';
import { VIDEO_EXTENSIONS } from './constants.js';

export async function detectMoviesDir(folderPath) {
  if (!folderPath || typeof folderPath !== 'string') {
    return { gameDir: folderPath, moviesDir: null, count: 0 };
  }

  const normalized = path.resolve(folderPath).replace(/\\/g, '/');
  try {
    const st = await fsp.stat(normalized);
    if (!st.isDirectory()) return { gameDir: normalized, moviesDir: null, count: 0 };
  } catch {
    return { gameDir: normalized, moviesDir: null, count: 0 };
  }

  const candidates = [
    `${normalized}/www/movies`,
    `${normalized}/movies`,
    normalized,
  ];

  for (const candidate of candidates) {
    try {
      const st = await fsp.stat(candidate);
      if (st.isDirectory()) {
        const files = await fsp.readdir(candidate);
        const count = files.filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return VIDEO_EXTENSIONS.includes(ext);
        }).length;
        if (count > 0) {
          return {
            gameDir: normalized,
            moviesDir: candidate,
            count,
          };
        }
      }
    } catch {
      // not found, continue
    }
  }

  return { gameDir: normalized, moviesDir: null, count: 0 };
}

export async function detectGamesFromParent(parentDir) {
  const results = {};
  if (!parentDir || typeof parentDir !== 'string') return results;

  const normalized = path.resolve(parentDir).replace(/\\/g, '/');
  try {
    const entries = await fsp.readdir(normalized, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subPath = `${normalized}/${entry.name}`;
      const lower = entry.name.toLowerCase();

      if (lower.includes('nadia') && !results.nadia) {
        const detected = await detectMoviesDir(subPath);
        if (detected.count > 0) results.nadia = detected;
      }
      if (lower.includes('genesis') && !results.genesis) {
        const detected = await detectMoviesDir(subPath);
        if (detected.count > 0) results.genesis = detected;
      }
      if ((lower.includes('symphony') || lower.includes('serpent')) && !results.symphony) {
        const detected = await detectMoviesDir(subPath);
        if (detected.count > 0) results.symphony = detected;
      }
    }
  } catch {
    // ignore
  }

  return results;
}
