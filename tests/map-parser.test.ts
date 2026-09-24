import { describe, expect, test } from "bun:test";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseMapFile, parseMapFilesBatch } from "../src/main/scanner/map-parser.js";

describe("Map parser engine", () => {
  test("parseMapFile extracts choices and video calls", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "nlt-map-test-"));
    try {
      const mapPath = path.join(tmp, "Map042.json");
      const mockMap = {
        events: [
          null,
          {
            id: 1,
            pages: [
              {
                list: [
                  { code: 102, parameters: [["Special Midnight Date", "Cancel"], 0, 0, 1] },
                  { code: 357, parameters: ["PKD_VPlayer", "ShowVAnim", "", { id: "Pr-Night1" }] },
                  // Bogus choice that should be ignored
                  { code: 102, parameters: [["normal"], 0, 0, 1] },
                  { code: 355, parameters: ["playVideo('Pr-Normal')"] },
                ],
              },
            ],
          },
        ],
      };
      await fsp.writeFile(mapPath, JSON.stringify(mockMap), "utf8");

      const results = await parseMapFile(mapPath);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ vid: "Pr-Night1", title: "Special Midnight Date" });
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("parseMapFile returns empty array for invalid file", async () => {
    const results = await parseMapFile("/non/existent/path/Map999.json");
    expect(results).toEqual([]);
  });

  test("parseMapFilesBatch parses maps in batches and calls onProgress", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "nlt-map-batch-"));
    try {
      const map1 = {
        events: [
          {
            pages: [
              {
                list: [
                  { code: 102, parameters: [["Beach Fun"]] },
                  { code: 355, parameters: ["loadVideo('SoBeach1')"] },
                ],
              },
            ],
          },
        ],
      };
      const map2 = {
        events: [
          {
            pages: [
              {
                list: [
                  { code: 102, parameters: [["Forest Hike"]] },
                  { code: 355, parameters: ["newVideo('AlForest1')"] },
                ],
              },
            ],
          },
        ],
      };

      await fsp.writeFile(path.join(tmp, "Map001.json"), JSON.stringify(map1), "utf8");
      await fsp.writeFile(path.join(tmp, "Map002.json"), JSON.stringify(map2), "utf8");

      const progressEvents: any[] = [];
      const batchResult = await parseMapFilesBatch(
        tmp,
        ["Map001.json", "Map002.json"],
        {
          batchSize: 1,
          onProgress: (p) => progressEvents.push(p),
        }
      );

      expect(batchResult["SoBeach1"]).toEqual(["Beach Fun"]);
      expect(batchResult["AlForest1"]).toEqual(["Forest Hike"]);
      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
});
