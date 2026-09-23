/**
 * Natural sort and video file classification.
 */

import fsp from 'node:fs/promises';
import { VIDEO_EXTENSIONS } from './constants.js';
import { stripLiteSuffix } from './stem.js';

export function compareNatural(a, b) {
  const ax = a.match(/\d+|\D+/g) ?? [a];
  const bx = b.match(/\d+|\D+/g) ?? [b];
  const n = Math.max(ax.length, bx.length);
  for (let i = 0; i < n; i++) {
    const x = ax[i];
    const y = bx[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const bothNumeric = x.charCodeAt(0) <= 57 && y.charCodeAt(0) <= 57;
    if (bothNumeric) {
      const delta = Number(x) - Number(y);
      if (delta !== 0) return delta;
    }
    return x < y ? -1 : 1;
  }
  return 0;
}

export function classify(fileName, filePath, size) {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = fileName.slice(dot).toLowerCase();
  const rank = VIDEO_EXTENSIONS.indexOf(ext);
  if (rank === -1) return null;
  const stem = fileName.slice(0, dot);
  return {
    path: filePath.replace(/\\/g, '/'),
    rank,
    size,
    lite: stem.endsWith('-l'),
    base: stripLiteSuffix(stem),
  };
}

export async function statAll(dir, fileNames) {
  const normalizedDir = dir.replace(/\\/g, '/');
  const results = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = `${normalizedDir}/${fileName}`;
      try {
        const info = await fsp.stat(filePath);
        if (!info.isFile()) return null;
        return classify(fileName, filePath, info.size);
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}
