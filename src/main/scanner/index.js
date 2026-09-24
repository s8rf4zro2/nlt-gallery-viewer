/**
 * Scanner module index.
 * Re-exports all submodules for complete backward compatibility.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR } from '../config.js';
import { scanAll } from './orchestrator.js';

export * from './constants.js';
export * from './stem.js';
export * from './classifier.js';
export * from './dialogue.js';
export * from './pairer.js';
export * from './writer.js';
export * from './detector.js';
export * from './orchestrator.js';
export * from './map-parser.js';
export * from './worker-client.js';

if (
  import.meta.main ||
  (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
) {
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  const results = await scanAll();
  for (const result of results) {
    console.log(
      `wrote ${result.out}\n` +
        `  game=${result.game} files=${result.files} entries=${result.entries} ` +
        `withLo=${result.withLo} loOnly=${result.loOnly} in ${result.ms}ms`,
    );
  }
}
