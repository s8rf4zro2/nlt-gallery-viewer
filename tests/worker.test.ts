import { describe, expect, test, afterAll } from "bun:test";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  scanGameWithWorker,
  parseMapsWithWorker,
  terminateScannerWorker,
  executeInWorker,
} from "../src/main/scanner/worker-client.js";

describe("Scanner & Map Parser Worker", () => {
  afterAll(() => {
    terminateScannerWorker();
  });

  test("executeInWorker rejects gracefully on unknown action", async () => {
    await expect(
      executeInWorker("unknown_action_test" as any, {})
    ).rejects.toThrow("Unknown");
  });

  test("parseMapsWithWorker parses map files inside worker thread with progress", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "nlt-worker-maps-"));
    try {
      const map1 = {
        events: [
          {
            pages: [
              {
                list: [
                  { code: 102, parameters: [["Secret Cavern Encounter"]] },
                  { code: 355, parameters: ["playVideo('EvCavern1')"] },
                ],
              },
            ],
          },
        ],
      };
      await fsp.writeFile(path.join(tmp, "Map010.json"), JSON.stringify(map1), "utf8");

      const progressEvents: any[] = [];
      const result = await parseMapsWithWorker({
        dataDir: tmp,
        mapFiles: ["Map010.json"],
        batchSize: 1,
        onProgress: (p) => progressEvents.push(p),
      });

      expect(result["EvCavern1"]).toEqual(["Secret Cavern Encounter"]);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].step).toBe("maps");
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("scanGameWithWorker scans game folder in worker thread and writes index", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "nlt-worker-scan-"));
    try {
      const moviesDir = path.join(tmp, "www", "movies");
      const outIndex = path.join(tmp, "index-test.json");
      await fsp.mkdir(moviesDir, { recursive: true });

      // Create dummy clip files
      await fsp.writeFile(path.join(moviesDir, "BC-Alia1.mp4"), "fake-mp4-data", "utf8");
      await fsp.writeFile(path.join(moviesDir, "BC-Alia1-l.webm"), "fake-webm-data", "utf8");

      const progressList: any[] = [];
      const res = await scanGameWithWorker({
        game: "nadia",
        dir: moviesDir,
        gameDir: tmp,
        out: outIndex,
        onProgress: (prog) => progressList.push(prog),
      });

      expect(res.game).toBe("nadia");
      expect(res.entries).toBe(1);
      expect(res.files).toBe(2);
      expect(progressList.length).toBeGreaterThan(0);

      // Verify written index file
      const written = JSON.parse(await fsp.readFile(outIndex, "utf8"));
      expect(written).toHaveLength(1);
      expect(written[0].name).toBe("BC-Alia1");
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
});
