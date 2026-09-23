import fsp from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, statOrNull } from './config.js';

/** Resolve a cache entry name, refusing anything that escapes `.cache`. */
export function resolveCachePath(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('a cache entry name is required');
  }
  const target = path.resolve(CACHE_DIR, name);
  const relative = path.relative(CACHE_DIR, target);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`refusing to touch paths outside .cache: ${name}`);
  }
  return target;
}

export async function readCache(name) {
  const target = resolveCachePath(name);
  const stat = await statOrNull(target);
  if (!stat || !stat.isFile()) return null;
  const text = await fsp.readFile(target, 'utf8');
  return {
    name: name.split(path.sep).join('/'),
    path: target,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    text,
  };
}
