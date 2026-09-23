import { describe, expect, test } from "bun:test";
import {
  characterFromStem,
  prefixFromStem,
  sceneFromStem,
  sceneGroupFromStem,
  stripLiteSuffix,
  titleFromStem,
} from "../src/main/scanner.js";

describe("titles helper", () => {
  test("stripLiteSuffix", () => {
    expect(stripLiteSuffix("abc-l")).toBe("abc");
    expect(stripLiteSuffix("abc")).toBe("abc");
  });

  test("titleFromStem", () => {
    expect(titleFromStem("BC-He-AS2")).toBe("BC He AS2");
    expect(titleFromStem("AgVl1ALT")).toBe("Ag Vl1 ALT");
    expect(titleFromStem("AlEmTS1")).toBe("Al Em TS1");
    expect(titleFromStem("NLTLogo")).toBe("NLT Logo");
    expect(titleFromStem("Uo9ALT")).toBe("Uo9 ALT");
    expect(titleFromStem("Dinner3_1")).toBe("Dinner3 1");
    expect(titleFromStem("dagadg")).toBe("dagadg");
  });

  test("prefixFromStem", () => {
    expect(prefixFromStem("BC-He-AS2")).toBe("BC");
    expect(prefixFromStem("Dinner3_1")).toBe("Dinner3");
    expect(prefixFromStem("Dinner3-l_1")).toBe("Dinner3");
    expect(prefixFromStem("dagadg")).toBe("misc");
  });

  test("characterFromStem", () => {
    expect(characterFromStem("BC-He-AS2")).toBe("Heather");
    expect(characterFromStem("BC-3sAlTa1")).toBe("3sAlTa");
    expect(characterFromStem("BC-Cr-An1")).toBe("Clare");
    expect(characterFromStem("BC-Ma-Pd1")).toBe("Madalyn");
    expect(characterFromStem("BC-Ha-HJ1")).toBe("Hannah");
    expect(characterFromStem("Fig-Alia-Nude")).toBe("Alia");
    expect(characterFromStem("AlEmTS1")).toBe("Alia");
    expect(characterFromStem("SoHeCs6B")).toBe("Sofia");
    expect(characterFromStem("DiDuFght1")).toBe("Diana");
    expect(characterFromStem("AliaShrine3")).toBe("Alia");
    expect(characterFromStem("JanetDT")).toBe("Janet");
    expect(characterFromStem("PS-ClareSquats1")).toBe("Clare");
    expect(characterFromStem("PS-SK2")).toBe("Various");
    expect(characterFromStem("AgVl1")).toBe("Various");
  });

  test("sceneFromStem", () => {
    expect(sceneFromStem("BC-He-AS2")).toBe("AS");
    expect(sceneFromStem("BC-Naomi-TitFO2-1")).toBe("TitF");
    expect(sceneFromStem("BC-3sAlTa1")).toBe("Misc");
    expect(sceneFromStem("Fig-Alia-Nude")).toBe("Nude");
    expect(sceneFromStem("AliaShrine3")).toBe("Florence Shrine");
    expect(sceneFromStem("JanetDT")).toBe("DT");
    expect(sceneFromStem("Dinner3_1")).toBe("Dinner");
    expect(sceneFromStem("PS-ClareSquats1")).toBe("Squats");
    expect(sceneFromStem("PS-SK2")).toBe("SK");
    expect(sceneFromStem("AgVl1")).toBe("Ag");
  });

  test("sceneGroupFromStem", () => {
    expect(sceneGroupFromStem("Uo1")).toEqual({
      sceneId: "Uo",
      part: 1,
      variant: "",
      alternate: false,
    });
    expect(sceneGroupFromStem("Uo1ALT")).toEqual({
      sceneId: "Uo",
      part: 1,
      variant: "",
      alternate: true,
    });
    expect(sceneGroupFromStem("BC-He-AS1O2")).toEqual({
      sceneId: "BC-He-AS",
      part: 1,
      variant: "O2",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-TaBjO1-1")).toEqual({
      sceneId: "BC-TaBj",
      part: 1,
      variant: "O1",
      alternate: false,
    });
    expect(sceneGroupFromStem("BC-3sKaEm-1")).toEqual({
      sceneId: "BC-3sKaEm",
      part: 1,
      variant: "",
      alternate: false,
    });
    expect(sceneGroupFromStem("Fig-Alia-Nude")).toEqual({
      sceneId: "Fig-Alia-Nude",
      part: null,
      variant: "",
      alternate: false,
    });
  });
});
