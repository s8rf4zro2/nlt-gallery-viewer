/**
 * Scanner & Map Parser Worker.
 *
 * Runs inside a dedicated Node.js worker_thread in Electron or CLI runtime.
 * Offloads all file listing, stat operations, JSON map parsing,
 * dialogue extraction, pairing, and index writing completely off the main thread.
 */

import { parentPort } from 'node:worker_threads';
import { scanGame, scanAll } from './orchestrator.js';
import { parseMapFilesBatch, parseMapFile } from './map-parser.js';

if (parentPort) {
  parentPort.on('message', async (message) => {
    if (!message || typeof message !== 'object') return;
    const { taskId, action, payload } = message;

    const onProgress = (prog) => {
      parentPort.postMessage({
        type: 'progress',
        taskId,
        data: prog,
      });
    };

    try {
      let result;
      switch (action) {
        case 'scanGame':
          result = await scanGame({ ...payload, onProgress });
          break;

        case 'scanAll':
          result = await scanAll({ onProgress });
          break;

        case 'parseMaps':
          result = await parseMapFilesBatch(payload.dataDir, payload.mapFiles, {
            batchSize: payload.batchSize || 16,
            onProgress,
          });
          break;

        case 'parseMapFile':
          result = await parseMapFile(payload.filePath);
          break;

        default:
          throw new Error(`Unknown scanner worker action: ${action}`);
      }

      parentPort.postMessage({
        type: 'result',
        taskId,
        result,
      });
    } catch (err) {
      parentPort.postMessage({
        type: 'error',
        taskId,
        error: err.message || String(err),
        stack: err.stack,
      });
    }
  });
}
