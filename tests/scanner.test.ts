import { describe, expect, test } from "bun:test";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compareNatural,
  classify,
  pairCandidates,
  findGameDataDir,
  extractGameDialogue,
  cleanDialogueText,
  resolveSpeaker,
} from "../src/main/scanner.js";

describe("scanner classifier and sorting", () => {
  test("compareNatural", () => {
    const list = ["AgVl10", "AgVl2", "AgVl1", "AgVl20"];
    list.sort(compareNatural);
    expect(list).toEqual(["AgVl1", "AgVl2", "AgVl10", "AgVl20"]);
  });

  test("classify", () => {
    expect(classify("BC-He-AS2.mp4", "/movies/BC-He-AS2.mp4", 1000)).toEqual({
      path: "/movies/BC-He-AS2.mp4",
      rank: 0,
      size: 1000,
      lite: false,
      base: "BC-He-AS2",
    });

    expect(classify("BC-He-AS2-l.webm", "/movies/BC-He-AS2-l.webm", 500)).toEqual({
      path: "/movies/BC-He-AS2-l.webm",
      rank: 1,
      size: 500,
      lite: true,
      base: "BC-He-AS2",
    });

    // Ignored non-video files
    expect(classify("debug.txt", "/movies/debug.txt", 10)).toBeNull();
  });

  test("pairCandidates attaches dialogue if present in gameIndex", () => {
    const candidates = [
      classify("clip1.mp4", "/movies/clip1.mp4", 1000)!,
      classify("clip1-l.mp4", "/movies/clip1-l.mp4", 400)!,
    ];
    const mockGameIndex = {
      nadia: {
        root: "/game",
        videos: {
          clip1: {
            video: "clip1",
            scene: "Test Scene",
            titles: ["Sample Cutscene"],
            characters: ["Pricia"],
            sources: ["CE:1"],
            dialogue: [
              { speaker: "Pricia", text: "Hello there." },
              { speaker: "Hero", text: "Hi!" },
            ],
          },
        },
      },
    };

    const entries = pairCandidates("nadia", candidates, mockGameIndex);
    expect(entries.length).toBe(1);
    expect(entries[0]!.id).toBe("nadia:clip1");
    expect(entries[0]!.hi).toBe("/movies/clip1.mp4");
    expect(entries[0]!.lo).toBe("/movies/clip1-l.mp4");
    expect(entries[0]!.sizeHi).toBe(1000);
    expect(entries[0]!.sizeLo).toBe(400);
    expect(entries[0]!.dialogue).toEqual([
      { speaker: "Pricia", text: "Hello there." },
      { speaker: "Hero", text: "Hi!" },
    ]);
  });
});

describe("in-app dialogue extraction engine", () => {
  test("resolveSpeaker and cleanDialogueText", () => {
    expect(resolveSpeaker("he", "genesis")).toBe("Heather");
    expect(resolveSpeaker("al", "nadia")).toBe("Alia");
    expect(resolveSpeaker("gr", "symphony")).toBe("Grace");
    expect(resolveSpeaker("unknown", "genesis")).toBe("Michael");

    expect(cleanDialogueText("\\c[2]Hello 1Hero!\\^", "genesis")).toBe("Hello Michael!");
    expect(cleanDialogueText("> Jessica: Wow!", "nadia")).toBe("Jessica: Wow!");
  });

  test("findGameDataDir and extractGameDialogue from RPG Maker structure", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "nlt-test-game-"));
    try {
      const dataDir = path.join(tmp, "www", "data");
      const moviesDir = path.join(tmp, "www", "movies");
      await fsp.mkdir(dataDir, { recursive: true });
      await fsp.mkdir(moviesDir, { recursive: true });

      // Create mock CommonEvents.json
      const mockCE = [
        null,
        {
          id: 1,
          name: "SCN - Pricia Date",
          list: [
            { code: 357, parameters: ["PKD_VPlayer", "ShowVAnim", "", { id: "Pr-Date1", isLoop: "false" }] },
            { code: 230, parameters: [120] },
            { code: 355, parameters: ['$gameVariables.setValue(21, "pr.You look great!")'] },
            { code: 355, parameters: ['$gameVariables.setValue(21, "he.Thanks Pricia.")'] },
          ],
        },
      ];
      await fsp.writeFile(path.join(dataDir, "CommonEvents.json"), JSON.stringify(mockCE), "utf8");

      const found = await findGameDataDir(tmp, moviesDir);
      expect(found).not.toBeNull();

      const extracted = await extractGameDialogue("nadia", tmp, moviesDir);
      expect(extracted).not.toBeNull();
      expect(extracted!.videos["Pr-Date1"]).toBeDefined();
      expect(extracted!.videos["Pr-Date1"].scene).toBe("Pricia Date");
      expect(extracted!.videos["Pr-Date1"].dialogue).toEqual([
        { speaker: "Pricia", text: "You look great!", time: 2 },
        { speaker: "Hero", text: "Thanks Pricia.", time: 2 },
      ]);
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
});
