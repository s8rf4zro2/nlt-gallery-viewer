/**
 * Worker client bridge for game scanning and map parsing.
 *
 * Spawns and communicates with the background worker_thread.
 * Provides fallback to current thread if worker threads are unavailable.
 */

import { Worker } from 'node:worker_threads';
import { scanGame, scanAll } from './orchestrator.js';
import { parseMapFilesBatch, parseMapFile } from './map-parser.js';

let activeWorker = null;
let taskCounter = 0;
const pendingTasks = new Map();

function createWorker() {
  if (activeWorker) return activeWorker;

  const workerUrl = new URL('./scanner-worker.js', import.meta.url);
  const worker = new Worker(workerUrl);

  worker.on('message', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const { type, taskId, data, result, error, stack } = msg;
    const task = pendingTasks.get(taskId);
    if (!task) return;

    if (type === 'progress') {
      if (typeof task.onProgress === 'function') {
        task.onProgress(data);
      }
    } else if (type === 'result') {
      pendingTasks.delete(taskId);
      task.resolve(result);
    } else if (type === 'error') {
      pendingTasks.delete(taskId);
      const err = new Error(error || 'Worker task failed');
      if (stack) err.stack = stack;
      task.reject(err);
    }
  });

  worker.on('error', (err) => {
    // Reject all pending tasks on worker error
    for (const [taskId, task] of pendingTasks.entries()) {
      pendingTasks.delete(taskId);
      task.reject(err);
    }
    terminateScannerWorker();
  });

  worker.on('exit', () => {
    for (const [taskId, task] of pendingTasks.entries()) {
      pendingTasks.delete(taskId);
      task.reject(new Error('Scanner worker exited prematurely'));
    }
    activeWorker = null;
  });

  activeWorker = worker;
  return activeWorker;
}

/**
 * Execute an action in the background worker thread.
 * Automatically falls back to in-process execution if workers fail.
 */
export async function executeInWorker(action, payload = {}, onProgress = null) {
  let worker;
  let taskId;
  try {
    worker = createWorker();
    taskId = `task_${++taskCounter}_${Date.now()}`;
  } catch (workerSpawnErr) {
    console.warn(
      '[ScannerWorker] Worker thread initialization failed, falling back to main thread:',
      workerSpawnErr.message,
    );
    return executeDirect(action, payload, onProgress);
  }

  return new Promise((resolve, reject) => {
    pendingTasks.set(taskId, { resolve, reject, onProgress });
    try {
      worker.postMessage({ taskId, action, payload });
    } catch (postErr) {
      pendingTasks.delete(taskId);
      console.warn(
        '[ScannerWorker] postMessage failed, falling back to main thread:',
        postErr.message,
      );
      executeDirect(action, payload, onProgress).then(resolve, reject);
    }
  });
}

/**
 * Direct fallback execution on the calling thread.
 */
async function executeDirect(action, payload, onProgress) {
  switch (action) {
    case 'scanGame':
      return scanGame({ ...payload, onProgress });
    case 'scanAll':
      return scanAll({ onProgress });
    case 'parseMaps':
      return parseMapFilesBatch(payload.dataDir, payload.mapFiles, {
        batchSize: payload.batchSize || 16,
        onProgress,
      });
    case 'parseMapFile':
      return parseMapFile(payload.filePath);
    default:
      throw new Error(`Unknown direct action: ${action}`);
  }
}

/**
 * Terminate the background worker when idle or when cleaning up.
 */
export function terminateScannerWorker() {
  if (activeWorker) {
    try {
      activeWorker.terminate();
    } catch {}
    activeWorker = null;
  }
  pendingTasks.clear();
}

/**
 * Scan a single game using the background worker thread.
 */
export async function scanGameWithWorker({ game, dir, gameDir, out, onProgress }) {
  return executeInWorker('scanGame', { game, dir, gameDir, out }, onProgress);
}

/**
 * Scan all configured games using the background worker thread.
 */
export async function scanAllWithWorker({ onProgress } = {}) {
  return executeInWorker('scanAll', {}, onProgress);
}

/**
 * Parse an array of map files using the background worker thread.
 */
export async function parseMapsWithWorker({ dataDir, mapFiles, batchSize, onProgress } = {}) {
  return executeInWorker('parseMaps', { dataDir, mapFiles, batchSize }, onProgress);
}
