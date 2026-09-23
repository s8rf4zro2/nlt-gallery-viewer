import { describe, expect, test } from "bun:test";
import { formatBytes, formatTime, num, toPath } from "../renderer/modules/format";
import { countScenes, groupEntries, normalizeEntry } from "../renderer/modules/grouping";
import { scenePlayer } from "../renderer/player/player-controller";

describe("renderer format utilities", () => {
  test("formatBytes", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
    expect(formatBytes(1024 * 1024 * 120)).toBe("120 MB");
  });

  test("formatTime", () => {
    expect(formatTime(-1)).toBe("–");
    expect(formatTime(NaN)).toBe("–");
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3605)).toBe("60:05");
  });

  test("num", () => {
    expect(num("123")).toBe(123);
    expect(num("-5")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(null)).toBe(0);
  });

  test("toPath", () => {
    expect(toPath("C:\\games\\video.mp4")).toBe("C:/games/video.mp4");
    expect(toPath("")).toBeNull();
    expect(toPath(null)).toBeNull();
  });
});

describe("renderer grouping", () => {
  const entries = [
    {
      id: "nadia:Uo2",
      game: "nadia",
      name: "Uo2",
      title: "Uo2",
      prefix: "misc",
      character: "Various",
      scene: "Misc",
      sceneId: "Uo",
      part: 2,
      variant: "" as const,
      alternate: false,
      hi: "/movies/Uo2.mp4",
      lo: "/movies/Uo2-l.mp4",
      sizeHi: 200,
      sizeLo: 100,
    },
    {
      id: "nadia:Uo1",
      game: "nadia",
      name: "Uo1",
      title: "Uo1",
      prefix: "misc",
      character: "Various",
      scene: "Misc",
      sceneId: "Uo",
      part: 1,
      variant: "" as const,
      alternate: false,
      hi: "/movies/Uo1.mp4",
      lo: "/movies/Uo1-l.mp4",
      sizeHi: 210,
      sizeLo: 110,
    },
    {
      id: "nadia:Solo",
      game: "nadia",
      name: "Solo",
      title: "Solo",
      prefix: "misc",
      character: "Various",
      scene: "Misc",
      sceneId: "Solo",
      part: null,
      variant: "" as const,
      alternate: false,
      hi: "/movies/Solo.mp4",
      lo: null,
      sizeHi: 500,
      sizeLo: 0,
    },
  ];

  test("countScenes", () => {
    expect(countScenes(entries)).toBe(2);
  });

  test("groupEntries", () => {
    const scenes = groupEntries(entries);
    expect(scenes.length).toBe(2);

    const uo = scenes.find((s) => s.sceneId === "Uo")!;
    expect(uo).toBeDefined();
    expect(uo.parts.length).toBe(2);
    // Natural order: part 1 first, then part 2
    expect(uo.parts[0].name).toBe("Uo1");
    expect(uo.parts[1].name).toBe("Uo2");
    // Inherited from first part
    expect(uo.name).toBe("Uo1");
    expect(uo.hi).toBe("/movies/Uo1.mp4");
  });

  test("normalizeEntry", () => {
    const raw = {
      name: "Test1",
      sizeHi: "1500",
      hi: "/media/video/test.mp4",
      dialogue: [
        { speaker: "Michael", text: "Hello there." },
        { speaker: "Chloe", text: "Hi Michael!" },
      ],
    };
    const normalized = normalizeEntry(raw, "genesis");
    expect(normalized.id).toBe("genesis:Test1");
    expect(normalized.game).toBe("genesis");
    expect(normalized.sizeHi).toBe(1500);
    expect(normalized.hi).toBe("/media/video/test.mp4");
    expect(normalized.lo).toBeNull();
    expect(normalized.dialogue).toEqual([
      { speaker: "Michael", text: "Hello there." },
      { speaker: "Chloe", text: "Hi Michael!" },
    ]);

    const emptyRaw = { name: "Test2" };
    expect(normalizeEntry(emptyRaw, "nadia").dialogue).toEqual([]);
  });

  test("groupEntries preserves dialogue on scene parts", () => {
    const rawParts = [
      {
        id: "nadia:D1",
        game: "nadia",
        name: "D1",
        sceneId: "D",
        part: 1,
        dialogue: [{ speaker: "Hero", text: "Line 1" }],
      },
      {
        id: "nadia:D2",
        game: "nadia",
        name: "D2",
        sceneId: "D",
        part: 2,
        dialogue: [{ speaker: "Diana", text: "Line 2" }],
      },
    ];
    const scenes = groupEntries(rawParts);
    expect(scenes.length).toBe(1);
    expect(scenes[0].parts.length).toBe(2);
    expect(scenes[0].parts[0].dialogue).toEqual([{ speaker: "Hero", text: "Line 1" }]);
    expect(scenes[0].parts[1].dialogue).toEqual([{ speaker: "Diana", text: "Line 2" }]);
  });
});

describe("dialogue playback scheduling", () => {
  test("buildDialogueSchedule assigns sequential intervals for looping scenes", () => {
    const lines = [
      { speaker: "Hero", text: "Line 1" },
      { speaker: "Pricia", text: "Line 2" },
    ];
    const schedule = scenePlayer.buildDialogueSchedule(lines);
    expect(schedule.hasTimestamps).toBe(false);
    expect(schedule.items.length).toBe(2);
    expect(schedule.items[0].start).toBe(0);
    expect(schedule.items[0].end).toBeGreaterThan(0);
    expect(schedule.items[1].start).toBe(schedule.items[0].end);
    expect(schedule.totalDuration).toBe(schedule.items[1].end);
  });

  test("buildDialogueSchedule respects explicit event timestamps", () => {
    const lines = [
      { speaker: "Judy", text: "Line 1", time: 3.5 },
      { speaker: "Judy", text: "Line 2", time: 10.0 },
    ];
    const schedule = scenePlayer.buildDialogueSchedule(lines);
    expect(schedule.hasTimestamps).toBe(true);
    expect(schedule.items[0].start).toBe(3.5);
    expect(schedule.items[0].end).toBeLessThanOrEqual(10.0);
    expect(schedule.items[1].start).toBe(10.0);
    expect(schedule.totalDuration).toBeGreaterThan(10.0);
  });
});


