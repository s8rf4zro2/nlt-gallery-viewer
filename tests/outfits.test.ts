import { describe, expect, test } from "bun:test";
import { groupEntries, variantRank } from "../renderer/modules/grouping.js";
import { CHIPS, chipDef } from "../renderer/player/chips.js";
import { sceneGroupFromStem } from "../src/main/scanner.js";

describe("Multi-outfit scene grouping and non-interlaced part sequencing", () => {
  test("parts for the same outfit stay together in sequence (O1 parts, then O2 parts)", () => {
    // Interlaced input order (Part 1 O1 -> Part 1 O2 -> Part 2 O1 -> Part 2 O2)
    const rawEntries = [
      { id: "nadia:BC-Ad-AS1O2", game: "nadia", name: "BC-Ad-AS1O2", sceneId: "BC-Ad-AS", part: 1, variant: "O2", alternate: false, hi: "h1", lo: "l1" },
      { id: "nadia:BC-Ad-AS1", game: "nadia", name: "BC-Ad-AS1", sceneId: "BC-Ad-AS", part: 1, variant: "", alternate: false, hi: "h2", lo: "l2" },
      { id: "nadia:BC-Ad-AS2O2", game: "nadia", name: "BC-Ad-AS2O2", sceneId: "BC-Ad-AS", part: 2, variant: "O2", alternate: false, hi: "h3", lo: "l3" },
      { id: "nadia:BC-Ad-AS2", game: "nadia", name: "BC-Ad-AS2", sceneId: "BC-Ad-AS", part: 2, variant: "", alternate: false, hi: "h4", lo: "l4" },
      { id: "nadia:BC-Ad-AS3O2", game: "nadia", name: "BC-Ad-AS3O2", sceneId: "BC-Ad-AS", part: 3, variant: "O2", alternate: false, hi: "h5", lo: "l5" },
      { id: "nadia:BC-Ad-AS3", game: "nadia", name: "BC-Ad-AS3", sceneId: "BC-Ad-AS", part: 3, variant: "", alternate: false, hi: "h6", lo: "l6" },
    ];

    const scenes = groupEntries(rawEntries);
    expect(scenes.length).toBe(1);
    const scene = scenes[0];
    expect(scene.parts.length).toBe(6);

    // Verify parts order is NOT interlaced: all Outfit 1 parts first in order, then all Outfit 2 parts in order
    expect(scene.parts.map((p: any) => p.name)).toEqual([
      "BC-Ad-AS1",
      "BC-Ad-AS2",
      "BC-Ad-AS3",
      "BC-Ad-AS1O2",
      "BC-Ad-AS2O2",
      "BC-Ad-AS3O2",
    ]);

    // Verify companion base parts are labeled variant "O1"
    expect(scene.parts[0].variant).toBe("O1");
    expect(scene.parts[1].variant).toBe("O1");
    expect(scene.parts[2].variant).toBe("O1");
    expect(scene.parts[3].variant).toBe("O2");
    expect(scene.parts[4].variant).toBe("O2");
    expect(scene.parts[5].variant).toBe("O2");
  });

  test("scenes without outfit variants keep base variant '' and do not re-label as O1", () => {
    const rawEntries = [
      { id: "nadia:AliaFF-2", game: "nadia", name: "AliaFF-2", sceneId: "AliaFF", part: 2, variant: "", alternate: false },
      { id: "nadia:AliaFF-1", game: "nadia", name: "AliaFF-1", sceneId: "AliaFF", part: 1, variant: "", alternate: false },
    ];
    const scenes = groupEntries(rawEntries);
    expect(scenes.length).toBe(1);
    expect(scenes[0].parts.map((p: any) => p.name)).toEqual(["AliaFF-1", "AliaFF-2"]);
    expect(scenes[0].parts[0].variant).toBe("");
    expect(scenes[0].parts[1].variant).toBe("");
  });

  test("alternate takes are placed at the end of their respective part sequence", () => {
    const rawEntries = [
      { id: "nadia:Uo1ALT", game: "nadia", name: "Uo1ALT", sceneId: "Uo", part: 1, variant: "", alternate: true },
      { id: "nadia:Uo2", game: "nadia", name: "Uo2", sceneId: "Uo", part: 2, variant: "", alternate: false },
      { id: "nadia:Uo1", game: "nadia", name: "Uo1", sceneId: "Uo", part: 1, variant: "", alternate: false },
    ];
    const scenes = groupEntries(rawEntries);
    expect(scenes[0].parts.map((p: any) => p.name)).toEqual(["Uo1", "Uo1ALT", "Uo2"]);
  });

  test("variantRank correctly prioritizes O1 < O2 < O3 < NP < fast < other", () => {
    expect(variantRank("O1")).toBe(1);
    expect(variantRank("")).toBe(1);
    expect(variantRank("O2")).toBe(2);
    expect(variantRank("O3")).toBe(3);
    expect(variantRank("NP")).toBe(10);
    expect(variantRank("fast")).toBe(20);
    expect(variantRank("custom")).toBe(50);
  });

  test("case mismatch in scene prefix (BC- vs Bc-) merges into unified scene without interlacing", () => {
    const rawEntries = [
      { id: "nadia:BC-Cr-An1", game: "nadia", name: "BC-Cr-An1", sceneId: "BC-Cr-An", part: 1, variant: "", alternate: false },
      { id: "nadia:Bc-Cr-An1O2", game: "nadia", name: "Bc-Cr-An1O2", sceneId: "Bc-Cr-An", part: 1, variant: "O2", alternate: false },
      { id: "nadia:BC-Cr-An2", game: "nadia", name: "BC-Cr-An2", sceneId: "BC-Cr-An", part: 2, variant: "", alternate: false },
      { id: "nadia:Bc-Cr-An2O2", game: "nadia", name: "Bc-Cr-An2O2", sceneId: "Bc-Cr-An", part: 2, variant: "O2", alternate: false },
    ];
    const scenes = groupEntries(rawEntries);
    expect(scenes.length).toBe(1);
    expect(scenes[0].sceneId).toBe("BC-Cr-An");
    expect(scenes[0].parts.map((p: any) => p.name)).toEqual([
      "BC-Cr-An1",
      "BC-Cr-An2",
      "Bc-Cr-An1O2",
      "Bc-Cr-An2O2",
    ]);
    expect(scenes[0].parts[0].variant).toBe("O1");
    expect(scenes[0].parts[1].variant).toBe("O1");
    expect(scenes[0].parts[2].variant).toBe("O2");
    expect(scenes[0].parts[3].variant).toBe("O2");
  });

  test("alternate take belonging to base outfit gets variant O1 and matches O1 and alt chips", () => {
    const rawEntries = [
      { id: "nadia:S1", game: "nadia", name: "S1", sceneId: "S", part: 1, variant: "", alternate: false },
      { id: "nadia:S1ALT", game: "nadia", name: "S1ALT", sceneId: "S", part: 1, variant: "", alternate: true },
      { id: "nadia:S1O2", game: "nadia", name: "S1O2", sceneId: "S", part: 1, variant: "O2", alternate: false },
    ];
    const scenes = groupEntries(rawEntries);
    expect(scenes[0].parts[1].variant).toBe("O1");

    const o1Chip = chipDef("O1");
    const altChip = chipDef("alt");
    const o2Chip = chipDef("O2");

    expect(scenes[0].parts.filter((p: any) => o1Chip.match(p)).map((p: any) => p.name)).toEqual(["S1", "S1ALT"]);
    expect(scenes[0].parts.filter((p: any) => o2Chip.match(p)).map((p: any) => p.name)).toEqual(["S1O2"]);
    expect(scenes[0].parts.filter((p: any) => altChip.match(p)).map((p: any) => p.name)).toEqual(["S1ALT"]);
  });
});

describe("Player variant chips filtering", () => {
  test("chips match O1, O2, NP, and alt parts accurately", () => {
    const o1Chip = chipDef("O1");
    const o2Chip = chipDef("O2");
    const npChip = chipDef("NP");
    const altChip = chipDef("alt");

    const parts = [
      { name: "Part1", part: 1, variant: "O1", alternate: false },
      { name: "Part2", part: 2, variant: "O1", alternate: false },
      { name: "Part1O2", part: 1, variant: "O2", alternate: false },
      { name: "Part2O2", part: 2, variant: "O2", alternate: false },
      { name: "Part1ALT", part: 1, variant: "O1", alternate: true },
      { name: "Part1NP", part: 1, variant: "NP", alternate: false },
    ];

    const o1Matches = parts.filter((p) => o1Chip.match(p));
    expect(o1Matches.map((p) => p.name)).toEqual(["Part1", "Part2", "Part1ALT"]);

    const o2Matches = parts.filter((p) => o2Chip.match(p));
    expect(o2Matches.map((p) => p.name)).toEqual(["Part1O2", "Part2O2"]);

    const npMatches = parts.filter((p) => npChip.match(p));
    expect(npMatches.map((p) => p.name)).toEqual(["Part1NP"]);

    const altMatches = parts.filter((p) => altChip.match(p));
    expect(altMatches.map((p) => p.name)).toEqual(["Part1ALT"]);
  });
});

describe("Stem parsing parity for multi-outfit scenes", () => {
  const stems = [
    "BC-3sAlTa1", "BC-3sAlTa1O2", "BC-3sAlTa10O2",
    "BC-Ad-AS1", "BC-Ad-AS1O2",
    "BC-TaBjO1-1",
    "BC-Alia-Foolin-O1-1", "BC-Alia-Foolin-O2-1",
    "BC-Naomi-TitFO2-1", "BC-Naomi-TitF-1",
    "BC-Emily-O1PF1", "BC-Emily-O2PF1",
    "BC-Er-EO1", "BC-Er-EO1O2", "ChHnMcEO1", "ChHnMcEO10",
    "BC-Grace-EO1", "BC-Grace-EO1O", "BC-Grace-EO7O",
    "BC-CpEO1", "BC-CpEO1O",
    "BC-Am-DT1O", "GrHandies1O", "Bc-MgTs1O", "BC-JuTP0O",
    "Bc-Cr-An1O2", "BC-Cr-An1",
  ];

  test("groups multi-outfit stems accurately", () => {
    for (const stem of stems) {
      const res = sceneGroupFromStem(stem);
      expect(res.sceneId).toBeDefined();
      expect(typeof res.alternate).toBe("boolean");
    }
  });

  test("groups hyphenated and mid-stem outfit stems with correct sceneId and variant", () => {
    expect(sceneGroupFromStem("BC-Alia-Foolin-O1-1")).toEqual({
      sceneId: "BC-Alia-Foolin",
      part: 1,
      variant: "O1",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Alia-Foolin-O2-1")).toEqual({
      sceneId: "BC-Alia-Foolin",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Emily-O1PF1")).toEqual({
      sceneId: "BC-Emily-PF",
      part: 1,
      variant: "O1",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Emily-O2PF1")).toEqual({
      sceneId: "BC-Emily-PF",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Naomi-TitFO2-1")).toEqual({
      sceneId: "BC-Naomi-TitF",
      part: 1,
      variant: "O2",
      alternate: false,
    });
  });

  test("groups Symphony trailing uppercase O outfit stems with variant O2", () => {
    expect(sceneGroupFromStem("BC-Grace-EO1")).toEqual({
      sceneId: "BC-Grace-EO",
      part: 1,
      variant: "",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Grace-EO1O")).toEqual({
      sceneId: "BC-Grace-EO",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-CpEO3O")).toEqual({
      sceneId: "BC-CpEO",
      part: 3,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Am-DT1O")).toEqual({
      sceneId: "BC-Am-DT",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("GrHandies1O")).toEqual({
      sceneId: "GrHandies",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-JuTP0O")).toEqual({
      sceneId: "BC-JuTP",
      part: 0,
      variant: "O2",
      alternate: false,
    });
  });

  test("normalizes Bc- prefix to BC- in sceneId", () => {
    expect(sceneGroupFromStem("Bc-Cr-An1O2")).toEqual({
      sceneId: "BC-Cr-An",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("Bc-MgTs1O")).toEqual({
      sceneId: "BC-MgTs",
      part: 1,
      variant: "O2",
      alternate: false,
    });
  });

  test("distinguishes Eat Out (EO) code from outfit variants", () => {
    expect(sceneGroupFromStem("BC-Er-EO1")).toEqual({
      sceneId: "BC-Er-EO",
      part: 1,
      variant: "",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-Er-EO1O2")).toEqual({
      sceneId: "BC-Er-EO",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("ChHnMcEO10")).toEqual({
      sceneId: "ChHnMcEO",
      part: 10,
      variant: "",
      alternate: false,
    });
  });
});
