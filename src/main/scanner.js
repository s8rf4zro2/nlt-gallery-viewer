import { scanAll } from './scanner/orchestrator.js';

export * from './scanner/index.js';

if (import.meta.main) {
  await scanAll();
}
