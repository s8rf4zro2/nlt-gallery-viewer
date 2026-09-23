import { describe, expect, test } from "bun:test";
import { filterEntries, formatStatusText } from "../renderer/modules/filter.js";
import { groupEntries, normalizeEntry, countScenes } from "../renderer/modules/grouping.js";
import {
  renderPrefixOptions,
  renderCharacterOptions,
  renderSceneOptions,
  renderCharacterRibbon,
} from "../renderer/modules/facets.js";
import {
  decodeEntry,
  CHARACTERS_BY_GAME,
  isBogusSceneTitle,
  PS_SCENES,
  isNSFWEntry,
} from "../src/shared/decoder/index.js";
import { sceneGroupFromStem } from "../src/main/scanner.js";

// Mock document for DOM facet tests in Bun environment
if (typeof document === "undefined") {
  globalThis.document = {
    createElement(tag: string) {
      const children: any[] = [];
      const attrs = new Map<string, string>();
      const classes = new Set<string>();
      let _text = "";
      return {
        tag,
        value: "",
        children,
        className: "",
        classList: {
          add(c: string) { classes.add(c); },
          remove(c: string) { classes.delete(c); },
          contains(c: string) { return classes.has(c); },
          toggle(c: string, force?: boolean) {
            if (force === true) classes.add(c);
            else if (force === false) classes.delete(c);
            else if (classes.has(c)) classes.delete(c);
            else classes.add(c);
          },
        },
        setAttribute(k: string, v: string) { attrs.set(k, v); },
        getAttribute(k: string) { return attrs.get(k); },
        append(...kids: any[]) {
          children.push(...kids);
        },
        onclick: null as any,
        get textContent() {
          const kidsText = children
            .map((c) => (typeof c === "string" ? c : (c.textContent || "")))
            .join("");
          return _text + kidsText;
        },
        set textContent(val: string) {
          _text = val;
          children.length = 0;
        },
      };
    },
  } as any;
}

function createMockSelect() {
  const children: any[] = [];
  return {
    children,
    value: "",
    textContent: "",
    append(child: any) {
      children.push(child);
    },
  };
}

describe("Universal cutscene decoder", () => {
  test("canonical characters exist for all 3 games", () => {
    expect(CHARACTERS_BY_GAME.nadia.length).toBeGreaterThan(10);
    expect(CHARACTERS_BY_GAME.genesis.length).toBeGreaterThan(15);
    expect(CHARACTERS_BY_GAME.symphony.length).toBeGreaterThan(15);
    expect(CHARACTERS_BY_GAME.nadia).toContain("Alia");
    expect(CHARACTERS_BY_GAME.genesis).toContain("Andrea");
    expect(CHARACTERS_BY_GAME.symphony).toContain("Nora");
    expect(CHARACTERS_BY_GAME.symphony).toContain("Autumn");
  });

  test("decodes Nadia booty call clip", () => {
    const decoded = decodeEntry(
      { name: "BC-Al-BJ1", prefix: "bc" },
      "nadia"
    );
    expect(decoded.characters).toEqual(["Alia"]);
    expect(decoded.character).toBe("Alia");
    expect(decoded.category).toBe("Booty Call");
    expect(decoded.act).toBe("Blowjob");
  });

  test("decodes Nadia figurine showcase", () => {
    const decoded = decodeEntry(
      { name: "Fig-Alia-Nude", prefix: "fig" },
      "nadia"
    );
    expect(decoded.characters).toEqual(["Alia"]);
    expect(decoded.category).toBe("Figurine / Showcase");
    expect(decoded.scene).toBe("Showcase Nude");
  });

  test("decodes Genesis threesome stem with MC", () => {
    // AdMcArPf is Andrea + MC + Arianna
    const decoded = decodeEntry(
      { name: "AdMcArPf", prefix: "misc" },
      "genesis"
    );
    expect(decoded.characters).toContain("Andrea");
    expect(decoded.characters).toContain("Arianna");
    expect(decoded.characters.length).toBe(2);
  });

  test("decodes Symphony dating and act stems", () => {
    const d1 = decodeEntry({ name: "Au-MS", prefix: "au" }, "symphony");
    expect(d1.characters).toContain("Autumn");
    expect(d1.act).toBe("Missionary");

    const d2 = decodeEntry({ name: "NoBP", prefix: "no" }, "symphony");
    expect(d2.characters).toContain("Nora");
    expect(d2.act).toBe("Breeding Press");

    const d3 = decodeEntry({ name: "Lucy69", prefix: "lucy" }, "symphony");
    expect(d3.characters).toContain("Lucy");
    expect(d3.act).toBe("Sixty-Nine");
    expect(d3.category).toBe("Date");

    const d4 = decodeEntry({ name: "AutumnFJ-P1A" }, "symphony");
    expect(d4.characters).toContain("Autumn");
    expect(d4.category).toBe("Date");

    const d5 = decodeEntry({ name: "DivyaTF-A1" }, "symphony");
    expect(d5.characters).toContain("Divya");
    expect(d5.act).toBe("Titfuck");
    expect(d5.category).toBe("Date");

    const d6 = decodeEntry({ name: "JuAP1" }, "symphony");
    expect(d6.characters).toContain("Julia");
    expect(d6.act).toBe("Anal Play");
    expect(d6.category).toBe("Date");
  });

  test("isBogusSceneTitle detects and rejects prompt choices", () => {
    expect(isBogusSceneTitle("Normal")).toBe(true);
    expect(isBogusSceneTitle("Angle 1")).toBe(true);
    expect(isBogusSceneTitle("Angle 2")).toBe(true);
    expect(isBogusSceneTitle("Cancel")).toBe(true);
    expect(isBogusSceneTitle("End")).toBe(true);
    expect(isBogusSceneTitle("\\c[18]Cancel")).toBe(true);
    expect(isBogusSceneTitle("Blowjob")).toBe(false);
    expect(isBogusSceneTitle("Pool Party")).toBe(false);
    expect(isBogusSceneTitle("Lisa Chair Sex")).toBe(false);
  });

  test("decodes Figurine showcase with clean title and scene (never 'Normal')", () => {
    const fakeFacts = {
      nadia: {
        videos: {
          "Fig-Alia": { video: "Fig-Alia", scene: "", titles: ["Normal"], characters: [], sources: [] },
        },
      },
    };
    const decoded = decodeEntry({ name: "Fig-Alia" }, "nadia", fakeFacts);
    expect(decoded.characters).toContain("Alia");
    expect(decoded.category).toBe("Figurine / Showcase");
    expect(decoded.scene).toBe("Showcase");
    expect(decoded.title).toBe("Alia · Showcase");
    expect(decoded.title).not.toBe("Normal");
    expect(decoded.scene).not.toBe("Normal");
  });

  test("decodes Genesis Porn Shop scenes with clean titles (never 'Angle 1')", () => {
    const fakeFacts = {
      genesis: {
        videos: {
          "PS-LisaChair1": { video: "PS-LisaChair1", scene: "", titles: ["Angle 1"], characters: [], sources: [] },
        },
      },
    };
    const decoded = decodeEntry({ name: "PS-LisaChair1" }, "genesis", fakeFacts);
    expect(decoded.characters).toContain("Lisa");
    expect(decoded.category).toBe("Porn Shop");
    expect(decoded.scene).toBe("Lisa Chair Sex");
    expect(decoded.title).toBe("Lisa Chair Sex");
    expect(decoded.title).not.toBe("Angle 1");

    const decodedDuet = decodeEntry({ name: "PS-CrDi1" }, "genesis");
    expect(decodedDuet.characters).toContain("Diana");
    expect(decodedDuet.characters).toContain("Clare");
    expect(decodedDuet.scene).toBe("Diana & Clare");
  });

  test("decodes Nadia Blonde Foursome (Blnd4Sm) with 3 characters", () => {
    const decoded = decodeEntry({ name: "Blnd4Sm1" }, "nadia");
    expect(decoded.characters).toContain("Jessica");
    expect(decoded.characters).toContain("Kaley");
    expect(decoded.characters).toContain("Emily");
    expect(decoded.characters.length).toBe(3);
    expect(decoded.scene).toBe("Blonde Foursome");
    expect(decoded.title).toBe("Jessica, Kaley & Emily · Blonde Foursome");
  });

  test("decodes Genesis Grand Orgy (BigOrgy) with all participating girls", () => {
    const decoded = decodeEntry({ name: "BigOrgy1" }, "genesis");
    expect(decoded.characters.length).toBe(13);
    expect(decoded.characters).toContain("Arianna");
    expect(decoded.characters).toContain("Erica");
    expect(decoded.characters).toContain("Nellie");
    expect(decoded.scene).toBe("Grand Orgy");
    expect(decoded.title).toBe("Grand Orgy");
  });

  test("decodes Symphony Moan Zone stems (MoanZone-CN with Carol & Naomi)", () => {
    const decoded = decodeEntry({ name: "MoanZone-CN-1" }, "symphony");
    expect(decoded.characters).toContain("Carol");
    expect(decoded.characters).toContain("Naomi");
    expect(decoded.category).toBe("Moan Zone");
  });
});

describe("filterEntries", () => {
  const sampleEntries = [
    normalizeEntry(
      {
        id: "nadia:BC-Al-BJ1",
        game: "nadia",
        name: "BC-Al-BJ1",
        title: "Alia · Blowjob",
        prefix: "bc",
        category: "Booty Call",
        character: "Alia",
        characters: ["Alia"],
        scene: "Blowjob",
        act: "Blowjob",
        sceneId: "BC-Al-BJ",
        part: 1,
        tags: ["series:Booty Call", "character:Alia", "scene:Blowjob"],
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "nadia:BC-Al-BJ2",
        game: "nadia",
        name: "BC-Al-BJ2",
        title: "Alia · Blowjob",
        prefix: "bc",
        category: "Booty Call",
        character: "Alia",
        characters: ["Alia"],
        scene: "Blowjob",
        act: "Blowjob",
        sceneId: "BC-Al-BJ",
        part: 2,
        tags: ["series:Booty Call", "character:Alia", "scene:Blowjob"],
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "nadia:BC-3sAlTa1",
        game: "nadia",
        name: "BC-3sAlTa1",
        title: "Alia & Tasha · Threesome",
        prefix: "bc",
        category: "Booty Call",
        character: "Alia, Tasha",
        characters: ["Alia", "Tasha"],
        scene: "Threesome",
        act: "Threesome",
        sceneId: "BC-3sAlTa",
        part: 1,
        tags: ["series:Booty Call", "character:Alia", "character:Tasha", "scene:Threesome"],
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "nadia:Fig-Diana-Nude",
        game: "nadia",
        name: "Fig-Diana-Nude",
        title: "Diana · Showcase Nude",
        prefix: "fig",
        category: "Figurine / Showcase",
        character: "Diana",
        characters: ["Diana"],
        scene: "Showcase Nude",
        act: "Showcase Nude",
        sceneId: "Fig-Diana-Nude",
        part: null,
        tags: ["series:Figurine / Showcase", "character:Diana", "scene:Showcase Nude"],
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "genesis:AdMcArPf",
        game: "genesis",
        name: "AdMcArPf",
        title: "Andrea Pussy Sex",
        prefix: "misc",
        category: "Story Cutscene",
        character: "Andrea, Arianna",
        characters: ["Andrea", "Arianna"],
        scene: "Pussy Sex",
        act: "Pussy Sex",
        gameScene: "SCN:394",
        sceneId: "AdMcArPf",
        part: null,
        tags: ["character:Andrea", "character:Arianna", "scene:Pussy Sex"],
      },
      "genesis"
    ),
  ];

  test("returns all entries when no filter is provided", () => {
    const res = filterEntries({ all: sampleEntries });
    expect(res.length).toBe(sampleEntries.length);
  });

  test("multi-character matching finds duets and threesomes for all participating characters", () => {
    // Alia appears in BC-Al-BJ1, BC-Al-BJ2, and BC-3sAlTa1
    const aliaClips = filterEntries({ all: sampleEntries, character: "Alia" });
    expect(aliaClips.length).toBe(3);
    expect(aliaClips.some((c) => c.name === "BC-3sAlTa1")).toBe(true);

    // Tasha appears in BC-3sAlTa1
    const tashaClips = filterEntries({ all: sampleEntries, character: "Tasha" });
    expect(tashaClips.length).toBe(1);
    expect(tashaClips[0].name).toBe("BC-3sAlTa1");

    // Andrea and Arianna both match the duet SCN:394
    const andreaClips = filterEntries({ all: sampleEntries, character: "Andrea" });
    expect(andreaClips.length).toBe(1);
    expect(andreaClips[0].name).toBe("AdMcArPf");

    const ariannaClips = filterEntries({ all: sampleEntries, character: "Arianna" });
    expect(ariannaClips.length).toBe(1);
    expect(ariannaClips[0].name).toBe("AdMcArPf");
  });

  test("filters by category / prefix accurately", () => {
    const bc = filterEntries({ all: sampleEntries, prefix: "Booty Call" });
    expect(bc.length).toBe(3);
    expect(bc.every((c) => c.category === "Booty Call")).toBe(true);

    const fig = filterEntries({ all: sampleEntries, prefix: "fig" });
    expect(fig.length).toBe(1);
    expect(fig[0].name).toBe("Fig-Diana-Nude");
  });

  test("filters by scene / act accurately", () => {
    const bj = filterEntries({ all: sampleEntries, scene: "Blowjob" });
    expect(bj.length).toBe(2);

    const ts = filterEntries({ all: sampleEntries, scene: "Threesome" });
    expect(ts.length).toBe(1);
    expect(ts[0].name).toBe("BC-3sAlTa1");
  });

  test("multi-word full-text query matches across all metadata fields", () => {
    // Search by character and act across words
    const res1 = filterEntries({ all: sampleEntries, query: "alia threesome" });
    expect(res1.length).toBe(1);
    expect(res1[0].name).toBe("BC-3sAlTa1");

    // Search by game scene code
    const res2 = filterEntries({ all: sampleEntries, query: "SCN:394" });
    expect(res2.length).toBe(1);
    expect(res2[0].name).toBe("AdMcArPf");

    // Search by partial stem
    const res3 = filterEntries({ all: sampleEntries, query: "diana" });
    expect(res3.length).toBe(1);
    expect(res3[0].name).toBe("Fig-Diana-Nude");
  });

  test("combines multiple filter dimensions cleanly", () => {
    // Booty Call + Alia
    const res = filterEntries({
      all: sampleEntries,
      prefix: "Booty Call",
      character: "Alia",
      scene: "Threesome",
    });
    expect(res.length).toBe(1);
    expect(res[0].name).toBe("BC-3sAlTa1");
  });
});

describe("facets rendering with scene grouping", () => {
  const nadiaClips = [
    normalizeEntry(
      {
        id: "nadia:BC-Al-BJ1",
        game: "nadia",
        name: "BC-Al-BJ1",
        title: "Alia · Blowjob",
        prefix: "bc",
        category: "Booty Call",
        character: "Alia",
        characters: ["Alia"],
        scene: "Blowjob",
        act: "Blowjob",
        sceneId: "BC-Al-BJ",
        part: 1,
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "nadia:BC-Al-BJ2",
        game: "nadia",
        name: "BC-Al-BJ2",
        title: "Alia · Blowjob",
        prefix: "bc",
        category: "Booty Call",
        character: "Alia",
        characters: ["Alia"],
        scene: "Blowjob",
        act: "Blowjob",
        sceneId: "BC-Al-BJ",
        part: 2,
      },
      "nadia"
    ),
    normalizeEntry(
      {
        id: "nadia:Fig-Diana-Nude",
        game: "nadia",
        name: "Fig-Diana-Nude",
        title: "Diana · Showcase Nude",
        prefix: "fig",
        category: "Figurine / Showcase",
        character: "Diana",
        characters: ["Diana"],
        scene: "Showcase Nude",
        act: "Showcase Nude",
        sceneId: "Fig-Diana-Nude",
        part: null,
      },
      "nadia"
    ),
  ];

  const scenes = groupEntries(nadiaClips);

  test("groupEntries merges parts into single scene cards", () => {
    // 3 clips fold into 2 scene cards (BC-Al-BJ has 2 parts, Fig-Diana-Nude has 1)
    expect(scenes.length).toBe(2);
    expect(countScenes(nadiaClips)).toBe(2);
  });

  test("renderCharacterOptions counts in scenes, not clips", () => {
    const sel = createMockSelect();
    renderCharacterOptions(sel as any, scenes, "");

    // All characters option + Alia (1 scene) + Diana (1 scene)
    expect(sel.children.length).toBe(3);
    const aliaOpt = sel.children.find((c) => c.value === "Alia");
    expect(aliaOpt).toBeDefined();
    // Alia has 2 clips, but represents 1 scene
    expect(aliaOpt.textContent).toContain("1 scenes");

    const dianaOpt = sel.children.find((c) => c.value === "Diana");
    expect(dianaOpt).toBeDefined();
    expect(dianaOpt.textContent).toContain("1 scenes");
  });

  test("renderCharacterOptions scopes to active category", () => {
    const sel = createMockSelect();
    renderCharacterOptions(sel as any, scenes, "", { activePrefix: "Booty Call" });

    // Scoped to Booty Call: only Alia should appear, not Diana
    const aliaOpt = sel.children.find((c) => c.value === "Alia");
    const dianaOpt = sel.children.find((c) => c.value === "Diana");
    expect(aliaOpt).toBeDefined();
    expect(dianaOpt).toBeUndefined();
  });

  test("renderSceneOptions scopes to active character", () => {
    const sel = createMockSelect();
    renderSceneOptions(sel as any, scenes, "", { activeCharacter: "Diana" });

    // Scoped to Diana: only Showcase Nude should appear, not Blowjob
    const nudeOpt = sel.children.find((c) => c.value === "Showcase Nude");
    const bjOpt = sel.children.find((c) => c.value === "Blowjob");
    expect(nudeOpt).toBeDefined();
    expect(bjOpt).toBeUndefined();
  });

  test("renderPrefixOptions populates clean categories and scene counts", () => {
    const sel = createMockSelect();
    renderPrefixOptions(sel as any, scenes, "");

    expect(sel.children.length).toBe(3); // All categories + Booty Call + Figurine / Showcase
    const bcOpt = sel.children.find((c) => c.value === "Booty Call");
    expect(bcOpt).toBeDefined();
    expect(bcOpt.textContent).toContain("1 scenes");
  });
});

describe("formatStatusText", () => {
  const all = [
    { sceneId: "s1", game: "nadia" },
    { sceneId: "s1", game: "nadia" },
    { sceneId: "s2", game: "nadia" },
  ];

  test("formats unfiltered status with total scenes and clips", () => {
    const text = formatStatusText({
      gameLabel: "Nadia",
      allEntries: all,
    });
    expect(text).toContain("Nadia: 2 scenes (3 clips)");
  });

  test("formats filtered status with active scenes and applied filter tags", () => {
    const filtered = [{ sceneId: "s1", game: "nadia" }];
    const text = formatStatusText({
      gameLabel: "Nadia",
      allEntries: all,
      filteredEntries: filtered,
      character: "Alia",
      prefix: "Booty Call",
      query: "threesome",
    });
    expect(text).toContain("Nadia: 1 scenes (1 clips) of 2");
    expect(text).toContain('character "Alia"');
    expect(text).toContain('category "Booty Call"');
    expect(text).toContain('search "threesome"');
  });
});

describe("sceneGroupFromStem and variant grouping", () => {
  test("groups Genesis NP suffix as variant with part and clean sceneId", () => {
    const g1 = sceneGroupFromStem("JuMcMnsKchn1");
    expect(g1.sceneId).toBe("JuMcMnsKchn");
    expect(g1.part).toBe(1);
    expect(g1.variant).toBe("");

    const g2 = sceneGroupFromStem("JuMcMnsKchn1NP");
    expect(g2.sceneId).toBe("JuMcMnsKchn");
    expect(g2.part).toBe(1);
    expect(g2.variant).toBe("NP");

    const g3 = sceneGroupFromStem("ErFtMs10NP");
    expect(g3.sceneId).toBe("ErFtMs");
    expect(g3.part).toBe(10);
    expect(g3.variant).toBe("NP");
  });

  test("groups Nadia fast playback suffix as variant", () => {
    const gf = sceneGroupFromStem("AliaFF-10fast");
    expect(gf.sceneId).toBe("AliaFF");
    expect(gf.part).toBe(10);
    expect(gf.variant).toBe("fast");
  });
});

describe("renderCharacterRibbon and clean scene options", () => {
  const sampleScenes = [
    {
      sceneId: "s1",
      game: "nadia",
      character: "Alia",
      characters: ["Alia"],
      scene: "Blowjob",
      category: "Booty Call",
    },
    {
      sceneId: "s2",
      game: "nadia",
      character: "Alia, Tasha",
      characters: ["Alia", "Tasha"],
      scene: "Threesome",
      category: "Booty Call",
    },
    {
      sceneId: "s3",
      game: "nadia",
      character: "Diana",
      characters: ["Diana"],
      scene: "Normal", // bogus title that should be filtered out
      category: "Figurine / Showcase",
    },
  ];

  test("renderCharacterRibbon renders All pill and character pills with exact scene counts", () => {
    const container = document.createElement("div");
    let selected = "INITIAL";

    renderCharacterRibbon(container as any, sampleScenes as any, "Alia", (char) => {
      selected = char;
    });

    // Expect 3 pills: All, Alia, Tasha, Diana (or All + 3 characters)
    expect(container.children.length).toBe(4);

    const allPill = container.children[0];
    expect(allPill.textContent).toContain("All");
    expect(allPill.className).not.toContain("is-active");

    const aliaPill = container.children.find((c: any) => c.getAttribute("data-character") === "Alia");
    expect(aliaPill).toBeDefined();
    expect(aliaPill.className).toContain("is-active");
    // Alia has 2 scenes (s1 and s2)
    expect(aliaPill.textContent).toContain("2");

    // Clicking active pill toggles off to ''
    aliaPill.onclick();
    expect(selected).toBe("");

    // Clicking Diana pill selects Diana
    const dianaPill = container.children.find((c: any) => c.getAttribute("data-character") === "Diana");
    dianaPill.onclick();
    expect(selected).toBe("Diana");
  });

  test("renderSceneOptions excludes bogus titles like 'Normal' or 'Angle 1'", () => {
    const sel = createMockSelect();
    renderSceneOptions(sel as any, sampleScenes as any, "");

    // 'Normal' must NOT appear in the dropdown
    const normalOpt = sel.children.find((c) => c.value === "Normal");
    expect(normalOpt).toBeUndefined();

    // Valid scenes should appear
    const bjOpt = sel.children.find((c) => c.value === "Blowjob");
    const tsOpt = sel.children.find((c) => c.value === "Threesome");
    expect(bjOpt).toBeDefined();
    expect(tsOpt).toBeDefined();
  });

  test("decodes Anal scenes without false Andrea character across games", () => {
    // In Nadia: EmAn, MlAn, SoAn are Emily, Madalyn, Sofia with Anal Sex (never Andrea)
    const emAn = decodeEntry({ name: "EmAn1" }, "nadia");
    expect(emAn.characters).toEqual(["Emily"]);
    expect(emAn.characters).not.toContain("Andrea");
    expect(emAn.act).toBe("Anal Sex");

    const mlAn = decodeEntry({ name: "MlAn1" }, "nadia");
    expect(mlAn.characters).toEqual(["Madalyn"]);
    expect(mlAn.characters).not.toContain("Andrea");
    expect(mlAn.act).toBe("Anal Sex");

    const soAn = decodeEntry({ name: "SoAn1" }, "nadia");
    expect(soAn.characters).toEqual(["Sofia"]);
    expect(soAn.characters).not.toContain("Andrea");
    expect(soAn.act).toBe("Anal Sex");

    // In Symphony: DiAn, LuAn, NoAn are Divya, Lucy, Nora with Anal Sex (never Andrea)
    const diAn = decodeEntry({ name: "DiAn1" }, "symphony");
    expect(diAn.characters).toEqual(["Divya"]);
    expect(diAn.characters).not.toContain("Andrea");
    expect(diAn.act).toBe("Anal Sex");

    const luAn = decodeEntry({ name: "LuAn1" }, "symphony");
    expect(luAn.characters).toEqual(["Lucy"]);
    expect(luAn.characters).not.toContain("Andrea");
    expect(luAn.act).toBe("Anal Sex");

    const noAn = decodeEntry({ name: "NoAn1" }, "symphony");
    expect(noAn.characters).toEqual(["Nora"]);
    expect(noAn.characters).not.toContain("Andrea");
    expect(noAn.act).toBe("Anal Sex");
  });

  test("decodes Clare River Sex (CrCp) without false Cleopatra character", () => {
    const crCp = decodeEntry({ name: "CrCp1" }, "nadia");
    expect(crCp.characters).toEqual(["Clare"]);
    expect(crCp.characters).not.toContain("Cleopatra");
  });

  test("decodes BC-3NaPr12 with Naomi and Pricia and normalizes sceneId to BC-3sNaPr", () => {
    const bc3 = decodeEntry({ name: "BC-3NaPr12" }, "nadia");
    expect(bc3.characters).toContain("Naomi");
    expect(bc3.characters).toContain("Pricia");
    expect(bc3.category).toBe("Booty Call");
    expect(bc3.act).toBe("Threesome");

    const group = sceneGroupFromStem("BC-3NaPr12");
    expect(group.sceneId).toBe("BC-3sNaPr");
    expect(group.part).toBe(12);
  });

  test("decodes Genesis NoMcInt as Nellie Interrogation", () => {
    const noMc = decodeEntry({ name: "NoMcInt" }, "genesis");
    expect(noMc.characters).toEqual(["Nellie"]);
    expect(noMc.characters).not.toContain("Nora");
    expect(noMc.scene).toBe("Nellie Interrogation");
  });

  test("decodes MeetEmily with Emily and MeetSofia with Sofia", () => {
    const me = decodeEntry({ name: "MeetEmily" }, "nadia");
    expect(me.characters).toEqual(["Emily"]);
    expect(me.characters).not.toContain("Melissa");
    expect(me.scene).toBe("Meet Emily");

    const ms = decodeEntry({ name: "MeetSofia1" }, "nadia");
    expect(ms.characters).toEqual(["Sofia"]);
    expect(ms.characters).not.toContain("Melissa");
    expect(ms.scene).toBe("Meet Sofia");
  });

  test("does not match characters for non-character / system cutscenes", () => {
    const logoGen = decodeEntry({ name: "Logo" }, "genesis");
    expect(logoGen.characters).toEqual([]);
    expect(logoGen.character).toBe("Various");
    expect(logoGen.title).toBe("Studio Logo");

    const logoSym = decodeEntry({ name: "Logo" }, "symphony");
    expect(logoSym.characters).toEqual([]);
    expect(logoSym.character).toBe("Various");

    const canoe = decodeEntry({ name: "Canoe" }, "nadia");
    expect(canoe.characters).toEqual([]);
    expect(canoe.character).toBe("Various");

    const amulet = decodeEntry({ name: "AmuletH" }, "genesis");
    expect(amulet.characters).toEqual([]);
    expect(amulet.character).toBe("Various");
  });
});

describe("NSFW and SFW cutscene classification and filtering", () => {
  test("isNSFWEntry correctly classifies adult and sex scenes as NSFW", () => {
    // Booty call
    expect(isNSFWEntry({ name: "BC-Al-BJ1", prefix: "bc", category: "Booty Call" })).toBe(true);
    // Porn shop
    expect(isNSFWEntry({ name: "PS-LisaChair1", prefix: "ps", category: "Porn Shop" })).toBe(true);
    // Moan zone
    expect(isNSFWEntry({ name: "MoanZone-CN1", prefix: "mz", category: "Moan Zone" })).toBe(true);
    // Nude figurine showcase
    expect(isNSFWEntry({ name: "Fig-Alia-Nude", prefix: "fig", category: "Figurine / Showcase" })).toBe(true);
    // Story sex scenes
    expect(isNSFWEntry({ name: "AliaFF-1", title: "Alia Frist Fuck", scene: "First Fuck" })).toBe(true);
    expect(isNSFWEntry({ name: "Blnd4Sm1", title: "Blonde Foursome", scene: "Foursome" })).toBe(true);
    expect(isNSFWEntry({ name: "AdMcArPf", title: "Andrea Pussy Sex", scene: "Pussy Sex" })).toBe(true);
    expect(isNSFWEntry({ name: "BigOrgy", title: "Grand Orgy", scene: "Grand Orgy" })).toBe(true);
    expect(isNSFWEntry({ name: "EvLbAn", title: "Evie Anal", act: "Anal Sex" })).toBe(true);
    // Raw stems without adult words in title/scene
    expect(isNSFWEntry({ name: "AdKthFk1", title: "Andrea Solo Kitchen" })).toBe(true);
    expect(isNSFWEntry({ name: "CaMcKtchAnl1", title: "Carol kitchen" })).toBe(true);
    expect(isNSFWEntry({ name: "ElWrkFk1", title: "Ella Sparring" })).toBe(true);
    expect(isNSFWEntry({ name: "Pr-Happy1", title: "Hand Job(Jade)" })).toBe(true);
    expect(isNSFWEntry({ name: "AlEmTS1", title: "Alia Emily3 Some" })).toBe(true);
    expect(isNSFWEntry({ name: "KaEmAlJaLi1", title: "Library 5some" })).toBe(true);
    expect(isNSFWEntry({ name: "MdTaPr4s1", title: "Pricia Maddy Tasha" })).toBe(true);
    expect(isNSFWEntry({ name: "SoNaJa5sm1", title: "Sofia Janet Naomi" })).toBe(true);
    expect(isNSFWEntry({ name: "SxEd1", title: "Kaley Jessica" })).toBe(true);
    expect(isNSFWEntry({ name: "ErHllOgy1", title: "Erica Hell" })).toBe(true);
    expect(isNSFWEntry({ name: "ArErFngr1", title: "Arianna Finering" })).toBe(true);
    expect(isNSFWEntry({ name: "ChHnMcEO1", title: "Hannah Chloe Eat" })).toBe(true);
    expect(isNSFWEntry({ name: "MdFng1", title: "Madalyn Toma" })).toBe(true);
    expect(isNSFWEntry({ name: "MaSitHJ1", title: "Madalyn Face Sit" })).toBe(true);
    expect(isNSFWEntry({ name: "Pr-FirstMas-P1", title: "Pricia Massage" })).toBe(true);
    expect(isNSFWEntry({ name: "SunBathe1", title: "Diana Sunscreen" })).toBe(true);
    expect(isNSFWEntry({ name: "TaCrDiRt1", title: "Casula Ritual" })).toBe(true);
    expect(isNSFWEntry({ name: "SoKaEo1", title: "Sofia Kaley" })).toBe(true);
    expect(isNSFWEntry({ name: "GrJuKtch1", title: "Grace Julia Kitchen BJ" })).toBe(true);
    // In-game erotic scenes without explicit keywords (Switch #3, Lovense, or formerly leaking scenes)
    expect(isNSFWEntry({ name: "Va-BrSoB-P1", title: "Brad Val Beach" })).toBe(true);
    expect(isNSFWEntry({ name: "Ka-Bottle", title: "Kaley Bottle" })).toBe(true);
    expect(isNSFWEntry({ name: "SoPool1", title: "Sofia Pool" })).toBe(true);
    expect(isNSFWEntry({ name: "SoAlNaBt1", title: "Alia Sofia" })).toBe(true);
    expect(isNSFWEntry({ name: "NaTaAlBar1", title: "Naomi Alia Tasha" })).toBe(true);
    expect(isNSFWEntry({ name: "PrOilToG1", title: "Pricia Oil" })).toBe(true);
    expect(isNSFWEntry({ name: "LolaStrip1", title: "Striptease" })).toBe(true);
    expect(isNSFWEntry({ name: "KePD1", title: "Kelli Pile Driver" })).toBe(true);
    expect(isNSFWEntry({ name: "HeWorkout", title: "Heather Workout" })).toBe(true);
    expect(isNSFWEntry({ name: "ErInt", title: "Erica Interrogation" })).toBe(true);
    expect(isNSFWEntry({ name: "Toma-RightArmB", title: "Toma Leolo Cum" })).toBe(true);
    expect(isNSFWEntry({ name: "DemoTeaser", title: "Empusa" })).toBe(true);
  });

  test("isNSFWEntry correctly classifies story and non-sexual scenes as SFW", () => {
    expect(isNSFWEntry({ name: "Logo", title: "Studio Logo", scene: "Logo" })).toBe(false);
    expect(isNSFWEntry({ name: "NLTLogo", title: "Studio Logo", scene: "Logo" })).toBe(false);
    expect(isNSFWEntry({ name: "AmuletH", title: "Amulet", scene: "Amulet" })).toBe(false);
    expect(isNSFWEntry({ name: "Canoe", title: "Canoe", scene: "Canoe" })).toBe(false);
    expect(isNSFWEntry({ name: "LunchParty", title: "Lunch Party", scene: "Lunch Party" })).toBe(false);
    expect(isNSFWEntry({ name: "Funeral", title: "Funeral", scene: "Funeral" })).toBe(false);
    expect(isNSFWEntry({ name: "Title", title: "Title", scene: "Title" })).toBe(false);
    expect(isNSFWEntry({ name: "Opening", title: "Opening", scene: "Opening" })).toBe(false);
    expect(isNSFWEntry({ name: "Fig-Alia-Outfit", title: "Alia · Showcase Outfit", category: "Figurine / Showcase" })).toBe(false);
    expect(isNSFWEntry({ name: "Fig-Alia", title: "Alia · Showcase", category: "Figurine / Showcase" })).toBe(false);
    expect(isNSFWEntry({ name: "BookThrow", title: "Book Throw" })).toBe(false);
  });

  test("decodeEntry includes nsfw flag and rating tag", () => {
    const nsfwDecoded = decodeEntry({ name: "BC-Al-BJ1", prefix: "bc" }, "nadia");
    expect(nsfwDecoded.nsfw).toBe(true);
    expect(nsfwDecoded.tags).toContain("rating:nsfw");

    const sfwDecoded = decodeEntry({ name: "Logo", prefix: "misc" }, "genesis");
    expect(sfwDecoded.nsfw).toBe(false);
    expect(sfwDecoded.tags).toContain("rating:sfw");
  });

  test("filterEntries filters by rating (default NSFW, optional SFW, or All)", () => {
    const mockEntries = [
      normalizeEntry({ id: "1", name: "BC-Al-BJ1", title: "Alia · Blowjob", prefix: "bc", category: "Booty Call", sceneId: "BC-Al-BJ", nsfw: true }, "nadia"),
      normalizeEntry({ id: "2", name: "AliaFF-1", title: "Alia First Fuck", prefix: "AliaFF", category: "Story Cutscene", sceneId: "AliaFF", nsfw: true }, "nadia"),
      normalizeEntry({ id: "3", name: "Fig-Alia-Nude", title: "Alia Showcase Nude", prefix: "fig", category: "Figurine / Showcase", sceneId: "Fig-Alia-Nude", nsfw: true }, "nadia"),
      normalizeEntry({ id: "4", name: "Fig-Alia-Outfit", title: "Alia Showcase Outfit", prefix: "fig", category: "Figurine / Showcase", sceneId: "Fig-Alia-Outfit", nsfw: false }, "nadia"),
      normalizeEntry({ id: "5", name: "Logo", title: "Studio Logo", prefix: "misc", category: "Story Cutscene", sceneId: "Logo", nsfw: false }, "nadia"),
      normalizeEntry({ id: "6", name: "Canoe", title: "Canoe", prefix: "misc", category: "Story Cutscene", sceneId: "Canoe", nsfw: false }, "nadia"),
    ];

    // Default or explicit 'nsfw' filter
    const nsfwOnly = filterEntries({ all: mockEntries, rating: "nsfw" });
    expect(nsfwOnly.length).toBe(3);
    expect(nsfwOnly.map((e) => e.name)).toEqual(["BC-Al-BJ1", "AliaFF-1", "Fig-Alia-Nude"]);

    // 'sfw' filter
    const sfwOnly = filterEntries({ all: mockEntries, rating: "sfw" });
    expect(sfwOnly.length).toBe(3);
    expect(sfwOnly.map((e) => e.name)).toEqual(["Fig-Alia-Outfit", "Logo", "Canoe"]);

    // 'all' filter or empty
    const allScenes = filterEntries({ all: mockEntries, rating: "all" });
    expect(allScenes.length).toBe(6);

    const unfiltered = filterEntries({ all: mockEntries });
    expect(unfiltered.length).toBe(6);
  });

  test("groupEntries and normalizeEntry propagate nsfw property", () => {
    const rawNsfw = { name: "BC-Al-BJ1", sceneId: "BC-Al-BJ", part: 1, nsfw: true };
    const normalizedNsfw = normalizeEntry(rawNsfw, "nadia");
    expect(normalizedNsfw.nsfw).toBe(true);

    const scenes = groupEntries([normalizedNsfw]);
    expect(scenes[0].nsfw).toBe(true);

    const rawSfw = { name: "Logo", sceneId: "Logo", part: null, nsfw: false };
    const normalizedSfw = normalizeEntry(rawSfw, "genesis");
    expect(normalizedSfw.nsfw).toBe(false);

    const sfwScenes = groupEntries([normalizedSfw]);
    expect(sfwScenes[0].nsfw).toBe(false);
  });

  test("formatStatusText includes rating tag when active", () => {
    const all = [
      normalizeEntry({ id: "1", name: "BC1", sceneId: "BC1", nsfw: true }, "nadia"),
      normalizeEntry({ id: "2", name: "Logo", sceneId: "Logo", nsfw: false }, "nadia"),
    ];
    const nsfwFiltered = [all[0]];

    const statusSfw = formatStatusText({
      gameLabel: "Nadia",
      allEntries: all,
      filteredEntries: [all[1]],
      rating: "sfw",
    });
    expect(statusSfw).toContain("SFW only");

    const statusAll = formatStatusText({
      gameLabel: "Nadia",
      allEntries: all,
      filteredEntries: all,
      rating: "all",
    });
    expect(statusAll).toContain("NSFW + SFW");
  });

  test("unknown ambiguous scene defaults to NSFW", () => {
    const customEntry = { name: "MysteriousCave", sceneId: "MysteriousCave", game: "nadia" };
    expect(isNSFWEntry(customEntry)).toBe(true);
  });
});


