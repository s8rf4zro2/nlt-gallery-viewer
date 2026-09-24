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

export function terminateScannerWorker() {
  if (activeWorker) {
    try {
      activeWorker.terminate();
    } catch {}
    activeWorker = null;
  }
  pendingTasks.clear();
}

export async function scanGameWithWorker({ game, dir, gameDir, out, onProgress }) {
  return executeInWorker('scanGame', { game, dir, gameDir, out }, onProgress);
}

export async function scanAllWithWorker({ onProgress } = {}) {
  return executeInWorker('scanAll', {}, onProgress);
}

export async function parseMapsWithWorker({ dataDir, mapFiles, batchSize, onProgress } = {}) {
  return executeInWorker('parseMaps', { dataDir, mapFiles, batchSize }, onProgress);
}
