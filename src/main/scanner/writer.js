/**
 * Atomic index file persistence.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';

export async function writeIndex(outPath, entries) {
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const tmpPath = `${outPath}.tmp`;
  await fsp.writeFile(
    tmpPath,
    `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(',\n')}\n]\n`,
    'utf8',
  );
  await fsp.rm(outPath, { force: true }).catch(() => {});
  await fsp.rename(tmpPath, outPath);
}
